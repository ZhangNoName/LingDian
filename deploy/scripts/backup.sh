#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=deploy/scripts/lib.sh
source "$SCRIPT_DIR/lib.sh"

ENV_FILE=${LINGDIAN_ENV_FILE:-/etc/lingdian/production.env}
RELEASE_DIR=
RELEASE_SHA=
REASON=scheduled
SKIP_RETENTION=false

usage() {
  printf 'Usage: %s [--env PATH] [--release-dir PATH --sha SHA] [--reason LABEL] [--skip-retention]\n' "${0##*/}"
}

while (($#)); do
  case "$1" in
    --env) ENV_FILE=${2:?--env requires a path}; shift 2 ;;
    --release-dir) RELEASE_DIR=${2:?--release-dir requires a path}; shift 2 ;;
    --sha) RELEASE_SHA=${2:?--sha requires a value}; shift 2 ;;
    --reason) REASON=${2:?--reason requires a value}; shift 2 ;;
    --skip-retention) SKIP_RETENTION=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "Unknown argument: $1" ;;
  esac
done
[[ "$REASON" =~ ^[a-z0-9][a-z0-9_-]{0,31}$ ]] || die 'Backup reason must match [a-z0-9_-] and be at most 32 characters'

load_deploy_config
ensure_runtime_dirs
init_docker
exec 8>"$STATE_DIR/backup.lock"
flock -n 8 || die 'Another LingDian backup is already running'

publish_backup_metrics() {
  local succeeded=$1 metrics_dir metrics_file metrics_tmp now last_success=0
  metrics_dir="$DEPLOY_ROOT/observability/node-exporter-textfile"
  [[ -d "$metrics_dir" && -w "$metrics_dir" ]] || return 0
  metrics_file="$metrics_dir/lingdian_backup.prom"
  if [[ -r "$metrics_file" ]]; then
    last_success=$(awk '$1 == "lingdian_backup_last_success_timestamp_seconds" { print $2 }' "$metrics_file")
  fi
  [[ "$last_success" =~ ^[0-9]+$ ]] || last_success=0
  now=$(date +%s)
  [[ "$succeeded" == 1 ]] && last_success=$now
  metrics_tmp=$(mktemp "$metrics_dir/.lingdian-backup.XXXXXX")
  {
    printf '# HELP lingdian_backup_last_attempt_timestamp_seconds Unix time of the latest backup attempt.\n'
    printf '# TYPE lingdian_backup_last_attempt_timestamp_seconds gauge\n'
    printf 'lingdian_backup_last_attempt_timestamp_seconds %s\n' "$now"
    printf '# HELP lingdian_backup_last_attempt_success Whether the latest backup attempt completed successfully.\n'
    printf '# TYPE lingdian_backup_last_attempt_success gauge\n'
    printf 'lingdian_backup_last_attempt_success %s\n' "$succeeded"
    printf '# HELP lingdian_backup_last_success_timestamp_seconds Unix time of the latest successful backup.\n'
    printf '# TYPE lingdian_backup_last_success_timestamp_seconds gauge\n'
    printf 'lingdian_backup_last_success_timestamp_seconds %s\n' "$last_success"
  } >"$metrics_tmp"
  chmod 0644 "$metrics_tmp"
  mv -f -- "$metrics_tmp" "$metrics_file"
}

# Mark the attempt failed first. Successful completion replaces the metric
# atomically; crashes and command failures therefore become alertable.
publish_backup_metrics 0

if [[ -z "$RELEASE_SHA" ]]; then RELEASE_SHA=$(state_read current); fi
[[ "$RELEASE_SHA" =~ ^[0-9a-f]{40}$ ]] || die 'No deployed release is available to identify this backup'
if [[ -z "$RELEASE_DIR" ]]; then RELEASE_DIR="$RELEASES_DIR/$RELEASE_SHA"; fi
prepare_runtime_envs
use_release "$RELEASE_DIR" "$RELEASE_SHA"

timestamp=$(date -u '+%Y%m%dT%H%M%SZ')
data_release_sha=$(state_read current)
snapshot_has_deployed_release=true
if [[ ! "$data_release_sha" =~ ^[0-9a-f]{40}$ ]]; then
  data_release_sha=$RELEASE_SHA
  snapshot_has_deployed_release=false
fi
backup_name="lingdian-${timestamp}-${data_release_sha:0:12}-${REASON}"
partial="$BACKUP_DIR/.${backup_name}.partial"
destination="$BACKUP_DIR/$backup_name"
[[ ! -e "$partial" && ! -e "$destination" ]] || die "Backup destination already exists: $destination"
mkdir -m 0700 "$partial"
cleanup_partial() { rm -rf -- "$partial"; }
trap cleanup_partial EXIT

log "Creating database backup in $destination"
if [[ "$DATABASE_MODE" == local ]]; then
  wait_for_service db 180 || die 'Local database is not healthy'
  compose exec -T db sh -eu -c \
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump --user=root --single-transaction --routines --events --triggers --hex-blob --no-tablespaces --set-gtid-purged=OFF "$MYSQL_DATABASE"' \
    | gzip -9 >"$partial/database.sql.gz"
else
  # Keep this under STATE_DIR rather than /tmp: systemd uses PrivateTmp, while
  # the Docker daemon must be able to resolve the bind-mount source path.
  connection_dir=$(mktemp -d "$STATE_DIR/.db-connection.XXXXXX")
  chmod 0700 "$connection_dir"
  trap 'rm -rf -- "$connection_dir"; cleanup_partial' EXIT
  python3 - "$ENV_FILE" "$connection_dir" <<'PY'
