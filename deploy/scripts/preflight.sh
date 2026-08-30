#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=deploy/scripts/lib.sh
source "$SCRIPT_DIR/lib.sh"

ENV_FILE=${LINGDIAN_ENV_FILE:-/etc/lingdian/production.env}
RELEASE_DIR=$LINGDIAN_REPO_ROOT
RELEASE_SHA=${RELEASE_SHA:-}
HOST_ONLY=false

usage() {
  printf 'Usage: %s [--env PATH] [--release-dir PATH --sha SHA] [--host-only]\n' "${0##*/}"
}

while (($#)); do
  case "$1" in
    --env) ENV_FILE=${2:?--env requires a path}; shift 2 ;;
    --release-dir) RELEASE_DIR=${2:?--release-dir requires a path}; shift 2 ;;
    --sha) RELEASE_SHA=${2:?--sha requires a value}; shift 2 ;;
    --host-only) HOST_ONLY=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "Unknown argument: $1" ;;
  esac
done

need_command awk
need_command curl
need_command git
need_command openssl
need_command sha256sum
need_command tar
need_command python3
need_command flock

if [[ "$HOST_ONLY" == true ]]; then
  init_docker
  log 'Host preflight passed'
  exit 0
fi

load_deploy_config
init_docker

# Nginx configuration and Certbot are installed on the host after the database
# migration. Prove the deployment account can perform those privileged steps
# now, before any schema or bootstrap data can be changed.
if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  need_command sudo
  sudo -n true >/dev/null 2>&1 ||
    die 'The deployment account needs non-interactive sudo for Nginx/Certbot host operations'
fi

