#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=deploy/scripts/lib.sh
source "$SCRIPT_DIR/lib.sh"

ENV_FILE=${LINGDIAN_ENV_FILE:-/etc/lingdian/production.env}
OBSERVABILITY_ONLY=false
EXPECTED_SHA=
REQUESTED_REF=HEAD
deploy_args=()

usage() {
  cat <<'EOF'
Usage: bash deploy/scripts/deploy-all.sh [deploy options]
       bash <release>/deploy/scripts/deploy-all.sh --observability-only --expected-sha FULL_SHA [--env PATH]

The observability-only form is an internal/recovery continuation. It is safe to
retry after a failed observability installation for the already-current SHA.
EOF
}

while (($#)); do
  case "$1" in
    --env)
      ENV_FILE=${2:?--env requires a path}
      deploy_args+=(--env "$ENV_FILE")
      shift 2
      ;;
    --sha)
      REQUESTED_REF=${2:?--sha requires a ref}
      deploy_args+=(--sha "$REQUESTED_REF")
      shift 2
      ;;
    --prepared-release)
      deploy_args+=(--prepared-release "${2:?--prepared-release requires a path}")
      shift 2
      ;;
    --skip-tls)
      die '--skip-tls is not supported by the production deployment profile'
      ;;
    --skip-backup)
      deploy_args+=(--skip-backup)
      shift
      ;;
    --observability-only)
      OBSERVABILITY_ONLY=true
      shift
      ;;
    --expected-sha)
      EXPECTED_SHA=${2:?--expected-sha requires a full SHA}
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *) die "Unknown argument: $1" ;;
  esac
done

if [[ "$OBSERVABILITY_ONLY" == false ]]; then
  [[ -z "$EXPECTED_SHA" ]] || die '--expected-sha is valid only with --observability-only'
  [[ "$REQUESTED_REF" != -* ]] || die 'Git ref must not begin with a dash'
  need_command git
  expected_sha=$(git -C "$LINGDIAN_REPO_ROOT" rev-parse --verify "$REQUESTED_REF^{commit}") ||
    die "Cannot resolve Git commit: $REQUESTED_REF"
  [[ "$expected_sha" =~ ^[0-9a-f]{40}$ ]] || die "Unexpected Git SHA: $expected_sha"

  # A failed observability phase is a transaction owned by the already-current
  # release. Do not activate a different core release and strand its rollback
  # snapshot; retry (or explicitly disable observability for) that SHA first.
  load_deploy_config
  is_true "$(dotenv_get TLS_ENABLED "$ENV_FILE" true)" ||
    die 'TLS_ENABLED=true is required by the production deployment profile'
  is_true "$(dotenv_get TLS_STAGING "$ENV_FILE" false)" &&
    die 'TLS_STAGING=true is not accepted by the production deployment entrypoint'
  intent_sha=$(state_read observability-intent)
  if [[ -n "$intent_sha" ]]; then
    [[ "$intent_sha" =~ ^[0-9a-f]{40}$ ]] ||
      die "Invalid observability deployment intent: $intent_sha"
    [[ "$intent_sha" == "$expected_sha" ]] ||
      die "Core/observability deployment for $intent_sha is incomplete; retry that exact release before deploying $expected_sha"
  fi
  pending_sha=$(state_read observability-pending)
  if [[ -n "$pending_sha" ]]; then
    [[ "$pending_sha" =~ ^[0-9a-f]{40}$ ]] ||
      die "Invalid observability-pending state: $pending_sha"
    [[ "$pending_sha" == "$expected_sha" ]] ||
      die "Observability recovery for $pending_sha is pending; retry that exact release before deploying $expected_sha"
  fi

  bash "$SCRIPT_DIR/deploy.sh" --observability-handoff "${deploy_args[@]}"

  # deploy.sh intentionally execs the selected release for the core phase. Once
  # it returns, this caller may still be an older checkout (upgrade.sh fetches
  # without checking out). Hand the second phase to the verified target release
  # instead of letting the caller's orchestration/config schema remain in charge.
  load_deploy_config
  current_sha=$(state_read current)
  [[ "$current_sha" == "$expected_sha" ]] ||
    die "Core deployment returned with current=$current_sha, expected $expected_sha; refusing observability handoff"
  target_deploy_all="$RELEASES_DIR/$expected_sha/deploy/scripts/deploy-all.sh"
  [[ -r "$target_deploy_all" ]] || die "Target release has no deploy-all continuation: $target_deploy_all"
  continuation_args=(--observability-only --expected-sha "$expected_sha" --env "$ENV_FILE")
  exec bash "$target_deploy_all" "${continuation_args[@]}"
