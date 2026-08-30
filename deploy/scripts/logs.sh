#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=deploy/scripts/lib.sh
source "$SCRIPT_DIR/lib.sh"

ENV_FILE=${LINGDIAN_ENV_FILE:-/etc/lingdian/production.env}
SERVICE=
TAIL=200
FOLLOW=false
while (($#)); do
  case "$1" in
    --env) ENV_FILE=${2:?--env requires a path}; shift 2 ;;
    --tail) TAIL=${2:?--tail requires a number}; shift 2 ;;
    -f|--follow) FOLLOW=true; shift ;;
    api|app|merchant|admin|db) SERVICE=$1; shift ;;
    -h|--help) printf 'Usage: %s [SERVICE] [--tail N] [-f] [--env PATH]\n' "${0##*/}"; exit 0 ;;
    *) die "Unknown argument: $1" ;;
  esac
done
[[ "$TAIL" =~ ^[0-9]{1,6}$ ]] || die '--tail must be a positive integer'
load_deploy_config
init_docker
prepare_runtime_envs
current_sha=$(state_read current)
[[ "$current_sha" =~ ^[0-9a-f]{40}$ ]] || die 'No current deployed release is recorded'
use_release "$RELEASES_DIR/$current_sha" "$current_sha"
args=(logs --no-color --tail "$TAIL" --timestamps)
[[ "$FOLLOW" == true ]] && args+=(-f)
[[ -z "$SERVICE" ]] || args+=("$SERVICE")
compose "${args[@]}"
