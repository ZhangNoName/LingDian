#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=deploy/scripts/lib.sh
source "$SCRIPT_DIR/lib.sh"

ENV_FILE=${LINGDIAN_ENV_FILE:-/etc/lingdian/production.env}
BACKUP=
APPLY=false
CONFIRM=

usage() {
  cat <<'EOF'
Usage:
  restore.sh --backup /opt/lingdian/backups/lingdian-...       # verify only
  restore.sh --backup /opt/lingdian/backups/lingdian-... \
    --apply-local --confirm RESTORE_LOCAL_DATABASE_AND_UPLOADS

Production apply is intentionally limited to DATABASE_MODE=local. Always test
the SQL dump in an isolated database before applying it to production.
EOF
}

while (($#)); do
  case "$1" in
    --env) ENV_FILE=${2:?--env requires a path}; shift 2 ;;
    --backup) BACKUP=${2:?--backup requires a path}; shift 2 ;;
    --apply-local) APPLY=true; shift ;;
    --confirm) CONFIRM=${2:?--confirm requires a token}; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) die "Unknown argument: $1" ;;
  esac
done
[[ -n "$BACKUP" ]] || { usage >&2; die '--backup is required'; }

load_deploy_config
[[ -d "$BACKUP" ]] || die "Backup directory does not exist: $BACKUP"
BACKUP=$(cd -- "$BACKUP" && pwd -P)
canonical_backup_dir=$(cd -- "$BACKUP_DIR" && pwd -P)
[[ $(dirname -- "$BACKUP") == "$canonical_backup_dir" ]] || die "Backup must be a direct child of $BACKUP_DIR"
[[ $(basename -- "$BACKUP") =~ ^lingdian-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{12}-[a-z0-9_-]+$ ]] ||
  die 'Backup directory name is not recognized'
for required in database.sql.gz uploads.tar.gz metadata.json SHA256SUMS; do
  [[ -r "$BACKUP/$required" ]] || die "Backup is incomplete: missing $required"
done
(cd "$BACKUP" && sha256sum -c SHA256SUMS)
gzip -t "$BACKUP/database.sql.gz"
gzip -t "$BACKUP/uploads.tar.gz"
backup_sha=$(jq -er '.releaseSha | select(test("^[0-9a-f]{40}$"))' "$BACKUP/metadata.json") ||
  die 'Backup metadata contains no valid release SHA'
log "Backup verification passed (application release $backup_sha)"

if [[ "$APPLY" == false ]]; then
  log 'Verification only; no production data was changed'
  exit 0
fi
[[ "$CONFIRM" == RESTORE_LOCAL_DATABASE_AND_UPLOADS ]] ||
  die 'Destructive restore requires --confirm RESTORE_LOCAL_DATABASE_AND_UPLOADS'
jq -e '.snapshotHasDeployedRelease == true' "$BACKUP/metadata.json" >/dev/null ||
  die 'This first-deploy snapshot has no matching previously deployed application release; automated apply is refused'
[[ "$DATABASE_MODE" == local ]] ||
  die 'Automated apply is disabled for external databases; restore the verified SQL through the external DBA runbook'

ensure_runtime_dirs
acquire_deploy_lock
require_observability_transaction_clear restore
reconcile_current_release_pointer
if [[ "$RELEASE_POINTER_REPAIRED" == true ]]; then
  log 'Recovered an interrupted release-state commit; no destructive restore was performed. Re-run explicitly if the verified backup still needs to be applied.'
  exit 0
fi
init_docker
prepare_runtime_envs
current_sha=$(state_read current)
[[ "$current_sha" =~ ^[0-9a-f]{40}$ ]] || die 'No current release is recorded'
current_release="$RELEASES_DIR/$current_sha"
use_release "$current_release" "$current_sha"

log 'Creating a safety backup before destructive restore'
bash "$current_release/deploy/scripts/backup.sh" \
  --env "$ENV_FILE" --release-dir "$current_release" --sha "$current_sha" --reason pre-restore \
  --skip-retention
safety_backup=$(state_read last-backup)

