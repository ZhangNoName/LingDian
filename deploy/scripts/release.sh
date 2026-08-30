#!/usr/bin/env bash
set -Eeuo pipefail

# Compatibility entrypoint for the former GitHub Actions release contract.
# Releases are now atomic across all four application services, so a partial
# selection is intentionally promoted to a complete deployment.

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
SHA=${1:?usage: release.sh <git-sha> [app,merchant,admin,api|all]}
SELECTION=${2:-all}

if [[ "$SELECTION" != all ]]; then
  printf 'WARN: partial selection %s is deprecated; deploying all services atomically\n' "$SELECTION" >&2
fi

ENV_FILE=${LINGDIAN_ENV_FILE:-/etc/lingdian/production.env}
exec bash "$SCRIPT_DIR/deploy-all.sh" --env "$ENV_FILE" --sha "$SHA"
