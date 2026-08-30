#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=deploy/scripts/lib.sh
source "$SCRIPT_DIR/lib.sh"

ENV_FILE=${LINGDIAN_ENV_FILE:-/etc/lingdian/production.env}
MODE=https
RENDER_ONLY=

usage() {
  printf 'Usage: %s [--env PATH] [--mode http|https] [--render-only PATH]\n' "${0##*/}"
}

while (($#)); do
  case "$1" in
    --env) ENV_FILE=${2:?--env requires a path}; shift 2 ;;
    --mode) MODE=${2:?--mode requires http or https}; shift 2 ;;
    --render-only) RENDER_ONLY=${2:?--render-only requires a path}; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) die "Unknown argument: $1" ;;
  esac
done
[[ "$MODE" == http || "$MODE" == https ]] || die '--mode must be http or https'
load_deploy_config

APP_DOMAIN=$(dotenv_get APP_DOMAIN "$ENV_FILE")
MERCHANT_DOMAIN=$(dotenv_get MERCHANT_DOMAIN "$ENV_FILE")
ADMIN_DOMAIN=$(dotenv_get ADMIN_DOMAIN "$ENV_FILE")
API_DOMAIN=$(dotenv_get API_DOMAIN "$ENV_FILE")
CERT_NAME=$(dotenv_get TLS_CERT_NAME "$ENV_FILE" "$APP_DOMAIN")
API_PORT=$(dotenv_get API_PORT "$ENV_FILE" 9000)
APP_PORT=$(dotenv_get APP_PORT "$ENV_FILE" 8082)
MERCHANT_PORT=$(dotenv_get MERCHANT_PORT "$ENV_FILE" 8083)
ADMIN_PORT=$(dotenv_get ADMIN_PORT "$ENV_FILE" 8084)

for domain in "$APP_DOMAIN" "$MERCHANT_DOMAIN" "$ADMIN_DOMAIN" "$API_DOMAIN" "$CERT_NAME"; do
  [[ "$domain" =~ ^[A-Za-z0-9][A-Za-z0-9.-]*[A-Za-z0-9]$ ]] || die "Unsafe domain value: $domain"
done
for port in "$API_PORT" "$APP_PORT" "$MERCHANT_PORT" "$ADMIN_PORT"; do
  [[ "$port" =~ ^[0-9]{2,5}$ ]] && ((port >= 1 && port <= 65535)) || die "Invalid local port: $port"
done

template="$LINGDIAN_REPO_ROOT/deploy/nginx/templates/lingdian-$MODE.conf.template"
[[ -r "$template" ]] || die "Missing Nginx template: $template"
rendered=$(mktemp)
target_backup=$(mktemp)
proxy_backup=$(mktemp)
tls_backup=$(mktemp)
enabled_backup=$(mktemp)
trap 'rm -f "$rendered" "$target_backup" "$proxy_backup" "$tls_backup" "$enabled_backup"' EXIT
sed \
  -e "s|__APP_DOMAIN__|$APP_DOMAIN|g" \
  -e "s|__MERCHANT_DOMAIN__|$MERCHANT_DOMAIN|g" \
  -e "s|__ADMIN_DOMAIN__|$ADMIN_DOMAIN|g" \
  -e "s|__API_DOMAIN__|$API_DOMAIN|g" \
  -e "s|__CERT_NAME__|$CERT_NAME|g" \
  -e "s|__API_PORT__|$API_PORT|g" \
  -e "s|__APP_PORT__|$APP_PORT|g" \
  -e "s|__MERCHANT_PORT__|$MERCHANT_PORT|g" \
  -e "s|__ADMIN_PORT__|$ADMIN_PORT|g" \
  "$template" >"$rendered"

if [[ -n "$RENDER_ONLY" ]]; then
  install -m 0644 "$rendered" "$RENDER_ONLY"
  exit 0
fi

need_command nginx
if [[ "$MODE" == https ]]; then
  sudo_command test -r "/etc/letsencrypt/live/$CERT_NAME/fullchain.pem" || die "TLS certificate is missing for $CERT_NAME"
  sudo_command test -r "/etc/letsencrypt/live/$CERT_NAME/privkey.pem" || die "TLS private key is missing for $CERT_NAME"
fi

target=/etc/nginx/sites-available/lingdian.conf
enabled=/etc/nginx/sites-enabled/lingdian.conf
proxy_target=/etc/nginx/snippets/lingdian-proxy.conf
tls_target=/etc/nginx/snippets/lingdian-tls.conf
had_target=false
had_proxy=false
had_tls=false
enabled_kind=absent
enabled_link=
for managed_file in "$target" "$proxy_target" "$tls_target"; do
  sudo_command test ! -L "$managed_file" ||
    die "Managed Nginx file must not be a symbolic link: $managed_file"
done
if sudo_command test -f "$target"; then
  sudo_command cp "$target" "$target_backup"
  had_target=true
fi
if sudo_command test -f "$proxy_target"; then
  sudo_command cp "$proxy_target" "$proxy_backup"
  had_proxy=true
fi
if sudo_command test -f "$tls_target"; then
  sudo_command cp "$tls_target" "$tls_backup"
  had_tls=true
fi
if sudo_command test -L "$enabled"; then
  enabled_kind=symlink
  enabled_link=$(sudo_command readlink -- "$enabled")
elif sudo_command test -f "$enabled"; then
  enabled_kind=file
  sudo_command cp "$enabled" "$enabled_backup"
elif sudo_command test -e "$enabled"; then
  die "$enabled exists but is not a regular file or symbolic link"
fi

restore_managed_file() {
  local destination=$1 backup_file=$2 existed=$3
  if [[ "$existed" == true ]]; then
    sudo_command install -m 0644 "$backup_file" "$destination"
  else
    sudo_command rm -f -- "$destination"
  fi
}

restore_nginx() {
  restore_managed_file "$target" "$target_backup" "$had_target"
  restore_managed_file "$proxy_target" "$proxy_backup" "$had_proxy"
  restore_managed_file "$tls_target" "$tls_backup" "$had_tls"
  sudo_command rm -f -- "$enabled"
  case "$enabled_kind" in
    symlink) sudo_command ln -s -- "$enabled_link" "$enabled" ;;
    file) sudo_command install -m 0644 "$enabled_backup" "$enabled" ;;
  esac
}

install_nginx_files() {
  sudo_command install -d -m 0755 /etc/nginx/snippets /var/www/lingdian-acme || return
  sudo_command install -d -m 0750 -o www-data -g adm /var/log/lingdian/nginx || return
  sudo_command install -m 0644 "$LINGDIAN_REPO_ROOT/deploy/nginx/lingdian-proxy.conf" "$proxy_target" || return
  sudo_command install -m 0644 "$LINGDIAN_REPO_ROOT/deploy/nginx/lingdian-tls.conf" "$tls_target" || return
  sudo_command install -m 0644 "$rendered" "$target" || return
  sudo_command ln -sfn "$target" "$enabled"
}

if ! install_nginx_files; then
  restore_nginx
  die 'Nginx file installation failed; previous managed files were restored'
fi

if ! sudo_command nginx -t; then
  restore_nginx
  sudo_command nginx -t || true
  die 'Nginx validation failed; previous configuration was restored'
fi
if ! sudo_command systemctl reload nginx; then
  restore_nginx
  sudo_command nginx -t && sudo_command systemctl reload nginx || true
  die 'Nginx reload failed; previous configuration was restored'
fi
log "Installed LingDian Nginx configuration in $MODE mode"
