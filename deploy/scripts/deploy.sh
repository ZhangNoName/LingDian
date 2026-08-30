#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=deploy/scripts/lib.sh
source "$SCRIPT_DIR/lib.sh"

ENV_FILE=${LINGDIAN_ENV_FILE:-/etc/lingdian/production.env}
REQUESTED_REF=HEAD
PREPARED_RELEASE=
SKIP_BACKUP=false
OBSERVABILITY_HANDOFF=false

usage() {
  cat <<'EOF'
Usage: bash deploy/scripts/deploy.sh [options]
  --env PATH       Protected production environment (default /etc/lingdian/production.env)
  --sha REF        Commit/ref to deploy (default HEAD)
  --skip-backup    Skip the pre-migration backup (not recommended)
EOF
}

while (($#)); do
  case "$1" in
    --env) ENV_FILE=${2:?--env requires a path}; shift 2 ;;
    --sha) REQUESTED_REF=${2:?--sha requires a ref}; shift 2 ;;
    --prepared-release) PREPARED_RELEASE=${2:?--prepared-release requires a path}; shift 2 ;;
    --observability-handoff) OBSERVABILITY_HANDOFF=true; shift ;;
    --skip-tls) die '--skip-tls is not supported by the production deployment profile' ;;
    --skip-backup) SKIP_BACKUP=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "Unknown argument: $1" ;;
  esac
done

load_deploy_config
ensure_runtime_dirs
validate_current_release_pointer
is_true "$(dotenv_get TLS_ENABLED "$ENV_FILE" true)" ||
  die 'TLS_ENABLED=true is required by the production deployment profile'
is_true "$(dotenv_get TLS_STAGING "$ENV_FILE" false)" &&
  die 'TLS_STAGING=true is not accepted by the production deployment entrypoint; use issue-tls.sh directly for an ACME staging test'
observability_enabled=$(dotenv_get OBSERVABILITY_ENABLED "$ENV_FILE" true)
if is_true "$observability_enabled" && [[ "$OBSERVABILITY_HANDOFF" != true ]]; then
  die 'Observability is enabled; use deploy-all.sh so core activation and monitoring are one recoverable deployment'
fi

if [[ -z "$PREPARED_RELEASE" ]]; then
  need_command git
  need_command tar
  [[ "$REQUESTED_REF" != -* ]] || die 'Git ref must not begin with a dash'
  RELEASE_SHA=$(git -C "$LINGDIAN_REPO_ROOT" rev-parse --verify "$REQUESTED_REF^{commit}") ||
    die "Cannot resolve Git commit: $REQUESTED_REF"
  [[ "$RELEASE_SHA" =~ ^[0-9a-f]{40}$ ]] || die "Unexpected Git SHA: $RELEASE_SHA"
  PREPARED_RELEASE="$RELEASES_DIR/$RELEASE_SHA"

  exec 8>"$STATE_DIR/extract.lock"
  flock -n 8 || die 'Another release is being prepared'
  if [[ -d "$PREPARED_RELEASE" ]]; then
    [[ -r "$PREPARED_RELEASE/.lingdian-release-sha" ]] || die "Existing release has no marker: $PREPARED_RELEASE"
    [[ $(<"$PREPARED_RELEASE/.lingdian-release-sha") == "$RELEASE_SHA" ]] || die "Existing release marker mismatch: $PREPARED_RELEASE"
  else
    extract_dir=$(mktemp -d "$RELEASES_DIR/.extract.XXXXXX")
    cleanup_extract() { rm -rf -- "$extract_dir"; }
    trap cleanup_extract EXIT
    git -C "$LINGDIAN_REPO_ROOT" archive --format=tar "$RELEASE_SHA" | tar -xf - -C "$extract_dir"
    printf '%s\n' "$RELEASE_SHA" >"$extract_dir/.lingdian-release-sha"
    chmod 0444 "$extract_dir/.lingdian-release-sha"
    mv -- "$extract_dir" "$PREPARED_RELEASE"
    trap - EXIT
  fi
  flock -u 8

  [[ -r "$PREPARED_RELEASE/deploy/scripts/deploy.sh" ]] ||
    die 'The selected commit predates the quick-deploy implementation; deploy a commit containing deploy/scripts/deploy.sh'
  next_args=(--prepared-release "$PREPARED_RELEASE" --sha "$RELEASE_SHA" --env "$ENV_FILE")
  [[ "$OBSERVABILITY_HANDOFF" == true ]] && next_args+=(--observability-handoff)
  [[ "$SKIP_BACKUP" == true ]] && next_args+=(--skip-backup)
  exec bash "$PREPARED_RELEASE/deploy/scripts/deploy.sh" "${next_args[@]}"
