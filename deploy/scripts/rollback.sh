#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=deploy/scripts/lib.sh
source "$SCRIPT_DIR/lib.sh"

ENV_FILE=${LINGDIAN_ENV_FILE:-/etc/lingdian/production.env}
TARGET_SHA=
SKIP_BACKUP=false

usage() {
  printf 'Usage: %s [--env PATH] [--sha FULL_SHA] [--skip-backup]\n' "${0##*/}"
}
while (($#)); do
  case "$1" in
    --env) ENV_FILE=${2:?--env requires a path}; shift 2 ;;
    --sha) TARGET_SHA=${2:?--sha requires a value}; shift 2 ;;
    --skip-backup) SKIP_BACKUP=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "Unknown argument: $1" ;;
  esac
done

load_deploy_config
ensure_runtime_dirs
acquire_deploy_lock
require_observability_transaction_clear rollback
reconcile_current_release_pointer
if [[ "$RELEASE_POINTER_REPAIRED" == true ]]; then
  log 'Recovered an interrupted release-state commit; no additional rollback was performed. Re-run explicitly if another rollback is still required.'
  exit 0
fi
init_docker
prepare_runtime_envs

current_sha=$(state_read current)
[[ "$current_sha" =~ ^[0-9a-f]{40}$ ]] || die 'No current deployed release is recorded'
if [[ -z "$TARGET_SHA" ]]; then TARGET_SHA=$(state_read previous); fi
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || die 'No valid previous release is recorded; pass --sha FULL_SHA'
[[ "$TARGET_SHA" != "$current_sha" ]] || die 'Target release is already current'
target_release="$RELEASES_DIR/$TARGET_SHA"
current_release="$RELEASES_DIR/$current_sha"
use_release "$current_release" "$current_sha"

if [[ "$SKIP_BACKUP" == false ]]; then
  bash "$current_release/deploy/scripts/backup.sh" \
    --env "$ENV_FILE" --release-dir "$current_release" --sha "$current_sha" --reason pre-rollback
fi

exec 7>"$STATE_DIR/backup.lock"
flock -n 7 || die 'A scheduled backup started before rollback could lock release state; retry the rollback'

use_release "$target_release" "$TARGET_SHA"

for image in "lingdian/api:$TARGET_SHA" "lingdian/app:$TARGET_SHA" "lingdian/merchant:$TARGET_SHA" "lingdian/admin:$TARGET_SHA"; do
  "${DOCKER[@]}" image inspect "$image" >/dev/null 2>&1 || die "Rollback image is missing: $image"
done

warn 'Rollback changes application images only; it does not reverse database migrations'
rollback_failed=false
if ! compose up -d api app merchant admin; then
  warn 'Rollback target containers could not be created or started'
  rollback_failed=true
elif ! wait_for_application; then
  rollback_failed=true
fi
if [[ "$rollback_failed" == true ]]; then
  warn 'Rollback target failed health checks; restoring the original application containers'
  use_release "$current_release" "$current_sha"
  if ! compose up -d api app merchant admin; then
    warn 'Original application release could not be recreated after the rejected rollback'
  elif ! wait_for_application; then
    warn 'Original application release also failed health checks after reactivation'
  fi
  die 'Rollback target was rejected by the health gate'
fi

state_write previous "$current_sha"
state_write current "$TARGET_SHA"
atomic_update_current_release_pointer "$target_release"
printf '%s\t%s\t%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$TARGET_SHA" rolled-back >>"$STATE_DIR/history.log"
chmod 0600 "$STATE_DIR/history.log"
log "Rollback completed: $current_sha -> $TARGET_SHA"
compose ps
