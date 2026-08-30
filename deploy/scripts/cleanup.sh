#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=deploy/scripts/lib.sh
source "$SCRIPT_DIR/lib.sh"

ENV_FILE=${LINGDIAN_ENV_FILE:-/etc/lingdian/production.env}
APPLY=false
CONFIRM=

usage() {
  cat <<'EOF'
Usage: cleanup.sh [--env PATH] [--apply --confirm PRUNE_OLD_LINGDIAN_RELEASES]

Dry-run is the default. Cleanup always retains current, previous, every release
referenced by a retained backup, and the newest RELEASE_RETENTION_COUNT releases.
It removes only exact LingDian image tags and validated SHA release directories.
EOF
}
while (($#)); do
  case "$1" in
    --env) ENV_FILE=${2:?--env requires a path}; shift 2 ;;
    --apply) APPLY=true; shift ;;
    --confirm) CONFIRM=${2:?--confirm requires a value}; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) die "Unknown argument: $1" ;;
  esac
done
if [[ "$APPLY" == true && "$CONFIRM" != PRUNE_OLD_LINGDIAN_RELEASES ]]; then
  die 'Cleanup apply requires --confirm PRUNE_OLD_LINGDIAN_RELEASES'
fi

load_deploy_config
ensure_runtime_dirs
init_docker
retention_count=$(dotenv_get RELEASE_RETENTION_COUNT "$ENV_FILE" 5)
[[ "$retention_count" =~ ^[1-9][0-9]{0,2}$ ]] || die 'RELEASE_RETENTION_COUNT must be an integer from 1 to 999'

keep_file=$(mktemp "$STATE_DIR/.cleanup-keep.XXXXXX")
candidate_file=$(mktemp "$STATE_DIR/.cleanup-candidates.XXXXXX")
cleanup_temp() { rm -f -- "$keep_file" "$candidate_file"; }
trap cleanup_temp EXIT

add_keep() {
  if [[ "${1:-}" =~ ^[0-9a-f]{40}$ ]]; then
    printf '%s\n' "$1" >>"$keep_file"
  fi
  return 0
}

release_mtime() {
  stat -c '%Y' "$1" 2>/dev/null || stat -f '%m' "$1" 2>/dev/null ||
    die "Cannot inspect release modification time: $1"
}

add_keep "$(state_read current)"
add_keep "$(state_read previous)"
add_keep "$(state_read observability-current)"
add_keep "$(state_read observability-intent)"

while IFS= read -r -d '' metadata; do
  add_keep "$(jq -r '.releaseSha // empty' "$metadata" 2>/dev/null || true)"
  add_keep "$(jq -r '.toolingReleaseSha // empty' "$metadata" 2>/dev/null || true)"
done < <(find "$BACKUP_DIR" -mindepth 2 -maxdepth 2 -type f -name metadata.json -print0)

for release in "$RELEASES_DIR"/*; do
  [[ -d "$release" ]] || continue
  sha=$(basename -- "$release")
  [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || continue
  [[ -r "$release/.lingdian-release-sha" && $(<"$release/.lingdian-release-sha") == "$sha" ]] ||
    die "Refusing cleanup because a release marker is invalid: $release"
  printf '%s %s\n' "$(release_mtime "$release")" "$sha" >>"$candidate_file"
done

while read -r _ sha; do add_keep "$sha"; done < <(sort -rn "$candidate_file" | head -n "$retention_count")
sort -u -o "$keep_file" "$keep_file"

removed=0
while read -r _ sha; do
  grep -Fqx "$sha" "$keep_file" && continue
  release="$RELEASES_DIR/$sha"
  if [[ "$APPLY" == false ]]; then
    printf 'would remove release/images: %s\n' "$sha"
    continue
  fi

  image_in_use=false
  for component in api app merchant admin; do
    image="lingdian/$component:$sha"
    if [[ -n $("${DOCKER[@]}" ps -aq --filter "ancestor=$image") ]]; then image_in_use=true; fi
  done
  if [[ "$image_in_use" == true ]]; then
    warn "Kept release because an exact image tag is still used by a container: $sha"
    continue
  fi

  image_failed=false
  for component in api app merchant admin; do
    image="lingdian/$component:$sha"
    if "${DOCKER[@]}" image inspect "$image" >/dev/null 2>&1; then
      "${DOCKER[@]}" image rm "$image" >/dev/null || image_failed=true
    fi
  done
  if [[ "$image_failed" == true ]]; then
    warn "Kept release directory because one or more images are still in use: $sha"
    continue
  fi
  [[ $(dirname -- "$release") == "$RELEASES_DIR" && $(basename -- "$release") == "$sha" ]] ||
    die "Refusing unexpected release path: $release"
  rm -rf -- "$release"
  log "Removed expired LingDian release and exact image tags: $sha"
  removed=$((removed + 1))
done < <(sort -rn "$candidate_file")

if [[ "$APPLY" == false ]]; then
  log "Cleanup dry-run complete; retained newest $retention_count plus state/backup references"
else
  log "Cleanup complete; removed $removed release(s)"
fi
