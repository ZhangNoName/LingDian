#!/usr/bin/env bash
set -Eeuo pipefail

# Compatibility wrapper. The new installer renders domain/port values from the
# protected production environment and supports first-issue HTTP mode.

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
ENV_FILE=${LINGDIAN_ENV_FILE:-/etc/lingdian/production.env}
MODE=${LINGDIAN_NGINX_MODE:-https}
exec bash "$SCRIPT_DIR/install-nginx.sh" --env "$ENV_FILE" --mode "$MODE"
