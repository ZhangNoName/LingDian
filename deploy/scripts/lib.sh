#!/usr/bin/env bash

# Shared helpers for LingDian deployment scripts. This file is sourced; callers
# are expected to enable `set -Eeuo pipefail` themselves.

# Non-interactive SSH sessions on minimal Debian often omit sbin directories,
# even though Nginx and other required host tools are installed there. Keep the
# production system path authoritative. Explicit test-layout fixtures retain
# their injected command directory so destructive operations stay mocked.
if [[ ${LINGDIAN_ALLOW_TEST_LAYOUT:-false} == true ]]; then
  export PATH="${PATH:+$PATH:}/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
else
  export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin${PATH:+:$PATH}"
fi

readonly LINGDIAN_SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
readonly LINGDIAN_REPO_ROOT=$(cd -- "$LINGDIAN_SCRIPT_DIR/../.." && pwd -P)

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S%z')" "$*"
}

warn() {
  printf '[%s] WARN: %s\n' "$(date '+%Y-%m-%d %H:%M:%S%z')" "$*" >&2
}

die() {
  printf '[%s] ERROR: %s\n' "$(date '+%Y-%m-%d %H:%M:%S%z')" "$*" >&2
  exit 1
}

need_command() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

is_true() {
  case "${1:-}" in
    1|true|TRUE|yes|YES|on|ON) return 0 ;;
    *) return 1 ;;
  esac
}