fi

RELEASE_SHA=$REQUESTED_REF
[[ "$RELEASE_SHA" =~ ^[0-9a-f]{40}$ ]] || die 'Prepared deployments require a full 40-character commit SHA'
use_release "$PREPARED_RELEASE" "$RELEASE_SHA"
acquire_deploy_lock
reconcile_current_release_pointer

log "Running preflight for release $RELEASE_SHA"
bash "$PREPARED_RELEASE/deploy/scripts/preflight.sh" --env "$ENV_FILE" --release-dir "$PREPARED_RELEASE" --sha "$RELEASE_SHA"
load_deploy_config
ensure_runtime_dirs
prepare_runtime_envs
init_docker
use_release "$PREPARED_RELEASE" "$RELEASE_SHA"
old_sha=$(state_read current)
observability_intent_sha=$(state_read observability-intent)
if [[ -n "$observability_intent_sha" ]]; then
  [[ "$observability_intent_sha" =~ ^[0-9a-f]{40}$ ]] ||
    die "Invalid observability deployment intent: $observability_intent_sha"
  [[ "$observability_intent_sha" == "$RELEASE_SHA" ]] ||
    die "Observability recovery for $observability_intent_sha must complete before deploying $RELEASE_SHA"
fi

core_config_fingerprint() {
  local key digest
  {
    digest=$(sha256sum "$API_RUNTIME_ENV")
    printf 'api-runtime=%s\0' "${digest%% *}"
    digest=$(sha256sum "$DB_CA_RUNTIME_FILE")
    printf 'database-ca=%s\0' "${digest%% *}"
    for key in \
      DEPLOY_ROOT DATA_DIR BACKUP_DIR RELEASES_DIR STATE_DIR \
      COMPOSE_PROJECT_NAME COMPOSE_NETWORK DATABASE_MODE TZ \
      DEPLOY_PUBLIC_IPV4 APP_DOMAIN MERCHANT_DOMAIN ADMIN_DOMAIN API_DOMAIN \
      TLS_EMAIL TLS_ENABLED TLS_STAGING TLS_CERT_NAME VITE_API_BASE \
      API_PORT APP_PORT MERCHANT_PORT ADMIN_PORT \
      PNPM_REGISTRY DEBIAN_MIRROR DEBIAN_SECURITY_MIRROR \
      MYSQL_IMAGE MYSQL_DATABASE MYSQL_USER MYSQL_PASSWORD MYSQL_ROOT_PASSWORD \
      EXTERNAL_MYSQL_SSL_MODE EXTERNAL_MYSQL_SSL_CA \
      DOCKER_LOG_MAX_SIZE DOCKER_LOG_MAX_FILES \
      MYSQL_MEMORY_LIMIT MYSQL_CPU_LIMIT API_MEMORY_LIMIT API_CPU_LIMIT \
      FRONTEND_MEMORY_LIMIT FRONTEND_CPU_LIMIT HEALTH_TIMEOUT_SECONDS; do
      printf '%s=%s\0' "$key" "$(dotenv_get "$key" "$ENV_FILE")"
    done
  } | sha256sum | awk '{print $1}'
}

if [[ "$old_sha" == "$RELEASE_SHA" ]]; then
  # Rebuilding the fixed image tags in place would destroy the only known-good
  # rollback image for this revision. A retry after an observability failure is
  # intentionally a no-op for core services; ship a new commit for any image,
  # build-time configuration, or runtime-environment change.
  recorded_fingerprint=$(state_read core-config-fingerprint)
  [[ "$recorded_fingerprint" =~ ^[0-9a-f]{64}$ ]] ||
    die 'Same-revision deployment is unsafe because no successful core configuration fingerprint is recorded; deploy a new revision'
  current_fingerprint=$(core_config_fingerprint)
  [[ "$current_fingerprint" == "$recorded_fingerprint" ]] ||
    die 'Core configuration changed for the current revision; create and deploy a new commit instead of overwriting immutable images'
  observability_stopped_sha=$(state_read observability-core-stopped)
  if [[ -n "$observability_stopped_sha" ]]; then
    observability_pending_sha=$(state_read observability-pending)
    [[ "$observability_stopped_sha" == "$RELEASE_SHA" && "$observability_pending_sha" == "$RELEASE_SHA" ]] ||
      die 'Observability stop/pending state is inconsistent with the current release; manual recovery is required'
    log 'Core is intentionally stopped after a first observability failure; allowing the target-release continuation to retry monitoring'
  else
    wait_for_application || die 'The requested release is already recorded but its application is not healthy; deploy a new revision or roll back'
  fi
  log "Core release $RELEASE_SHA is already current; skipping same-revision rebuild and activation"
  exit 0