fi

[[ "$EXPECTED_SHA" =~ ^[0-9a-f]{40}$ ]] ||
  die '--observability-only requires --expected-sha with a full 40-character SHA'
load_deploy_config
is_true "$(dotenv_get TLS_ENABLED "$ENV_FILE" true)" ||
  die 'TLS_ENABLED=true is required by the production deployment profile'
is_true "$(dotenv_get TLS_STAGING "$ENV_FILE" false)" &&
  die 'TLS_STAGING=true is not accepted by the production deployment entrypoint'
ensure_runtime_dirs
acquire_deploy_lock
init_docker

current_sha=$(state_read current)
[[ "$current_sha" == "$EXPECTED_SHA" ]] ||
  die "Observability continuation expected current=$EXPECTED_SHA, found ${current_sha:-none}"
intent_sha=$(state_read observability-intent)
if [[ -n "$intent_sha" ]]; then
  [[ "$intent_sha" == "$current_sha" ]] ||
    die "Observability deployment intent belongs to $intent_sha, not current release $current_sha"
elif is_true "$(dotenv_get OBSERVABILITY_ENABLED "$ENV_FILE" true)"; then
  die "Observability deployment intent is missing for current release $current_sha; refusing an untracked monitoring handoff"
fi
release_dir="$RELEASES_DIR/$current_sha"
[[ "$LINGDIAN_REPO_ROOT" == "$release_dir" ]] ||
  die "Observability continuation must run from the target release: $release_dir"
use_release "$release_dir" "$current_sha"

observability_dir="$DEPLOY_ROOT/observability"
observability_env="$observability_dir/observability.env"
env_backup="$STATE_DIR/observability-env.rollback"
env_existed_state="$STATE_DIR/observability-env-existed"
pending_sha=$(state_read observability-pending)
if [[ -n "$pending_sha" ]]; then
  [[ "$pending_sha" =~ ^[0-9a-f]{40}$ ]] ||
    die "Invalid observability-pending state: $pending_sha"
  [[ "$pending_sha" == "$current_sha" ]] ||
    die "Observability recovery belongs to $pending_sha, not current release $current_sha"
fi

prepare_observability_directory() {
  validate_directory_target OBSERVABILITY_DIRECTORY "$observability_dir"
  [[ "$observability_dir" == "$DEPLOY_ROOT/"* ]] ||
    die "OBSERVABILITY_DIRECTORY must be a child of DEPLOY_ROOT: $observability_dir"
  mkdir -p -- "$observability_dir"
  validate_directory_target OBSERVABILITY_DIRECTORY "$observability_dir"
  chmod 0700 "$observability_dir"
  if [[ -e "$observability_env" ]]; then
    [[ -f "$observability_env" && ! -L "$observability_env" ]] ||
      die "Observability environment must be a regular non-symlink file: $observability_env"
  fi
}

load_observability_transaction() {
  env_existed=$(state_read observability-env-existed)
  [[ "$env_existed" == true || "$env_existed" == false ]] ||
    die "Invalid observability-env-existed transaction state: ${env_existed:-missing}"
  if [[ "$env_existed" == true ]]; then
    [[ -f "$env_backup" && ! -L "$env_backup" ]] ||
      die "Observability rollback environment is missing or unsafe: $env_backup"
  fi
}

restore_observability_env() {
  local restore_tmp
  if [[ "$env_existed" == true ]]; then
    restore_tmp=$(mktemp "$observability_dir/.observability-env-restore.XXXXXX")
    install -m 0600 "$env_backup" "$restore_tmp"
    mv -f -- "$restore_tmp" "$observability_env"
  else
    rm -f -- "$observability_env"
  fi
}

clear_observability_transaction() {
  rm -f -- "$STATE_DIR/observability-intent" "$STATE_DIR/observability-pending" "$env_backup" "$env_existed_state"
}

