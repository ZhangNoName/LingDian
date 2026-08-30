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

APP_DOMAIN=$(dotenv_get APP_DOMAIN "$ENV_FILE")
MERCHANT_DOMAIN=$(dotenv_get MERCHANT_DOMAIN "$ENV_FILE")
ADMIN_DOMAIN=$(dotenv_get ADMIN_DOMAIN "$ENV_FILE")
API_DOMAIN=$(dotenv_get API_DOMAIN "$ENV_FILE")
TLS_EMAIL=$(dotenv_get TLS_EMAIL "$ENV_FILE")
CERT_NAME=$(dotenv_get TLS_CERT_NAME "$ENV_FILE" "$APP_DOMAIN")
TLS_STAGING=$(dotenv_get TLS_STAGING "$ENV_FILE" false)
domains=("$APP_DOMAIN" "$MERCHANT_DOMAIN" "$ADMIN_DOMAIN" "$API_DOMAIN")

need_command certbot
need_command openssl

# Treat the temporary HTTP ACME site and the final HTTPS site as one Nginx
# transaction. install-nginx.sh is atomic for each individual installation;
# this outer snapshot also restores the pre-issuance configuration when
# Certbot or the final HTTPS transition fails between those two installations.
nginx_snapshot_dir=$(mktemp -d)
chmod 0700 "$nginx_snapshot_dir"
trap 'rm -rf -- "$nginx_snapshot_dir"' EXIT
nginx_target=/etc/nginx/sites-available/lingdian.conf
nginx_enabled=/etc/nginx/sites-enabled/lingdian.conf
nginx_proxy=/etc/nginx/snippets/lingdian-proxy.conf
nginx_tls=/etc/nginx/snippets/lingdian-tls.conf
had_nginx_target=false
had_nginx_proxy=false
had_nginx_tls=false
nginx_enabled_kind=absent
nginx_enabled_link=
tls_transition_committed=false

snapshot_nginx_file() {
  local source=$1 destination=$2 state_name=$3
  if sudo_command test -L "$source"; then
    die "Managed Nginx file must not be a symbolic link: $source"
  elif sudo_command test -f "$source"; then
    sudo_command cat "$source" >"$destination"
    chmod 0600 "$destination"
    printf -v "$state_name" '%s' true
  elif sudo_command test -e "$source"; then
    die "Managed Nginx path is not a regular file: $source"
  fi
}

snapshot_nginx_file "$nginx_target" "$nginx_snapshot_dir/target" had_nginx_target
snapshot_nginx_file "$nginx_proxy" "$nginx_snapshot_dir/proxy" had_nginx_proxy
snapshot_nginx_file "$nginx_tls" "$nginx_snapshot_dir/tls" had_nginx_tls
if sudo_command test -L "$nginx_enabled"; then
  nginx_enabled_kind=symlink
  nginx_enabled_link=$(sudo_command readlink -- "$nginx_enabled")
elif sudo_command test -f "$nginx_enabled"; then
  nginx_enabled_kind=file
  sudo_command cat "$nginx_enabled" >"$nginx_snapshot_dir/enabled"
  chmod 0600 "$nginx_snapshot_dir/enabled"
elif sudo_command test -e "$nginx_enabled"; then
  die "Managed Nginx enabled path is neither a regular file nor a symbolic link: $nginx_enabled"
fi

restore_snapshot_file() {
  local destination=$1 backup=$2 existed=$3
  if [[ "$existed" == true ]]; then
    sudo_command install -m 0644 -- "$backup" "$destination"
  else
    sudo_command rm -f -- "$destination"
  fi
}

restore_pre_tls_nginx() {
  restore_snapshot_file "$nginx_target" "$nginx_snapshot_dir/target" "$had_nginx_target"
  restore_snapshot_file "$nginx_proxy" "$nginx_snapshot_dir/proxy" "$had_nginx_proxy"
  restore_snapshot_file "$nginx_tls" "$nginx_snapshot_dir/tls" "$had_nginx_tls"
  sudo_command rm -f -- "$nginx_enabled"
  case "$nginx_enabled_kind" in
    symlink) sudo_command ln -s -- "$nginx_enabled_link" "$nginx_enabled" ;;
    file) sudo_command install -m 0644 -- "$nginx_snapshot_dir/enabled" "$nginx_enabled" ;;
  esac
}

finish_tls_transition() {
  local status=$?
  trap - EXIT
  if [[ "$tls_transition_committed" != true ]]; then
    warn 'TLS transition did not commit; restoring the pre-deployment Nginx configuration'
    set +e
    restore_pre_tls_nginx
    if ! sudo_command nginx -t; then
      warn 'The restored Nginx configuration did not validate; immediate operator intervention is required'
    elif ! sudo_command systemctl reload nginx; then
      warn 'The restored Nginx configuration could not be reloaded; immediate operator intervention is required'
    fi
    set -e
  fi
  rm -rf -- "$nginx_snapshot_dir"
  exit "$status"
}
trap finish_tls_transition EXIT

certificate_ok=true
force_renewal=false
if ! sudo_command test -r "/etc/letsencrypt/live/$CERT_NAME/fullchain.pem"; then
  certificate_ok=false
  # The first certificate needs a reachable HTTP-only virtual host for ACME.
  bash "$SCRIPT_DIR/install-nginx.sh" --env "$ENV_FILE" --mode http
else
  sudo_command openssl x509 -checkend 2592000 -noout -in "/etc/letsencrypt/live/$CERT_NAME/fullchain.pem" >/dev/null || certificate_ok=false
  for domain in "${domains[@]}"; do
    sudo_command openssl x509 -checkhost "$domain" -noout -in "/etc/letsencrypt/live/$CERT_NAME/fullchain.pem" >/dev/null || certificate_ok=false
  done
  renewal_config="/etc/letsencrypt/renewal/$CERT_NAME.conf"
  renewal_server=$(sudo_command awk -F= '
    /^[[:space:]]*server[[:space:]]*=/ {
      value=$2
      sub(/^[[:space:]]+/, "", value)
      sub(/[[:space:]]+$/, "", value)
      print value
      exit
    }
  ' "$renewal_config" 2>/dev/null || true)
  if [[ "$TLS_STAGING" == false && "${renewal_server,,}" == *staging* ]]; then
    certificate_ok=false
    force_renewal=true
    warn "Replacing the ACME staging certificate for $CERT_NAME with a production certificate"
  fi
fi

if [[ "$certificate_ok" == false ]]; then
  certbot_args=(
    certonly --webroot --webroot-path /var/www/lingdian-acme
    --non-interactive --agree-tos --email "$TLS_EMAIL"
    --cert-name "$CERT_NAME" --keep-until-expiring --expand
    --deploy-hook "systemctl reload nginx"
  )
  for domain in "${domains[@]}"; do certbot_args+=(-d "$domain"); done
  if [[ "$TLS_STAGING" == true ]]; then
    certbot_args+=(--test-cert)
  else
    certbot_args+=(--server https://acme-v02.api.letsencrypt.org/directory)
  fi
  [[ "$force_renewal" == false ]] || certbot_args+=(--force-renewal)
  sudo_command certbot "${certbot_args[@]}" || die 'Certificate issuance failed; the pre-deployment Nginx configuration will be restored'
fi

bash "$SCRIPT_DIR/install-nginx.sh" --env "$ENV_FILE" --mode https
tls_transition_committed=true
log "TLS is active for ${domains[*]}"