fi

backup_enabled=false
backup_completed=false
if [[ "$SKIP_BACKUP" == false ]] && is_true "$(dotenv_get BACKUP_ON_DEPLOY "$ENV_FILE" true)"; then
  backup_enabled=true
else
  warn 'Pre-migration backup was skipped by configuration/request'
fi

run_pre_deploy_backup() {
  # Always use the target release's backup implementation so an upgrade from
  # an older release benefits from the latest validation and lock handling.
  # The backup metadata still records state/current as the data release.
  bash "$PREPARED_RELEASE/deploy/scripts/backup.sh" \
    --env "$ENV_FILE" --release-dir "$PREPARED_RELEASE" --sha "$RELEASE_SHA" --reason pre-deploy
  backup_completed=true
}

# On an upgrade, snapshot the currently running database before a changed
# MYSQL_IMAGE can be pulled/recreated. External databases do not need a local
# container, so their first-deploy snapshot can also happen immediately.
if [[ "$backup_enabled" == true ]] &&
   { [[ "$old_sha" =~ ^[0-9a-f]{40}$ ]] || [[ "$DATABASE_MODE" == external ]]; }; then
  run_pre_deploy_backup
fi

if [[ "$DATABASE_MODE" == local ]]; then
  log 'Starting local MySQL'
  compose pull db
  compose up -d db
  wait_for_service db 240 || die 'Local MySQL failed its health check'
fi

log 'Building immutable application images'
DOCKER_BUILDKIT=1 compose build --pull api app merchant admin

log 'Validating the exact API runtime environment inside the release image'
compose --profile operations run --rm --no-deps migrate node -e \
  "require('./backend/dist/config/env.validation.js').validateEnv(process.env)"
if [[ ! -r "$STATE_DIR/bootstrap-complete" ]]; then
  compose --profile operations run --rm --no-deps bootstrap node --input-type=module -e \
    "import { readProductionStoreConfig } from './backend/scripts/production-bootstrap.lib.mjs'; import { validateBootstrapAccountsConfig } from './backend/scripts/auth-bootstrap.lib.mjs'; readProductionStoreConfig(process.env); validateBootstrapAccountsConfig(process.env);"
fi

# A brand-new local deployment could not be backed up until its database was
# started. Capture that empty/pre-existing data directory now, before migration.
if [[ "$backup_enabled" == true && "$backup_completed" == false ]]; then
  run_pre_deploy_backup
fi

# Keep scheduled backups out of the migration/bootstrap window. If a timer won
# the small gap after the safety backup, fail before changing the schema.
exec 7>"$STATE_DIR/backup.lock"
flock -n 7 || die 'A scheduled backup started before deployment could lock migrations; retry the deployment'

log 'Stopping API writes for the database migration window'
if ! compose stop api; then
  die 'Could not stop the API before database migration; no migration was attempted'
fi
log 'Applying database migrations through the safe deployment wrapper'
if ! compose --profile operations run --rm --no-deps migrate; then
  warn 'Database migration failed after the API was stopped; refusing to restart an application against an uncertain schema'
  if ! compose stop api app merchant admin; then
    warn 'Could not stop every core container after migration failure; immediate operator intervention is required'
  fi
  if [[ "$backup_completed" == true ]]; then
    last_backup=$(state_read last-backup)
    [[ -z "$last_backup" ]] || warn "Restore the verified pre-deploy backup if roll-forward repair is not possible: $last_backup"
  else
    warn 'No new pre-deploy backup was created for this attempt; do not assume the last-backup record matches the current schema'
  fi
  die 'Database migration failed; core remains stopped. Roll forward with a corrected release or restore a verified compatible backup'
fi