is_true "$(dotenv_get OBSERVABILITY_ENABLED "$ENV_FILE" true)" || {
  # If the operator deliberately disables observability while recovering a
  # failed attempt, restore the pre-attempt persistent environment before
  # abandoning the transaction. This also makes a disabled retry crash-safe.
  if [[ -n "$pending_sha" ]]; then
    prepare_observability_directory
    load_observability_transaction
    restore_observability_env
  fi
  blocked_sha=$(state_read observability-core-stopped)
  if [[ -n "$blocked_sha" ]]; then
    [[ "$blocked_sha" == "$current_sha" ]] ||
      die "Core-stop state belongs to $blocked_sha, not current release $current_sha"
    warn 'Observability was disabled after a failed installation; reactivating the intentionally stopped core containers'
    prepare_runtime_envs
    if ! compose up -d api app merchant admin || ! wait_for_application; then
      die 'Observability is disabled, but the stopped core containers could not be reactivated safely'
    fi
    rm -f -- "$STATE_DIR/observability-core-stopped"
  fi
  clear_observability_transaction
  warn 'Core deployment succeeded; observability installation is disabled'
  exit 0
}

observability_script="$release_dir/deploy/observability/observability.sh"
[[ -r "$observability_script" ]] || die 'Core deployment succeeded but this release has no observability stack'

prepare_observability_directory

existing_observability=false
if [[ -n $("${DOCKER[@]}" ps -aq --filter label=com.docker.compose.project=lingdian-observability) ]]; then
  existing_observability=true
fi

prior_observability_sha=$(state_read observability-current)
if [[ -n "$prior_observability_sha" && ! "$prior_observability_sha" =~ ^[0-9a-f]{40}$ ]]; then
  die "Invalid observability-current state: $prior_observability_sha"
fi
if [[ -z "$prior_observability_sha" && "$existing_observability" == true && -z "$pending_sha" ]]; then
  # Compatibility for the first deployment that introduces the state marker.
  # deploy.sh retains previous, so the running stack's release remains available.
  fallback_sha=$(state_read previous)
  if [[ "$fallback_sha" =~ ^[0-9a-f]{40}$ && -r "$RELEASES_DIR/$fallback_sha/deploy/observability/observability.sh" ]]; then
    prior_observability_sha=$fallback_sha
  elif [[ -r "$release_dir/deploy/observability/observability.sh" ]]; then
    prior_observability_sha=$current_sha
  fi
fi

prior_observability_script=
if [[ -n "$prior_observability_sha" ]]; then
  prior_observability_script="$RELEASES_DIR/$prior_observability_sha/deploy/observability/observability.sh"
  [[ -r "$prior_observability_script" ]] ||
    die "Cannot safely upgrade observability; retained release is missing: $prior_observability_sha"
  [[ -f "$observability_env" ]] ||
    die 'Cannot safely upgrade observability; the prior persistent environment is missing'
elif [[ "$existing_observability" == true ]]; then
  die 'Cannot identify the release of the existing observability stack; refusing to replace it'
fi

if [[ -n "$pending_sha" ]]; then
  # Reuse the original snapshot. Replacing it with the possibly half-updated
  # live file would turn a SIGKILL between key updates into a fail-open commit.
  load_observability_transaction
else
  env_existed=false
  if [[ -f "$observability_env" ]]; then
    env_backup_tmp=$(mktemp "$STATE_DIR/.observability-env-rollback.XXXXXX")
    install -m 0600 "$observability_env" "$env_backup_tmp"
    mv -f -- "$env_backup_tmp" "$env_backup"
    env_existed=true
  else
    rm -f -- "$env_backup"
  fi
  state_write observability-env-existed "$env_existed"
  state_write observability-pending "$current_sha"
  pending_sha=$current_sha
fi
if [[ ! -f "$observability_env" ]]; then
  install -m 0600 "$release_dir/deploy/observability/.env.example" "$observability_env"
fi

upsert_observability_key() {
  local key=$1 value=$2 tmp line replaced=false
  tmp=$(mktemp "$observability_dir/.observability-env.XXXXXX")
  chmod 0600 "$tmp"
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" == "$key="* ]]; then
      printf '%s=%s\n' "$key" "$value" >>"$tmp"
      replaced=true
    else
      printf '%s\n' "$line" >>"$tmp"
    fi
  done <"$observability_env"
  [[ "$replaced" == true ]] || printf '%s=%s\n' "$key" "$value" >>"$tmp"
  mv -f -- "$tmp" "$observability_env"
  chmod 0600 "$observability_env"
}

stop_core_without_monitoring() {
  warn "No healthy prior observability release is available; stopping core containers for $current_sha"
  prepare_runtime_envs
  # Persist intent before the stop. If this process is killed after Docker stops
  # the containers, a same-SHA retry must still bypass the core health gate and
  # reach this observability continuation to reactivate them.
  state_write observability-core-stopped "$current_sha"
  if compose stop api app merchant admin; then
    warn 'Core containers were stopped to avoid leaving a live production deployment without monitoring'
  else
    warn 'Could not stop every core container; recovery state was retained and immediate operator intervention is required'
  fi
}