import os
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse

env_path, output_dir = sys.argv[1:]
env = {}
for original in Path(env_path).read_text(encoding='utf-8').splitlines():
    line = original.strip()
    if not line or line.startswith('#') or '=' not in line:
        continue
    key, value = line.split('=', 1)
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "'\"":
        value = value[1:-1]
    env[key.strip()] = value
url = urlparse(env.get('DATABASE_URL', ''))
if url.scheme != 'mysql' or not url.hostname or not url.username or url.password is None or not url.path.strip('/'):
    raise SystemExit('External DATABASE_URL is incomplete')
values = {
    'host': url.hostname,
    'port': str(url.port or 3306),
    'user': unquote(url.username),
    'password': unquote(url.password),
    'database': url.path.strip('/'),
}
for name, value in values.items():
    target = Path(output_dir, name)
    target.write_text(value, encoding='utf-8')
    os.chmod(target, 0o600)
PY
  db_host=$(<"$connection_dir/host")
  db_port=$(<"$connection_dir/port")
  db_user=$(<"$connection_dir/user")
  db_name=$(<"$connection_dir/database")
  mysql_image=$(dotenv_get MYSQL_IMAGE "$ENV_FILE" 'mysql:8.4@sha256:b3b90af2a6552ae30c266fdb7d5dd55f3afb72404bb78d37fe8a23eb857fd3fb')
  ssl_mode=$(dotenv_get EXTERNAL_MYSQL_SSL_MODE "$ENV_FILE" VERIFY_IDENTITY)
  [[ "$ssl_mode" == VERIFY_IDENTITY ]] ||
    die 'EXTERNAL_MYSQL_SSL_MODE must be VERIFY_IDENTITY'
  [[ -s "$DB_CA_RUNTIME_FILE" ]] || die 'External MySQL CA runtime certificate is missing'
  "${DOCKER[@]}" image inspect "$mysql_image" >/dev/null 2>&1 || "${DOCKER[@]}" pull "$mysql_image" >/dev/null
  "${DOCKER[@]}" run --rm --network host \
    --mount "type=bind,src=$connection_dir/password,dst=/run/secrets/mysql-password,readonly" \
    --mount "type=bind,src=$DB_CA_RUNTIME_FILE,dst=/run/secrets/mysql-ca.pem,readonly" \
    --entrypoint sh "$mysql_image" -eu -c \
    'MYSQL_PWD=$(cat /run/secrets/mysql-password); export MYSQL_PWD; exec mysqldump --single-transaction --routines --events --triggers --hex-blob --no-tablespaces --set-gtid-purged=OFF --ssl-mode="$1" --ssl-ca=/run/secrets/mysql-ca.pem --host="$2" --port="$3" --user="$4" "$5"' \
    sh "$ssl_mode" "$db_host" "$db_port" "$db_user" "$db_name" \
    | gzip -9 >"$partial/database.sql.gz"
  rm -rf -- "$connection_dir"
fi

gzip -t "$partial/database.sql.gz"
[[ -s "$partial/database.sql.gz" ]] || die 'Database backup is empty'

archive_image=$(dotenv_get BACKUP_ARCHIVE_IMAGE "$ENV_FILE" 'busybox:1.37@sha256:9db7b59979c38555a39def84a31fb98b5296952f9e3afd4f6f11f05b07adfab0')
"${DOCKER[@]}" image inspect "$archive_image" >/dev/null 2>&1 || "${DOCKER[@]}" pull "$archive_image" >/dev/null
"${DOCKER[@]}" run --rm \
  --mount "type=bind,src=$DATA_DIR/uploads,dst=/source,readonly" \
  --mount "type=bind,src=$partial,dst=/backup" \
  "$archive_image" tar -czf /backup/uploads.tar.gz -C /source .
gzip -t "$partial/uploads.tar.gz"

jq -n \
  --arg createdAt "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
  --arg releaseSha "$data_release_sha" \
  --arg toolingReleaseSha "$RELEASE_SHA" \
  --arg databaseMode "$DATABASE_MODE" \
  --arg reason "$REASON" \
  --argjson snapshotHasDeployedRelease "$snapshot_has_deployed_release" \
  '{version:1, createdAt:$createdAt, releaseSha:$releaseSha, toolingReleaseSha:$toolingReleaseSha, snapshotHasDeployedRelease:$snapshotHasDeployedRelease, databaseMode:$databaseMode, reason:$reason}' \
  >"$partial/metadata.json"
(cd "$partial" && sha256sum database.sql.gz uploads.tar.gz metadata.json >SHA256SUMS)

mv -- "$partial" "$destination"
trap - EXIT
state_write last-backup "$destination"
publish_backup_metrics 1
log "Backup completed: $destination"

if [[ "$SKIP_RETENTION" == true ]]; then
  log 'Backup retention skipped for this safety snapshot'
  exit 0
fi

retention_days=$(dotenv_get BACKUP_RETENTION_DAYS "$ENV_FILE" 14)
[[ "$retention_days" =~ ^[0-9]{1,4}$ ]] || die 'BACKUP_RETENTION_DAYS must be an integer from 0 to 9999'
while IFS= read -r -d '' expired; do
  [[ $(dirname -- "$expired") == "$BACKUP_DIR" && $(basename -- "$expired") =~ ^lingdian-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{12}-[a-z0-9_-]+$ ]] ||
    die "Refusing to remove unexpected retention target: $expired"
  rm -rf -- "$expired"
  log "Removed expired backup: $expired"
done < <(find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name 'lingdian-*' -mtime "+$retention_days" -print0)