# The safety backup releases its lock before returning. Acquire it ourselves
# before doing anything destructive; if a scheduled backup won the small gap,
# stop here and let the operator retry without touching production data.
exec 8>"$STATE_DIR/backup.lock"
flock -n 8 || die 'A backup started before restore could lock retention; retry the restore'

target_release="$RELEASES_DIR/$backup_sha"
use_release "$target_release" "$backup_sha"
for image in "lingdian/api:$backup_sha" "lingdian/app:$backup_sha" "lingdian/merchant:$backup_sha" "lingdian/admin:$backup_sha"; do
  "${DOCKER[@]}" image inspect "$image" >/dev/null 2>&1 ||
    die "Restore requires retained application image: $image"
done

database_name=$(dotenv_get MYSQL_DATABASE "$ENV_FILE")
database_user=$(dotenv_get MYSQL_USER "$ENV_FILE")
[[ "$database_name" =~ ^[A-Za-z0-9_]+$ && "$database_user" =~ ^[A-Za-z0-9_]+$ ]] ||
  die 'MYSQL_DATABASE and MYSQL_USER must contain only letters, numbers and underscore'

# Revalidate under backup.lock immediately before the first destructive step.
# This proves the chosen payload still exists and is unchanged after the safety
# backup, while the held lock prevents scheduled retention from deleting it.
[[ -d "$BACKUP" ]] || die "Restore target disappeared before apply: $BACKUP"
for required in database.sql.gz uploads.tar.gz metadata.json SHA256SUMS; do
  [[ -r "$BACKUP/$required" ]] || die "Backup became incomplete before apply: missing $required"
done
(cd "$BACKUP" && sha256sum -c SHA256SUMS)
gzip -t "$BACKUP/database.sql.gz"
gzip -t "$BACKUP/uploads.tar.gz"

warn 'Stopping the API and replacing the local database and uploads'
compose stop api
wait_for_service db 180 || die 'Local database is not healthy'
compose exec -T db sh -eu -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; export MYSQL_PWD; mysql --user=root --execute="DROP DATABASE IF EXISTS \`$MYSQL_DATABASE\`; CREATE DATABASE \`$MYSQL_DATABASE\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL PRIVILEGES ON \`$MYSQL_DATABASE\`.* TO '\''$MYSQL_USER'\''@'\''%'\''; FLUSH PRIVILEGES;"'
gzip -dc "$BACKUP/database.sql.gz" | compose exec -T db sh -eu -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; export MYSQL_PWD; exec mysql --user=root "$MYSQL_DATABASE"'

archive_image=$(dotenv_get BACKUP_ARCHIVE_IMAGE "$ENV_FILE" 'busybox:1.37@sha256:9db7b59979c38555a39def84a31fb98b5296952f9e3afd4f6f11f05b07adfab0')
"${DOCKER[@]}" image inspect "$archive_image" >/dev/null 2>&1 || "${DOCKER[@]}" pull "$archive_image" >/dev/null
"${DOCKER[@]}" run --rm \
  --mount "type=bind,src=$BACKUP,dst=/backup,readonly" \
  --mount "type=bind,src=$DATA_DIR/uploads,dst=/uploads" \
  "$archive_image" sh -eu -c \
  'find /uploads -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +; tar -xzf /backup/uploads.tar.gz -C /uploads; chown -R 1000:1000 /uploads'

restore_activation_failed=false
if ! compose up -d api app merchant admin; then
  warn 'Restored application containers could not be created or started'
  restore_activation_failed=true
elif ! wait_for_application; then
  restore_activation_failed=true
fi
if [[ "$restore_activation_failed" == true ]]; then
  warn "Restored data did not pass application health checks; safety backup: $safety_backup"
  die 'Restore completed at the data layer but application recovery needs manual intervention'
fi

if [[ "$current_sha" != "$backup_sha" ]]; then state_write previous "$current_sha"; fi
state_write current "$backup_sha"
atomic_update_current_release_pointer "$target_release"
printf '%s\t%s\t%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$backup_sha" restored >>"$STATE_DIR/history.log"
chmod 0600 "$STATE_DIR/history.log"
log "Restore completed; pre-restore safety backup: $safety_backup"