scheme=https
upsert_observability_key OBSERVABILITY_STATE_DIR "$observability_dir"
upsert_observability_key LINGDIAN_NETWORK "$COMPOSE_NETWORK"
upsert_observability_key CORE_COMPOSE_PROJECT_NAME "$COMPOSE_PROJECT_NAME"
upsert_observability_key CORE_API_PORT "$(dotenv_get API_PORT "$ENV_FILE" 9000)"
upsert_observability_key CORE_APP_PORT "$(dotenv_get APP_PORT "$ENV_FILE" 8082)"
upsert_observability_key CORE_MERCHANT_PORT "$(dotenv_get MERCHANT_PORT "$ENV_FILE" 8083)"
upsert_observability_key CORE_ADMIN_PORT "$(dotenv_get ADMIN_PORT "$ENV_FILE" 8084)"
upsert_observability_key GRAFANA_PORT "$(dotenv_get GRAFANA_PORT "$ENV_FILE" 3001)"
upsert_observability_key PROMETHEUS_PORT "$(dotenv_get PROMETHEUS_PORT "$ENV_FILE" 9090)"
upsert_observability_key ALERTMANAGER_PORT "$(dotenv_get ALERTMANAGER_PORT "$ENV_FILE" 9093)"
upsert_observability_key PUBLIC_APP_URL "$scheme://$(dotenv_get APP_DOMAIN "$ENV_FILE")/"
upsert_observability_key PUBLIC_MERCHANT_URL "$scheme://$(dotenv_get MERCHANT_DOMAIN "$ENV_FILE")/"
upsert_observability_key PUBLIC_ADMIN_URL "$scheme://$(dotenv_get ADMIN_DOMAIN "$ENV_FILE")/"
upsert_observability_key PUBLIC_API_READY_URL "$scheme://$(dotenv_get API_DOMAIN "$ENV_FILE")/api/health/ready"
upsert_observability_key ALERT_WEBHOOK_URL "$(dotenv_get ALERT_WEBHOOK_URL "$ENV_FILE")"

log 'Installing/upgrading the persistent observability stack'
if ! OBSERVABILITY_ENV_FILE="$observability_env" \
  OBSERVABILITY_STATE_DIR="$observability_dir" \
    bash "$observability_script" install; then
  warn "Observability installation failed for $current_sha; restoring the previous observability state"
  restore_observability_env
  recovery_ok=false
  if [[ -n "$prior_observability_script" ]]; then
    if OBSERVABILITY_ENV_FILE="$observability_env" \
      OBSERVABILITY_STATE_DIR="$observability_dir" \
        bash "$prior_observability_script" install; then
      recovery_ok=true
      warn "Previous observability release $prior_observability_sha was restored; core release $current_sha remains active"
    else
      warn "Failed to restore previous observability release $prior_observability_sha"
    fi
  else
    # No old stack exists on a first install. Remove partial target containers
    # without volumes, then stop the already-activated core until monitoring can
    # be installed successfully on a retry.
    if [[ "$env_existed" == false ]]; then
      install -m 0600 "$release_dir/deploy/observability/.env.example" "$observability_env"
    fi
    OBSERVABILITY_ENV_FILE="$observability_env" \
    OBSERVABILITY_STATE_DIR="$observability_dir" \
      bash "$observability_script" down || warn 'Could not remove every partially started observability container'
    restore_observability_env
  fi
  if [[ "$recovery_ok" == false ]]; then
    stop_core_without_monitoring
  fi
  die "Observability deployment failed for $current_sha; retry this deploy after correcting the reported monitoring error"
fi

blocked_sha=$(state_read observability-core-stopped)
if [[ -n "$blocked_sha" ]]; then
  [[ "$blocked_sha" == "$current_sha" ]] ||
    die "Core-stop state belongs to $blocked_sha, not current release $current_sha"
  log 'Observability is healthy; reactivating core containers stopped by the previous failed attempt'
  prepare_runtime_envs
  if ! compose up -d api app merchant admin || ! wait_for_application; then
    die 'Observability recovered, but the stopped core containers could not be reactivated safely'
  fi
  rm -f -- "$STATE_DIR/observability-core-stopped"
fi
state_write observability-current "$current_sha"
clear_observability_transaction
log "Core and observability deployment completed: $current_sha"