mode=$(stat -c '%a' "$ENV_FILE" 2>/dev/null || stat -f '%Lp' "$ENV_FILE" 2>/dev/null || true)
[[ -n "$mode" ]] || die "Cannot inspect permissions on $ENV_FILE"
(( (8#$mode & 077) == 0 )) || die "$ENV_FILE must not be accessible by group/others (expected mode 0600)"

required=(
  DEPLOY_PUBLIC_IPV4 APP_DOMAIN MERCHANT_DOMAIN ADMIN_DOMAIN API_DOMAIN TLS_EMAIL VITE_API_BASE API_PREFIX
  MYSQL_IMAGE BACKUP_ARCHIVE_IMAGE
  CORS_ALLOWED_ORIGINS DATABASE_URL PRIMARY_STORE_ID STORE_BOOTSTRAP_CODE STORE_BOOTSTRAP_NAME
  AUTH_JWT_ACCESS_SECRET AUTH_REFRESH_PEPPER TRUST_PROXY_HOPS
  SMS_WEBHOOK_URL SMS_WEBHOOK_TOKEN
  WECHAT_APP_ID WECHAT_APP_SECRET WECHAT_REDIRECT_URI WECHAT_MINI_APP_ID WECHAT_MINI_APP_SECRET
  QQ_APP_ID QQ_APP_KEY QQ_REDIRECT_URI QQ_MINI_APP_ID QQ_MINI_APP_SECRET
)
if [[ ! -r "$STATE_DIR/bootstrap-complete" ]]; then
  required+=(
    AUTH_BOOTSTRAP_SUPER_ADMIN_USERNAME AUTH_BOOTSTRAP_SUPER_ADMIN_PASSWORD AUTH_BOOTSTRAP_SUPER_ADMIN_PHONE
    AUTH_BOOTSTRAP_MERCHANT_USERNAME AUTH_BOOTSTRAP_MERCHANT_PASSWORD AUTH_BOOTSTRAP_MERCHANT_PHONE
    AUTH_BOOTSTRAP_MERCHANT_STORE_IDS
  )
fi
if [[ "$DATABASE_MODE" == local ]]; then
  required+=(MYSQL_DATABASE MYSQL_USER MYSQL_PASSWORD MYSQL_ROOT_PASSWORD)
else
  required+=(EXTERNAL_MYSQL_SSL_MODE EXTERNAL_MYSQL_SSL_CA)
fi

for key in "${required[@]}"; do
  value=$(dotenv_get "$key" "$ENV_FILE")
  [[ -n "$value" ]] || die "$key is required in $ENV_FILE"
  [[ "$value" != *CHANGE_ME* ]] || die "$key still contains a CHANGE_ME placeholder"
done

python3 - "$ENV_FILE" "$DATABASE_MODE" <<'PY'
import re
import ipaddress
import socket
import sys
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

path, mode = sys.argv[1:]
env = {}
for original in Path(path).read_text(encoding='utf-8').splitlines():
    line = original.strip()
    if not line or line.startswith('#'):
        continue
    if line.startswith('export '):
        line = line[7:].lstrip()
    if '=' not in line:
        continue
    key, value = line.split('=', 1)
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "'\"":
        value = value[1:-1]
    env[key.strip()] = value

def fail(message):
    raise SystemExit(f'Environment preflight failed: {message}')

domains = [env[k].lower() for k in ('APP_DOMAIN', 'MERCHANT_DOMAIN', 'ADMIN_DOMAIN', 'API_DOMAIN')]
if len(set(domains)) != 4:
    fail('APP/MERCHANT/ADMIN/API domains must be distinct')
for domain in domains:
    if not re.fullmatch(r'(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}', domain):
        fail(f'invalid public domain: {domain}')
try:
    public_ip = str(ipaddress.IPv4Address(env['DEPLOY_PUBLIC_IPV4']))
except ValueError:
    fail('DEPLOY_PUBLIC_IPV4 must be a valid IPv4 address')
for domain in domains:
    try:
        resolved = {item[4][0] for item in socket.getaddrinfo(domain, 443, socket.AF_INET, socket.SOCK_STREAM)}
    except OSError as error:
        fail(f'DNS lookup failed for {domain}: {error}')
    if resolved != {public_ip}:
        actual = ', '.join(sorted(resolved)) or '(none)'
        fail(f'{domain} A records must resolve exclusively to DEPLOY_PUBLIC_IPV4={public_ip}; found {actual}')
    try:
        ipv6 = {item[4][0] for item in socket.getaddrinfo(domain, 443, socket.AF_INET6, socket.SOCK_STREAM)}
    except socket.gaierror as error:
        no_record_errors = {socket.EAI_NONAME}
        if hasattr(socket, 'EAI_NODATA'):
            no_record_errors.add(socket.EAI_NODATA)
        if error.errno not in no_record_errors:
            fail(f'AAAA DNS lookup failed for {domain}: {error}')
        ipv6 = set()
    if ipv6:
        fail(f'{domain} has an AAAA record, but this deployment profile is IPv4-only; remove the AAAA record')
if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', env['TLS_EMAIL']):
    fail('TLS_EMAIL is invalid')
expected_api = f"https://{env['API_DOMAIN']}/api"
if env['VITE_API_BASE'].rstrip('/') != expected_api:
    fail(f'VITE_API_BASE must be {expected_api}')
expected_origins = {f"https://{env[k]}" for k in ('APP_DOMAIN', 'MERCHANT_DOMAIN', 'ADMIN_DOMAIN')}
actual_origins = {item.strip().rstrip('/') for item in env['CORS_ALLOWED_ORIGINS'].split(',') if item.strip()}
if actual_origins != expected_origins:
    fail('CORS_ALLOWED_ORIGINS must contain exactly the three HTTPS frontend origins')
if env.get('NODE_ENV') != 'production' or env.get('STORE_MODE') != 'single' or env.get('API_PREFIX') != 'api':
    fail('NODE_ENV=production, STORE_MODE=single, and API_PREFIX=api are required')
if env.get('TLS_ENABLED') != 'true':
    fail('TLS_ENABLED=true is required by the production deployment profile')
if env.get('TLS_STAGING') != 'false':
    fail('TLS_STAGING=false is required by the production deployment profile')
if env.get('TRUST_PROXY_HOPS') != '1':
    fail('TRUST_PROXY_HOPS=1 is required behind the single host Nginx proxy')
if env.get('AUTH_COOKIE_SECURE') != 'true' or env.get('SMS_PROVIDER') != 'webhook':
    fail('AUTH_COOKIE_SECURE=true and SMS_PROVIDER=webhook are required')
if env.get('AUTH_BOOTSTRAP_MERCHANT_STORE_IDS') and env.get('AUTH_BOOTSTRAP_MERCHANT_STORE_IDS') != env.get('PRIMARY_STORE_ID'):
    fail('AUTH_BOOTSTRAP_MERCHANT_STORE_IDS must equal PRIMARY_STORE_ID')
for key in ('AUTH_JWT_ACCESS_SECRET', 'AUTH_REFRESH_PEPPER'):
    if len(env.get(key, '')) < 32:
        fail(f'{key} must contain at least 32 characters')
if env['AUTH_JWT_ACCESS_SECRET'] == env['AUTH_REFRESH_PEPPER']:
    fail('AUTH_JWT_ACCESS_SECRET and AUTH_REFRESH_PEPPER must be different secrets')
if len(env.get('SMS_WEBHOOK_TOKEN', '')) < 32:
    fail('SMS_WEBHOOK_TOKEN must contain at least 32 characters')
for key in ('MYSQL_IMAGE', 'BACKUP_ARCHIVE_IMAGE'):
    image = env.get(key, '')
    reference, separator, digest = image.rpartition('@sha256:')
    final_component = reference.rsplit('/', 1)[-1]
    if separator != '@sha256:' or not re.fullmatch(r'[0-9a-f]{64}', digest) or ':' not in final_component:
        fail(f'{key} must use an immutable name:tag@sha256:<64 hex> reference')
    if final_component.rsplit(':', 1)[-1] == 'latest':
        fail(f'{key} must not use the latest tag, even with a digest')
if env.get('AUTH_ACCESS_TOKEN_TTL_SECONDS') != '900' or env.get('AUTH_REFRESH_TOKEN_TTL_DAYS') != '30':
    fail('production token TTL values must be AUTH_ACCESS_TOKEN_TTL_SECONDS=900 and AUTH_REFRESH_TOKEN_TTL_DAYS=30')
password_pattern = re.compile(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$')
for key in ('AUTH_BOOTSTRAP_SUPER_ADMIN_PASSWORD', 'AUTH_BOOTSTRAP_MERCHANT_PASSWORD'):
    if env.get(key) and not password_pattern.fullmatch(env.get(key, '')):
        fail(f'{key} must be at least 12 characters and contain upper/lowercase, a number and a symbol')
if env.get('AUTH_BOOTSTRAP_SUPER_ADMIN_PASSWORD') and env.get('AUTH_BOOTSTRAP_SUPER_ADMIN_PASSWORD') == env.get('AUTH_BOOTSTRAP_MERCHANT_PASSWORD'):
    fail('initial admin and merchant passwords must be different')
parsed = urlparse(env['DATABASE_URL'])
if parsed.scheme != 'mysql' or not parsed.hostname or not parsed.path.strip('/'):
    fail('DATABASE_URL must be an absolute mysql:// URL with a database name')
if mode == 'local':
    for key in ('MYSQL_DATABASE', 'MYSQL_USER'):
        if not re.fullmatch(r'[A-Za-z0-9_]+', env.get(key, '')):
            fail(f'{key} may contain only letters, numbers and underscore')
    if parsed.hostname != 'db':
        fail('local DATABASE_URL hostname must be db')
    if unquote(parsed.username or '') != env.get('MYSQL_USER'):
        fail('DATABASE_URL username must equal MYSQL_USER')
    if unquote(parsed.password or '') != env.get('MYSQL_PASSWORD'):
        fail('DATABASE_URL password must equal MYSQL_PASSWORD (URL-encode reserved characters)')
    if parsed.path.strip('/') != env.get('MYSQL_DATABASE'):
        fail('DATABASE_URL database must equal MYSQL_DATABASE')
    if parse_qs(parsed.query).get('allowPublicKeyRetrieval') != ['true']:
        fail('local mysql:8.4 DATABASE_URL must include allowPublicKeyRetrieval=true on the private Compose network')
else:
    query = parse_qs(parsed.query)
    if query.get('allowPublicKeyRetrieval') == ['true']:
        fail('external DATABASE_URL must not enable allowPublicKeyRetrieval')
    if query.get('sslaccept') != ['strict'] or query.get('sslcert') != ['external-mysql-ca.pem']:
        fail('external DATABASE_URL must include sslaccept=strict and sslcert=external-mysql-ca.pem')
    if env.get('EXTERNAL_MYSQL_SSL_MODE') != 'VERIFY_IDENTITY':
        fail('EXTERNAL_MYSQL_SSL_MODE=VERIFY_IDENTITY is required for external databases')
for key in ('SMS_WEBHOOK_URL', 'WECHAT_REDIRECT_URI', 'QQ_REDIRECT_URI'):
    if urlparse(env[key]).scheme != 'https':
        fail(f'{key} must use HTTPS')
alert_webhook = env.get('ALERT_WEBHOOK_URL', '').strip()
if alert_webhook:
    parsed_alert_webhook = urlparse(alert_webhook)
    if re.search(r'\s', alert_webhook) or parsed_alert_webhook.scheme != 'https' or not parsed_alert_webhook.hostname:
        fail('ALERT_WEBHOOK_URL must be empty or an absolute HTTPS URL')
PY

if [[ "$DATABASE_MODE" == external ]]; then
  external_ca=$(dotenv_get EXTERNAL_MYSQL_SSL_CA "$ENV_FILE")
  validate_absolute_path EXTERNAL_MYSQL_SSL_CA "$external_ca"
  [[ -f "$external_ca" && -r "$external_ca" ]] ||
    die "EXTERNAL_MYSQL_SSL_CA must be a readable CA certificate file: $external_ca"
  openssl x509 -in "$external_ca" -noout >/dev/null 2>&1 ||
    die "EXTERNAL_MYSQL_SSL_CA is not a readable PEM certificate: $external_ca"
fi
if [[ -z "$(dotenv_get ALERT_WEBHOOK_URL "$ENV_FILE")" ]]; then
  warn 'ALERT_WEBHOOK_URL is empty; alerts will remain visible only in local Alertmanager/Grafana'
fi

ensure_runtime_dirs
prepare_runtime_envs
[[ -d "$DATA_DIR/mysql" ]] || mkdir -p -- "$DATA_DIR/mysql"
uploads_owner=$(stat -c '%u' "$DATA_DIR/uploads" 2>/dev/null || stat -f '%u' "$DATA_DIR/uploads")
uploads_mode=$(stat -c '%a' "$DATA_DIR/uploads" 2>/dev/null || stat -f '%Lp' "$DATA_DIR/uploads")
[[ "$uploads_owner" == 1000 ]] || die "$DATA_DIR/uploads must be owned by API uid 1000 (found uid $uploads_owner)"
(( (8#$uploads_mode & 0200) != 0 )) || die "$DATA_DIR/uploads owner uid 1000 does not have write permission"

need_command ss
port_entries='API_PORT:9000:core APP_PORT:8082:core MERCHANT_PORT:8083:core ADMIN_PORT:8084:core'
if is_true "$(dotenv_get OBSERVABILITY_ENABLED "$ENV_FILE" true)"; then
  port_entries+=' GRAFANA_PORT:3001:observability PROMETHEUS_PORT:9090:observability ALERTMANAGER_PORT:9093:observability'
fi
for port_entry in $port_entries; do
  port_key=${port_entry%%:*}
  port_rest=${port_entry#*:}
  port_default=${port_rest%%:*}
  port_owner=${port_rest#*:}
  port=$(dotenv_get "$port_key" "$ENV_FILE" "$port_default")
  if ss -H -ltn "sport = :$port" | grep -q .; then
    expected_project=$COMPOSE_PROJECT_NAME
    expected_service=${port_key%_PORT}
    expected_service=${expected_service,,}
    [[ "$port_owner" == core ]] || expected_project=lingdian-observability
    owning_containers=$("${DOCKER[@]}" ps --filter "publish=$port" \
      --format '{{.Label "com.docker.compose.project"}}:{{.Label "com.docker.compose.service"}}' | sort -u)
    [[ "$owning_containers" == "$expected_project:$expected_service" ]] ||
      die "$port_key=$port is already used outside expected Compose service $expected_project:$expected_service"
  fi
done

if [[ -z "$RELEASE_SHA" ]]; then
  RELEASE_SHA=$(git -C "$RELEASE_DIR" rev-parse HEAD)
fi
if [[ ! -r "$RELEASE_DIR/.lingdian-release-sha" ]]; then
  marker_temp=$(mktemp "$RELEASE_DIR/.lingdian-release-sha.preflight.XXXXXX")
  printf '%s\n' "$RELEASE_SHA" >"$marker_temp"
  mv -f "$marker_temp" "$RELEASE_DIR/.lingdian-release-sha"
  remove_marker=true
else
  remove_marker=false
fi
trap '[[ ${remove_marker:-false} == true ]] && rm -f "$RELEASE_DIR/.lingdian-release-sha"' EXIT
use_release "$RELEASE_DIR" "$RELEASE_SHA"
compose config --quiet

intent_sha=$(state_read observability-intent)
pending_sha=$(state_read observability-pending)
stopped_sha=$(state_read observability-core-stopped)
deployed_sha=$(state_read current)
if [[ -n "$intent_sha" ]]; then
  [[ "$intent_sha" =~ ^[0-9a-f]{40}$ ]] ||
    die "Invalid observability deployment intent: $intent_sha"
  [[ "$RELEASE_SHA" == "$intent_sha" ]] ||
    die "Observability deployment/recovery is incomplete for $intent_sha; retry that exact release before upgrading"
fi
if [[ -n "$pending_sha" || -n "$stopped_sha" ]]; then
  [[ "$pending_sha" =~ ^[0-9a-f]{40}$ && "$pending_sha" == "$deployed_sha" ]] ||
    die 'Observability pending/current state is inconsistent; manual recovery is required before deploying'
  [[ -z "$stopped_sha" || "$stopped_sha" == "$pending_sha" ]] ||
    die 'Observability core-stop state is inconsistent; manual recovery is required before deploying'
  [[ "$RELEASE_SHA" == "$pending_sha" ]] ||
    die "Observability recovery is pending for $pending_sha; retry that exact release before upgrading"
fi

if is_true "$(dotenv_get OBSERVABILITY_ENABLED "$ENV_FILE" true)"; then
  for artifact in \
    deploy/observability/observability.sh \
    deploy/observability/compose.yml \
    deploy/observability/.env.example; do
    [[ -r "$RELEASE_DIR/$artifact" ]] ||
      die "Observability is enabled but the target release is missing: $artifact"
  done
  bash -n "$RELEASE_DIR/deploy/observability/observability.sh" ||
    die 'Target observability entrypoint failed shell syntax validation'

  observability_dir="$DEPLOY_ROOT/observability"
  validate_directory_target OBSERVABILITY_DIRECTORY "$observability_dir"
  observability_env="$observability_dir/observability.env"
  if [[ -e "$observability_env" ]]; then
    [[ -f "$observability_env" && ! -L "$observability_env" && -r "$observability_env" ]] ||
      die "Observability environment must be a readable regular non-symlink file: $observability_env"
  fi

  observability_sha=$(state_read observability-current)
  if [[ -n "$observability_sha" ]]; then
    [[ "$observability_sha" =~ ^[0-9a-f]{40}$ ]] ||
      die "Invalid observability-current state: $observability_sha"
    [[ -r "$RELEASES_DIR/$observability_sha/deploy/observability/observability.sh" ]] ||
      die "The retained observability release is unavailable: $observability_sha"
    [[ -r "$observability_env" ]] ||
      die 'The retained observability release has no persistent environment to restore'
  fi
fi

minimum_disk_gb=8
minimum_memory_gb=4
if is_true "$(dotenv_get OBSERVABILITY_ENABLED "$ENV_FILE" true)"; then
  minimum_disk_gb=40
  minimum_memory_gb=8
fi
min_free_kb=$((minimum_disk_gb * 1024 * 1024))
docker_root=$("${DOCKER[@]}" info --format '{{.DockerRootDir}}' 2>/dev/null) ||
  die 'Cannot determine the Docker data root for capacity preflight'
[[ "$docker_root" == /* && -d "$docker_root" ]] ||
  die "Docker reported an invalid data root: ${docker_root:-empty}"
for storage_entry in "deployment:$DEPLOY_ROOT" "docker:$docker_root"; do
  storage_name=${storage_entry%%:*}
  storage_path=${storage_entry#*:}
  free_kb=$(df -Pk "$storage_path" | awk 'NR==2 {print $4}')
  [[ "$free_kb" =~ ^[0-9]+$ ]] || die "Cannot determine free space for $storage_name storage: $storage_path"
  (( free_kb >= min_free_kb )) ||
    die "At least $minimum_disk_gb GiB free disk is required for $storage_name storage at $storage_path"
done
memory_kb=$(awk '/MemTotal:/ {print $2}' /proc/meminfo 2>/dev/null || printf '0')
(( memory_kb == 0 || memory_kb >= minimum_memory_gb * 1024 * 1024 )) ||
  die "At least $minimum_memory_gb GiB RAM is required with the current deployment profile"

log "Deployment preflight passed for release $RELEASE_SHA"
