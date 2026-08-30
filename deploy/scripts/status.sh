#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=deploy/scripts/lib.sh
source "$SCRIPT_DIR/lib.sh"

ENV_FILE=${LINGDIAN_ENV_FILE:-/etc/lingdian/production.env}
while (($#)); do
  case "$1" in
    --env) ENV_FILE=${2:?--env requires a path}; shift 2 ;;
    -h|--help) printf 'Usage: %s [--env PATH]\n' "${0##*/}"; exit 0 ;;
    *) die "Unknown argument: $1" ;;
  esac
done

load_deploy_config
init_docker
prepare_runtime_envs
current_sha=$(state_read current)
previous_sha=$(state_read previous)
last_backup=$(state_read last-backup)
observability_intent=$(state_read observability-intent)

printf 'Current release:  %s\n' "${current_sha:-not deployed}"
printf 'Previous release: %s\n' "${previous_sha:-none}"
printf 'Latest backup:    %s\n' "${last_backup:-none}"
printf 'Deploy intent:    %s\n' "${observability_intent:-none}"
[[ "$current_sha" =~ ^[0-9a-f]{40}$ ]] || exit 1
use_release "$RELEASES_DIR/$current_sha" "$current_sha"
compose ps

failed=false
if [[ -n "$observability_intent" ]]; then
  printf 'deployment INCOMPLETE: core/observability handoff for %s needs recovery\n' "$observability_intent" >&2
  failed=true
fi
for endpoint in \
  "api:http://127.0.0.1:$(dotenv_get API_PORT "$ENV_FILE" 9000)/api/health/ready" \
  "app:http://127.0.0.1:$(dotenv_get APP_PORT "$ENV_FILE" 8082)/healthz" \
  "merchant:http://127.0.0.1:$(dotenv_get MERCHANT_PORT "$ENV_FILE" 8083)/healthz" \
  "admin:http://127.0.0.1:$(dotenv_get ADMIN_PORT "$ENV_FILE" 8084)/healthz"; do
  name=${endpoint%%:*}
  url=${endpoint#*:}
  if curl -fsS --max-time 5 "$url" >/dev/null; then
    printf '%-10s healthy (%s)\n' "$name" "$url"
  else
    printf '%-10s UNHEALTHY (%s)\n' "$name" "$url" >&2
    failed=true
  fi
done

api_domain=$(dotenv_get API_DOMAIN "$ENV_FILE")
for metrics_path in /api/metrics /api/metrics/ /API/metrics /api/METRICS /Api/MeTrIcS; do
  metrics_status=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 -H "Host: $api_domain" "http://127.0.0.1$metrics_path" || true)
  if [[ "$metrics_status" == 404 ]]; then
    printf 'metrics    private (%s -> 404)\n' "$metrics_path"
  else
    printf 'metrics    UNSAFE/UNAVAILABLE (%s -> %s)\n' "$metrics_path" "${metrics_status:-none}" >&2
    failed=true
  fi
done

if sudo_command nginx -t >/dev/null 2>&1; then
  printf 'nginx      configuration valid\n'
else
  printf 'nginx      INVALID configuration\n' >&2
  failed=true
fi

cert_name=$(dotenv_get TLS_CERT_NAME "$ENV_FILE" "$(dotenv_get APP_DOMAIN "$ENV_FILE")")
if sudo_command test -r "/etc/letsencrypt/live/$cert_name/fullchain.pem"; then
  sudo_command openssl x509 -noout -enddate -in "/etc/letsencrypt/live/$cert_name/fullchain.pem"
elif is_true "$(dotenv_get TLS_ENABLED "$ENV_FILE" true)"; then
  printf 'tls        certificate missing\n' >&2
  failed=true
fi

if is_true "$(dotenv_get OBSERVABILITY_ENABLED "$ENV_FILE" true)"; then
  observability_sha=$(state_read observability-current)
  observability_env="$DEPLOY_ROOT/observability/observability.env"
  observability_script="$RELEASES_DIR/$observability_sha/deploy/observability/observability.sh"
  if [[ "$observability_sha" =~ ^[0-9a-f]{40}$ &&
        -r "$observability_env" && -r "$observability_script" ]]; then
    if ! OBSERVABILITY_ENV_FILE="$observability_env" \
         OBSERVABILITY_STATE_DIR="$DEPLOY_ROOT/observability" \
         bash "$observability_script" status; then
      printf 'observability UNHEALTHY\n' >&2
      failed=true
    fi
  else
    printf 'observability enabled but not installed\n' >&2
    failed=true
  fi
else
  printf 'observability disabled by configuration\n'
fi

[[ "$failed" == false ]]
