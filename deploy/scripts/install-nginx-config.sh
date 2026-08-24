#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=${LINGDIAN_ROOT:-/home/lighthouse/apps/lingdian}
SOURCE=${LINGDIAN_NGINX_SOURCE:-$ROOT/deploy/nginx/lingdian-subdomains.conf}
TARGET=${LINGDIAN_NGINX_TARGET:-/etc/nginx/sites-available/lingdian.conf}
ENABLED=${LINGDIAN_NGINX_ENABLED:-/etc/nginx/sites-enabled/lingdian.conf}
CERT_DIR=/etc/letsencrypt/live/app.zsf.shopping

if [[ ${EUID:-$(id -u)} -eq 0 ]]; then
  SUDO=()
else
  SUDO=(sudo -n)
fi

[[ -r "$SOURCE" ]] || { echo "Missing Nginx source config: $SOURCE" >&2; exit 66; }
for required in \
  "$CERT_DIR/fullchain.pem" \
  "$CERT_DIR/privkey.pem" \
  /etc/letsencrypt/options-ssl-nginx.conf \
  /etc/letsencrypt/ssl-dhparams.pem \
  /etc/nginx/proxy_params; do
  "${SUDO[@]}" test -r "$required" || { echo "Missing Nginx dependency: $required" >&2; exit 66; }
done

backup=$(mktemp /tmp/lingdian-nginx.XXXXXX)
had_target=false
if "${SUDO[@]}" test -f "$TARGET"; then
  "${SUDO[@]}" cp "$TARGET" "$backup"
  had_target=true
fi

restore_previous_config() {
  if [[ "$had_target" == true ]]; then
    "${SUDO[@]}" install -m 0644 "$backup" "$TARGET"
  else
    "${SUDO[@]}" rm -f "$TARGET" "$ENABLED"
  fi
}

trap 'rm -f "$backup"' EXIT
"${SUDO[@]}" install -m 0644 "$SOURCE" "$TARGET"
"${SUDO[@]}" ln -sfn "$TARGET" "$ENABLED"

if ! "${SUDO[@]}" nginx -t; then
  restore_previous_config
  "${SUDO[@]}" nginx -t || true
  exit 78
fi

if ! "${SUDO[@]}" systemctl reload nginx; then
  restore_previous_config
  "${SUDO[@]}" nginx -t && "${SUDO[@]}" systemctl reload nginx || true
  exit 70
fi
