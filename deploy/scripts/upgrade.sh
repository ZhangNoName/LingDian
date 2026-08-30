#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
REPO_ROOT=$(cd -- "$SCRIPT_DIR/../.." && pwd -P)
ENV_FILE=${LINGDIAN_ENV_FILE:-/etc/lingdian/production.env}
REF=origin/main
EXTRA_ARGS=()

usage() {
  printf 'Usage: %s [--env PATH] [--ref GIT_REF] [--skip-backup]\n' "${0##*/}"
}

while (($#)); do
  case "$1" in
    --env) ENV_FILE=${2:?--env requires a path}; shift 2 ;;
    --ref) REF=${2:?--ref requires a value}; shift 2 ;;
    --skip-tls) printf '%s\n' '--skip-tls is not supported by the production deployment profile' >&2; exit 64 ;;
    --skip-backup) EXTRA_ARGS+=("$1"); shift ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'Unknown argument: %s\n' "$1" >&2; exit 64 ;;
  esac
done
[[ "$REF" != -* ]] || { printf 'Git ref must not begin with a dash\n' >&2; exit 64; }

git -C "$REPO_ROOT" fetch --prune origin
target_sha=$(git -C "$REPO_ROOT" rev-parse --verify "$REF^{commit}") || {
  printf 'Cannot resolve fetched deployment ref: %s\n' "$REF" >&2
  exit 1
}
[[ "$target_sha" =~ ^[0-9a-f]{40}$ ]] || {
  printf 'Resolved deployment ref is not a full commit SHA: %s\n' "$target_sha" >&2
  exit 1
}
exec bash "$SCRIPT_DIR/deploy-all.sh" --env "$ENV_FILE" --sha "$target_sha" "${EXTRA_ARGS[@]}"