if [[ ! -r "$STATE_DIR/bootstrap-complete" ]]; then
  [[ -r "$BOOTSTRAP_RUNTIME_ENV" ]] || die 'One-time bootstrap environment was not generated'
  log 'Creating or validating the primary store and initial accounts'
  compose --profile operations run --rm --no-deps bootstrap
  state_write bootstrap-complete "$RELEASE_SHA"
  rm -f -- "$BOOTSTRAP_RUNTIME_ENV"
fi

# Keep this outside the first-bootstrap branch so a retry also removes
# credentials when account creation succeeded but a previous scrub was
# interrupted. The operation is atomic and idempotent.
scrub_bootstrap_credentials
prepare_runtime_envs

log 'Activating application containers'
intent_created=false
if is_true "$observability_enabled" && [[ -z "$observability_intent_sha" ]]; then
  state_write observability-intent "$RELEASE_SHA"
  observability_intent_sha=$RELEASE_SHA
  intent_created=true
fi
activation_failed=false
if ! compose up -d api app merchant admin; then
  warn 'Application containers could not be created or started'
  activation_failed=true
elif ! wait_for_application; then
  activation_failed=true
fi

if [[ "$activation_failed" == false ]]; then
  bash "$PREPARED_RELEASE/deploy/scripts/issue-tls.sh" --env "$ENV_FILE" || activation_failed=true
fi

if [[ "$activation_failed" == true ]]; then
  activation_recovered=false
  auto_rollback_enabled=$(dotenv_get AUTO_ROLLBACK "$ENV_FILE" true)
  rollback_schema_compatible=false
  if [[ "$old_sha" =~ ^[0-9a-f]{40}$ && -d "$RELEASES_DIR/$old_sha" ]] &&
     prisma_migration_sets_match "$PREPARED_RELEASE" "$RELEASES_DIR/$old_sha"; then
    rollback_schema_compatible=true
  fi
  if is_true "$auto_rollback_enabled" && [[ "$rollback_schema_compatible" == true ]]; then
    warn "Activation failed; restoring containers from $old_sha"
    use_release "$RELEASES_DIR/$old_sha" "$old_sha"
    if ! compose up -d api app merchant admin; then
      warn 'Previous application release could not be recreated'
    elif ! wait_for_application; then
      warn 'Previous application release also failed its health checks'
    else
      activation_recovered=true
    fi
  else
    if [[ "$old_sha" =~ ^[0-9a-f]{40}$ && "$rollback_schema_compatible" != true ]]; then
      warn 'Activation failed and automatic application rollback is blocked because the Prisma migration histories differ or are unavailable'
      warn 'Roll forward with a corrected release, or restore the verified pre-deploy backup before starting the previous application release'
    elif [[ "$rollback_schema_compatible" == true ]]; then
      warn 'Activation failed and schema-compatible automatic rollback is disabled by AUTO_ROLLBACK=false'
    else
      warn 'Activation failed and no schema-compatible automatic rollback was available'
    fi
    if ! compose stop api app merchant admin; then
      warn 'Could not stop every newly activated core container; immediate operator intervention is required'
    else
      warn 'Stopped the uncommitted core release so it is not left live without a safe application/schema pairing'
      activation_recovered=true
    fi
  fi
  if [[ "$activation_recovered" == true && "$intent_created" == true ]]; then
    rm -f -- "$STATE_DIR/observability-intent"
  fi
  last_backup=$(state_read last-backup)
  [[ -z "$last_backup" ]] || warn "Database migrations were not reversed; recovery backup: $last_backup"
  die 'Deployment activation failed'
fi

if [[ "$old_sha" =~ ^[0-9a-f]{40}$ && "$old_sha" != "$RELEASE_SHA" ]]; then
  state_write previous "$old_sha"
fi
state_write core-config-fingerprint "$(core_config_fingerprint)"
state_write current "$RELEASE_SHA"
atomic_update_current_release_pointer "$PREPARED_RELEASE"
printf '%s\t%s\t%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$RELEASE_SHA" deployed >>"$STATE_DIR/history.log"
chmod 0600 "$STATE_DIR/history.log"

log "Deployment completed: $RELEASE_SHA"
compose ps
if is_true "$(dotenv_get AUTO_CLEANUP_RELEASES "$ENV_FILE" true)"; then
  bash "$PREPARED_RELEASE/deploy/scripts/cleanup.sh" \
    --env "$ENV_FILE" --apply --confirm PRUNE_OLD_LINGDIAN_RELEASES ||
    warn 'Deployment succeeded, but old-release cleanup needs manual attention'
fi