dotenv_get() {
  local key=$1 file=${2:-${ENV_FILE:-}} default=${3-} raw value
  [[ -n "$file" && -r "$file" ]] || {
    printf '%s' "$default"
    return 0
  }
  raw=$(awk -v wanted="$key" '
    /^[[:space:]]*#/ { next }
    {
      line=$0
      sub(/^[[:space:]]*export[[:space:]]+/, "", line)
      pos=index(line, "=")
      if (pos == 0) next
      name=substr(line, 1, pos - 1)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", name)
      if (name == wanted) value=substr(line, pos + 1)
    }
    END { if (value != "") printf "%s", value }
  ' "$file")
  if [[ -z "$raw" ]]; then
    printf '%s' "$default"
    return 0
  fi
  value=$raw
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  if [[ ${#value} -ge 2 ]]; then
    if [[ ${value:0:1} == '"' && ${value: -1} == '"' ]] ||
       [[ ${value:0:1} == "'" && ${value: -1} == "'" ]]; then
      value=${value:1:${#value}-2}
    fi
  fi
  printf '%s' "$value"
}

validate_absolute_path() {
  local name=$1 value=$2
  [[ "$value" == /* ]] || die "$name must be an absolute path: $value"
  [[ "$value" =~ ^/[A-Za-z0-9._/-]+$ ]] || die "$name contains unsupported characters: $value"
  case "$value" in
    /|/bin|/boot|/data|/dev|/etc|/home|/lib|/lib64|/media|/mnt|/opt|/proc|/root|/run|/sbin|/srv|/sys|/tmp|/usr|/var)
      die "$name is too broad and unsafe: $value"
      ;;
  esac
  [[ "$value" != */ && "$value" != *//* && "$value" != *'/../'* && "$value" != */.. &&
     "$value" != *'/./'* && "$value" != */. ]] ||
    die "$name must be normalized: $value"
}

validate_no_symlink_components() {
  local name=$1 value=$2 component current=
  local -a components=()
  IFS='/' read -r -a components <<<"${value#/}"
  for component in "${components[@]}"; do
    [[ -n "$component" ]] || continue
    current="$current/$component"
    [[ ! -L "$current" ]] ||
      die "$name must not contain symbolic-link path components: $current"
  done
}

validate_directory_target() {
  local name=$1 value=$2 probe=$2 suffix= leaf physical canonical
  validate_absolute_path "$name" "$value"
  validate_no_symlink_components "$name" "$value"

  # Resolve the deepest existing ancestor physically and append the missing
  # suffix. Together with the symlink-component rejection and normalized input,
  # this makes string containment checks match filesystem containment before a
  # privileged mkdir/chown/mount operation follows the path.
  while [[ ! -e "$probe" ]]; do
    leaf=${probe##*/}
    suffix="/$leaf$suffix"
    probe=${probe%/*}
    [[ -n "$probe" ]] || probe=/
  done
  [[ -d "$probe" ]] || die "$name has a non-directory ancestor: $probe"
  physical=$(cd -P -- "$probe" 2>/dev/null && pwd -P) ||
    die "Cannot resolve the existing ancestor for $name: $probe"
  if [[ "$physical" == / ]]; then
    canonical="/${suffix#/}"
  else
    canonical="$physical$suffix"
  fi
  [[ "$canonical" == "$value" ]] ||
    die "$name does not resolve to its normalized path ($value -> $canonical)"
}

validate_environment_location() {
  local value=$1
  case "$value" in
    /etc/lingdian/*) ;;
    /tmp/*|/private/var/*|/var/folders/*)
      is_true "${LINGDIAN_ALLOW_TEST_LAYOUT:-false}" ||
        die "Production ENV_FILE must be stored under /etc/lingdian: $value"
      ;;
    *) die "Production ENV_FILE must be stored under /etc/lingdian: $value" ;;
  esac
}

compose_version_is_supported() {
  local version=${1#v} major minor
  [[ "$version" =~ ^([0-9]+)\.([0-9]+)(\.[0-9]+)?([+-].*)?$ ]] || return 1
  major=${BASH_REMATCH[1]}
  minor=${BASH_REMATCH[2]}
  (( major > 2 || (major == 2 && minor >= 30) ))
}

validate_boolean_key() {
  local key=$1 default=$2 value
  value=$(dotenv_get "$key" "$ENV_FILE" "$default")
  [[ "$value" == true || "$value" == false ]] ||
    die "$key must be exactly true or false (found: ${value:-empty})"
}

validate_deployment_booleans() {
  local entry
  for entry in \
    BACKUP_ON_DEPLOY:true AUTO_CLEANUP_RELEASES:true AUTO_ROLLBACK:true \
    SCRUB_BOOTSTRAP_CREDENTIALS:true TLS_ENABLED:true TLS_STAGING:false \
    OBSERVABILITY_ENABLED:true SWAGGER_ENABLED:false ALLOW_DEMO_SEED:false \
    AUTH_COOKIE_SECURE:true INTEGRATION_CASHIER_ENABLED:false \
    INTEGRATION_RECEIPT_ENABLED:false INTEGRATION_MEITUAN_ENABLED:false \
    INTEGRATION_JD_ENABLED:false; do
    validate_boolean_key "${entry%%:*}" "${entry#*:}"
  done
}

validate_deployment_ports() {
  local entry key default port seen=' '
  local entries='API_PORT:9000 APP_PORT:8082 MERCHANT_PORT:8083 ADMIN_PORT:8084'
  if is_true "$(dotenv_get OBSERVABILITY_ENABLED "$ENV_FILE" true)"; then
    entries+=' GRAFANA_PORT:3001 PROMETHEUS_PORT:9090 ALERTMANAGER_PORT:9093'
  fi
  for entry in $entries; do
    key=${entry%%:*}
    default=${entry#*:}
    port=$(dotenv_get "$key" "$ENV_FILE" "$default")
    [[ "$port" =~ ^[0-9]{1,5}$ ]] && ((port >= 1 && port <= 65535)) ||
      die "$key must be an integer from 1 to 65535 (found: ${port:-empty})"
    [[ "$seen" != *" $port "* ]] ||
      die "$key=$port duplicates another LingDian host port"
    seen+="$port "
  done
}

validate_deployment_layout() {
  local deploy_leaf=${DEPLOY_ROOT##*/}
  validate_directory_target DEPLOY_ROOT "$DEPLOY_ROOT"
  case "$DEPLOY_ROOT" in
    /opt/*|/srv/*|/var/lib/*|/var/opt/*) ;;
    /tmp/*|/private/var/*|/var/folders/*)
      is_true "${LINGDIAN_ALLOW_TEST_LAYOUT:-false}" ||
        die "DEPLOY_ROOT must not use an ephemeral/private-tmp path: $DEPLOY_ROOT"
      ;;
    *)
      die "DEPLOY_ROOT must be a dedicated LingDian directory under an approved data root: $DEPLOY_ROOT"
      ;;
  esac
  [[ "$deploy_leaf" == lingdian || "$deploy_leaf" == lingdian-* || "$deploy_leaf" == lingdian_* ]] ||
    die "DEPLOY_ROOT final directory must be named lingdian, lingdian-*, or lingdian_*: $DEPLOY_ROOT"

  local name path existing deployment_paths=''
  for name in DATA_DIR BACKUP_DIR RELEASES_DIR STATE_DIR; do
    path=${!name}
    validate_directory_target "$name" "$path"
    [[ "$path" == "$DEPLOY_ROOT/"* ]] || die "$name must be a child of DEPLOY_ROOT ($DEPLOY_ROOT): $path"
    for existing in $deployment_paths; do
      [[ "$path" != "$existing" && "$path" != "$existing/"* && "$existing" != "$path/"* ]] ||
        die "$name must not overlap another deployment directory: $path and $existing"
    done
    deployment_paths+="${deployment_paths:+ }$path"
  done

  validate_directory_target MYSQL_DATA_DIRECTORY "$DATA_DIR/mysql"
  validate_directory_target UPLOADS_DIRECTORY "$DATA_DIR/uploads"
}

load_deploy_config() {
  ENV_FILE=${ENV_FILE:-/etc/lingdian/production.env}
  [[ -f "$ENV_FILE" && ! -L "$ENV_FILE" && -r "$ENV_FILE" ]] ||
    die "Production environment must be a readable regular file: $ENV_FILE"
  validate_absolute_path ENV_FILE "$ENV_FILE"
  validate_environment_location "$ENV_FILE"
  validate_no_symlink_components ENV_FILE "$ENV_FILE"
  local env_dir
  env_dir=$(dirname -- "$ENV_FILE")
  validate_directory_target ENV_DIRECTORY "$env_dir"
  ENV_FILE=$(cd -P -- "$env_dir" && printf '%s/%s' "$PWD" "$(basename -- "$ENV_FILE")")
  validate_deployment_booleans

  DEPLOY_ROOT=$(dotenv_get DEPLOY_ROOT "$ENV_FILE" /opt/lingdian)
  DATA_DIR=$(dotenv_get DATA_DIR "$ENV_FILE" "$DEPLOY_ROOT/data")
  BACKUP_DIR=$(dotenv_get BACKUP_DIR "$ENV_FILE" "$DEPLOY_ROOT/backups")
  RELEASES_DIR=$(dotenv_get RELEASES_DIR "$ENV_FILE" "$DEPLOY_ROOT/releases")
  STATE_DIR=$(dotenv_get STATE_DIR "$ENV_FILE" "$DEPLOY_ROOT/state")
  DATABASE_MODE=$(dotenv_get DATABASE_MODE "$ENV_FILE" local)
  COMPOSE_PROJECT_NAME=$(dotenv_get COMPOSE_PROJECT_NAME "$ENV_FILE" lingdian)
  COMPOSE_NETWORK=$(dotenv_get COMPOSE_NETWORK "$ENV_FILE" lingdian)

  validate_absolute_path DEPLOY_ROOT "$DEPLOY_ROOT"
  validate_absolute_path DATA_DIR "$DATA_DIR"
  validate_absolute_path BACKUP_DIR "$BACKUP_DIR"
  validate_absolute_path RELEASES_DIR "$RELEASES_DIR"
  validate_absolute_path STATE_DIR "$STATE_DIR"
  validate_deployment_layout
  [[ "$DATABASE_MODE" == local || "$DATABASE_MODE" == external ]] ||
    die 'DATABASE_MODE must be local or external'
  [[ "$COMPOSE_PROJECT_NAME" =~ ^lingdian([-_][a-z0-9][a-z0-9_-]*)?$ ]] ||
    die "COMPOSE_PROJECT_NAME must be lingdian or start with lingdian-/lingdian_: $COMPOSE_PROJECT_NAME"
  [[ "$COMPOSE_NETWORK" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]] ||
    die "Invalid COMPOSE_NETWORK: $COMPOSE_NETWORK"
  validate_deployment_ports
}

write_runtime_env() {
  local destination=$1 include_bootstrap=${2:-false} tmp line key value
  tmp=$(mktemp "$STATE_DIR/.runtime-env.XXXXXX")
  chmod 0600 "$tmp"
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)= ]] || continue
    key=${BASH_REMATCH[2]}
    value=${line#*=}
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    if [[ ${#value} -ge 2 ]] && { [[ ${value:0:1} == '"' && ${value: -1} == '"' ]] ||
      [[ ${value:0:1} == "'" && ${value: -1} == "'" ]]; }; then
      value=${value:1:${#value}-2}
    fi
    case "$key" in
      PORT|API_PREFIX|NODE_ENV|TRUST_PROXY_HOPS|SWAGGER_ENABLED|DATABASE_MODE|DATABASE_URL|STORE_MODE|PRIMARY_STORE_ID|ALLOW_DEMO_SEED|CORS_ALLOWED_ORIGINS|AUTH_JWT_ACCESS_SECRET|AUTH_REFRESH_PEPPER|AUTH_ACCESS_TOKEN_TTL_SECONDS|AUTH_REFRESH_TOKEN_TTL_DAYS|AUTH_COOKIE_SECURE|WECHAT_APP_ID|WECHAT_APP_SECRET|WECHAT_REDIRECT_URI|WECHAT_MINI_APP_ID|WECHAT_MINI_APP_SECRET|QQ_APP_ID|QQ_APP_KEY|QQ_REDIRECT_URI|QQ_MINI_APP_ID|QQ_MINI_APP_SECRET|SMS_PROVIDER|SMS_WEBHOOK_URL|SMS_WEBHOOK_TOKEN|INTEGRATION_CASHIER_ENABLED|INTEGRATION_CASHIER_CONNECTOR_URL|INTEGRATION_CASHIER_SIGNING_SECRET|INTEGRATION_RECEIPT_ENABLED|INTEGRATION_RECEIPT_CONNECTOR_URL|INTEGRATION_RECEIPT_SIGNING_SECRET|INTEGRATION_MEITUAN_ENABLED|INTEGRATION_MEITUAN_CONNECTOR_URL|INTEGRATION_MEITUAN_SIGNING_SECRET|INTEGRATION_JD_ENABLED|INTEGRATION_JD_CONNECTOR_URL|INTEGRATION_JD_SIGNING_SECRET|PAYMENT_CONNECTOR_*_URL|PAYMENT_CONNECTOR_*_SECRET)
        printf '%s=%s\n' "$key" "$value" >>"$tmp"
        ;;
      STORE_BOOTSTRAP_CODE|STORE_BOOTSTRAP_NAME|STORE_BOOTSTRAP_*|AUTH_BOOTSTRAP_*)
        [[ "$include_bootstrap" == true ]] && printf '%s=%s\n' "$key" "$value" >>"$tmp"
        ;;
    esac
  done <"$ENV_FILE"
  [[ -s "$tmp" ]] || { rm -f "$tmp"; die 'Generated API runtime environment is empty'; }
  mv -f -- "$tmp" "$destination"
  chmod 0600 "$destination"
}

prepare_runtime_envs() {
  API_RUNTIME_ENV="$STATE_DIR/api-runtime.env"
  BOOTSTRAP_RUNTIME_ENV="$STATE_DIR/bootstrap-runtime.env"
  DB_CA_RUNTIME_FILE="$STATE_DIR/external-mysql-ca.pem"
  write_runtime_env "$API_RUNTIME_ENV" false
  if [[ ! -r "$STATE_DIR/bootstrap-complete" ]]; then
    write_runtime_env "$BOOTSTRAP_RUNTIME_ENV" true
  else
    rm -f -- "$BOOTSTRAP_RUNTIME_ENV"
  fi

  local ca_tmp ca_source
  ca_tmp=$(mktemp "$STATE_DIR/.external-mysql-ca.XXXXXX")
  if [[ "$DATABASE_MODE" == external ]]; then
    ca_source=$(dotenv_get EXTERNAL_MYSQL_SSL_CA "$ENV_FILE")
    [[ -f "$ca_source" && -r "$ca_source" ]] || {
      rm -f -- "$ca_tmp"
      die "External MySQL CA certificate is not readable: $ca_source"
    }
    cp -- "$ca_source" "$ca_tmp"
  else
    : >"$ca_tmp"
  fi
  chmod 0444 "$ca_tmp"
  mv -f -- "$ca_tmp" "$DB_CA_RUNTIME_FILE"
}

scrub_bootstrap_credentials() (
  set -Eeuo pipefail
  is_true "$(dotenv_get SCRUB_BOOTSTRAP_CREDENTIALS "$ENV_FILE" true)" || return 0
  local sanitized_tmp privileged_tmp= line key owner
  sanitized_tmp=$(mktemp "$STATE_DIR/.production-env-scrubbed.XXXXXX")
  chmod 0600 "$sanitized_tmp"
  cleanup_scrub() {
    rm -f -- "$sanitized_tmp"
    if [[ -n "$privileged_tmp" ]]; then
      sudo_command rm -f -- "$privileged_tmp" >/dev/null 2>&1 || true
    fi
  }
  trap cleanup_scrub EXIT
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" =~ ^([[:space:]]*(export[[:space:]]+)?)(AUTH_BOOTSTRAP_[A-Z0-9_]+)([[:space:]]*)= ]]; then
      key=${BASH_REMATCH[3]}
      printf '%s%s%s=\n' "${BASH_REMATCH[1]}" "$key" "${BASH_REMATCH[4]}" >>"$sanitized_tmp"
    else
      printf '%s\n' "$line" >>"$sanitized_tmp"
    fi
  done <"$ENV_FILE"

  owner=$(stat -c '%u:%g' "$ENV_FILE" 2>/dev/null || stat -f '%u:%g' "$ENV_FILE" 2>/dev/null) ||
    die "Cannot inspect ownership on $ENV_FILE"
  [[ "$owner" =~ ^[0-9]+:[0-9]+$ ]] || die "Unexpected owner/group for $ENV_FILE: $owner"

  # bootstrap-host intentionally keeps /etc/lingdian non-writable by the
  # deployment account. Create and replace the file through non-interactive
  # sudo, while retaining its original numeric owner/group and mode.
  privileged_tmp=$(sudo_command mktemp "$(dirname -- "$ENV_FILE")/.production-env.XXXXXX")
  sudo_command install -o "${owner%%:*}" -g "${owner#*:}" -m 0600 -- \
    "$sanitized_tmp" "$privileged_tmp"
  sudo_command mv -f -- "$privileged_tmp" "$ENV_FILE"
  privileged_tmp=
  log 'Removed one-time account bootstrap credentials from the production environment'
)

ensure_runtime_dirs() {
  local path
  for path in "$DEPLOY_ROOT" "$DATA_DIR" "$DATA_DIR/uploads" "$BACKUP_DIR" "$RELEASES_DIR" "$STATE_DIR"; do
    mkdir -p -- "$path" || die "Cannot create runtime directory: $path (run bootstrap-host.sh first)"
  done
  validate_deployment_layout
  [[ -w "$DEPLOY_ROOT" && -w "$STATE_DIR" && -w "$RELEASES_DIR" && -w "$BACKUP_DIR" ]] ||
    die "Deployment directories are not writable by $(id -un); run bootstrap-host.sh"
}

init_docker() {
  need_command docker
  if docker info >/dev/null 2>&1; then
    DOCKER=(docker)
  elif command -v sudo >/dev/null 2>&1 && sudo -n docker info >/dev/null 2>&1; then
    DOCKER=(sudo -n docker)
  else
    die "Docker daemon is unavailable to $(id -un); log in again after bootstrap or configure passwordless Docker access"
  fi
  "${DOCKER[@]}" compose version >/dev/null 2>&1 || die 'Docker Compose v2 plugin is required'
  local compose_version
  compose_version=$("${DOCKER[@]}" compose version --short 2>/dev/null) ||
    die 'Cannot determine the Docker Compose version'
  compose_version_is_supported "$compose_version" ||
    die "Docker Compose 2.30.0+ is required for raw secret env files (found $compose_version)"
}

export_dotenv() {
  local file=$1 line key value
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)= ]] || continue
    key=${BASH_REMATCH[2]}
    value=${line#*=}
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    if [[ ${#value} -ge 2 ]] && { [[ ${value:0:1} == '"' && ${value: -1} == '"' ]] ||
      [[ ${value:0:1} == "'" && ${value: -1} == "'" ]]; }; then
      value=${value:1:${#value}-2}
    fi
    export "$key=$value"
  done <"$file"
}

use_release() {
  ACTIVE_RELEASE=$1
  ACTIVE_SHA=$2
  [[ "$ACTIVE_SHA" =~ ^[0-9a-f]{40}$ ]] || die "Invalid release SHA: $ACTIVE_SHA"
  [[ -r "$ACTIVE_RELEASE/deploy/compose.yml" ]] || die "Release has no compose file: $ACTIVE_RELEASE"
  local marker
  marker=$(<"$ACTIVE_RELEASE/.lingdian-release-sha") 2>/dev/null || die "Release marker missing: $ACTIVE_RELEASE"
  [[ "$marker" == "$ACTIVE_SHA" ]] || die "Release marker mismatch in $ACTIVE_RELEASE"
}

compose() (
  [[ -n ${ACTIVE_RELEASE:-} && -n ${ACTIVE_SHA:-} ]] || die 'No active release selected'
  local profile=() bootstrap_env=${BOOTSTRAP_RUNTIME_ENV:-$API_RUNTIME_ENV}
  [[ "$DATABASE_MODE" == local ]] && profile=(--profile local-db)
  [[ -r "$bootstrap_env" ]] || bootstrap_env=$API_RUNTIME_ENV
  # Export parsed values without eval so `$` in passwords/tokens remains
  # literal. /dev/null prevents Compose from reparsing the protected dotenv
  # file with interpolation semantics.
  export_dotenv "$ENV_FILE"
  LINGDIAN_ENV_FILE="$ENV_FILE" \
  LINGDIAN_API_ENV_FILE="${API_RUNTIME_ENV:?API runtime environment is not prepared}" \
  LINGDIAN_BOOTSTRAP_ENV_FILE="$bootstrap_env" \
  RELEASE_SHA="$ACTIVE_SHA" \
  DEPLOY_ROOT="$DEPLOY_ROOT" \
  DATA_DIR="$DATA_DIR" \
  BACKUP_DIR="$BACKUP_DIR" \
  RELEASES_DIR="$RELEASES_DIR" \
  STATE_DIR="$STATE_DIR" \
  COMPOSE_PROJECT_NAME="$COMPOSE_PROJECT_NAME" \
  COMPOSE_NETWORK="$COMPOSE_NETWORK" \
    "${DOCKER[@]}" compose \
      --env-file /dev/null \
      --project-directory "$ACTIVE_RELEASE/deploy" \
      -f "$ACTIVE_RELEASE/deploy/compose.yml" \
      "${profile[@]}" "$@"
)

state_read() {
  local name=$1
  if [[ -r "$STATE_DIR/$name" ]]; then
    tr -d '\r\n' <"$STATE_DIR/$name"
  fi
  return 0
}

state_write() {
  local name=$1 value=$2 tmp
  tmp=$(mktemp "$STATE_DIR/.${name}.XXXXXX")
  chmod 0600 "$tmp"
  printf '%s\n' "$value" >"$tmp"
  mv -f -- "$tmp" "$STATE_DIR/$name"
}

require_observability_transaction_clear() {
  local operation=${1:-change release state} intent_sha pending_sha stopped_sha
  intent_sha=$(state_read observability-intent)
  pending_sha=$(state_read observability-pending)
  stopped_sha=$(state_read observability-core-stopped)
  if [[ -n "$intent_sha" || -n "$pending_sha" || -n "$stopped_sha" ]]; then
    die "Cannot $operation while observability recovery is incomplete (intent=${intent_sha:-none}, pending=${pending_sha:-none}, core-stopped=${stopped_sha:-none}); retry deploy-all.sh for that exact release, or set OBSERVABILITY_ENABLED=false and retry it to complete recovery"
  fi
}

validate_current_release_pointer() {
  local pointer="$DEPLOY_ROOT/current"
  [[ ! -e "$pointer" || -L "$pointer" ]] ||
    die "Release pointer must be absent or a symbolic link, never a real file/directory: $pointer"
}

atomic_update_current_release_pointer() (
  local target=$1 pointer="$DEPLOY_ROOT/current" temp_dir temp_link
  [[ "$target" == "$RELEASES_DIR/"* && -d "$target" ]] ||
    die "Release pointer target must be a retained release under $RELEASES_DIR: $target"
  validate_current_release_pointer

  temp_dir=$(mktemp -d "$DEPLOY_ROOT/.current-link.XXXXXX")
  temp_link="$temp_dir/current"
  trap 'rm -rf -- "$temp_dir"' EXIT
  ln -s -- "$target" "$temp_link"

  # Production hosts are Debian/Ubuntu and therefore provide GNU mv. The
  # explicit -T prevents a directory-valued destination from being followed.
  # BSD mv uses -h for the same no-follow behavior in local macOS test runs.
  if mv --help 2>&1 | grep -- '--no-target-directory' >/dev/null; then
    mv -Tf -- "$temp_link" "$pointer"
  else
    mv -fh -- "$temp_link" "$pointer"
  fi
  rmdir -- "$temp_dir"
  trap - EXIT
)

reconcile_current_release_pointer() {
  local current_sha target marker pointer="$DEPLOY_ROOT/current" link_target=
  RELEASE_POINTER_REPAIRED=false
  validate_current_release_pointer
  current_sha=$(state_read current)
  [[ -n "$current_sha" ]] || return 0
  [[ "$current_sha" =~ ^[0-9a-f]{40}$ ]] ||
    die "Invalid current release state: $current_sha"
  target="$RELEASES_DIR/$current_sha"
  [[ -d "$target" && ! -L "$target" && -r "$target/deploy/compose.yml" ]] ||
    die "Current release state points to an unavailable release: $target"
  marker=$(<"$target/.lingdian-release-sha") 2>/dev/null ||
    die "Current release marker is missing: $target"
  [[ "$marker" == "$current_sha" ]] ||
    die "Current release marker mismatch in $target"
  if [[ -L "$pointer" ]]; then
    link_target=$(readlink -- "$pointer")
  fi
  [[ "$link_target" == "$target" ]] && return 0

  atomic_update_current_release_pointer "$target"
  RELEASE_POINTER_REPAIRED=true
  log "Repaired the derived current release pointer from authoritative state: $current_sha"
}

acquire_deploy_lock() {
  local lock_file=${1:-$STATE_DIR/deploy.lock}
  exec 9>"$lock_file"
  flock -n 9 || die 'Another LingDian deployment or rollback is already running'
}

container_id() {
  compose ps -q "$1" 2>/dev/null | head -n 1
}

wait_for_service() {
  local service=$1 timeout_seconds=${2:-180} started now cid status health
  started=$(date +%s)
  while :; do
    cid=$(container_id "$service")
    if [[ -n "$cid" ]]; then
      status=$("${DOCKER[@]}" inspect --format '{{.State.Status}}' "$cid" 2>/dev/null || true)
      health=$("${DOCKER[@]}" inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid" 2>/dev/null || true)
      if [[ "$status" == running && ("$health" == healthy || "$health" == none) ]]; then
        return 0
      fi
      if [[ "$status" == exited || "$status" == dead ]]; then
        warn "$service exited before becoming healthy"
        compose logs --no-color --tail 100 "$service" >&2 || true
        return 1
      fi
    fi
    now=$(date +%s)
    if (( now - started >= timeout_seconds )); then
      warn "$service did not become healthy within ${timeout_seconds}s"
      compose logs --no-color --tail 100 "$service" >&2 || true
      return 1
    fi
    sleep 3
  done
}

wait_for_application() {
  local service
  for service in api app merchant admin; do
    wait_for_service "$service" "${HEALTH_TIMEOUT_SECONDS:-240}" || return 1
  done
}

sudo_command() {
  if [[ ${EUID:-$(id -u)} -eq 0 ]]; then
    "$@"
  else
    need_command sudo
    sudo -n "$@"
  fi
}
