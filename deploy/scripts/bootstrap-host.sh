#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=deploy/scripts/lib.sh
source "$SCRIPT_DIR/lib.sh"

DEPLOY_USER=${SUDO_USER:-$(id -un)}
ENV_FILE=${LINGDIAN_ENV_FILE:-/etc/lingdian/production.env}
CONFIGURE_FIREWALL=false
SKIP_DOCKER_INSTALL=false
docker_key=
unit_tmp=
timer_tmp=
sudoers_tmp=
docker_unit_tmp=
FIREWALL_SSH_PORT=

cleanup() {
  [[ -z "$docker_key" ]] || rm -f "$docker_key"
  [[ -z "$unit_tmp" ]] || rm -f "$unit_tmp"
  [[ -z "$timer_tmp" ]] || rm -f "$timer_tmp"
  [[ -z "$sudoers_tmp" ]] || rm -f "$sudoers_tmp"
  [[ -z "$docker_unit_tmp" ]] || rm -f "$docker_unit_tmp"
}
trap cleanup EXIT

usage() {
  cat <<'EOF'
Usage: sudo bash deploy/scripts/bootstrap-host.sh [options]
  --user USER            Account allowed to deploy (default: invoking user)
  --env PATH             Production environment path
  --configure-firewall   Install/enable UFW and allow the active SSH port plus 80/443
  --ssh-port PORT        SSH port to allow when enabling UFW (default: current session or 22)
  --skip-docker-install  Require an existing Docker + Compose v2 installation
EOF
}

while (($#)); do
  case "$1" in
    --user) DEPLOY_USER=${2:?--user requires a value}; shift 2 ;;
    --env) ENV_FILE=${2:?--env requires a path}; shift 2 ;;
    --configure-firewall) CONFIGURE_FIREWALL=true; shift ;;
    --ssh-port) FIREWALL_SSH_PORT=${2:?--ssh-port requires a value}; shift 2 ;;
    --skip-docker-install) SKIP_DOCKER_INSTALL=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "Unknown argument: $1" ;;
  esac
done

[[ ${EUID:-$(id -u)} -eq 0 ]] || die 'Run this host bootstrap with sudo/root'
validate_absolute_path ENV_FILE "$ENV_FILE"
validate_environment_location "$ENV_FILE"
if [[ -e "$ENV_FILE" ]]; then
  [[ -f "$ENV_FILE" && ! -L "$ENV_FILE" ]] ||
    die "The production environment path must be a regular file: $ENV_FILE"
fi
id "$DEPLOY_USER" >/dev/null 2>&1 || die "Deployment user does not exist: $DEPLOY_USER"
[[ "$DEPLOY_USER" =~ ^[a-z_][a-z0-9_-]*$ ]] || die "Unsafe deployment username: $DEPLOY_USER"
if [[ -n "$FIREWALL_SSH_PORT" ]]; then
  [[ "$CONFIGURE_FIREWALL" == true ]] || die '--ssh-port requires --configure-firewall'
  [[ "$FIREWALL_SSH_PORT" =~ ^[0-9]{1,5}$ ]] &&
    ((FIREWALL_SSH_PORT >= 1 && FIREWALL_SSH_PORT <= 65535)) ||
    die '--ssh-port must be an integer from 1 to 65535'
fi
deploy_group=$(id -gn "$DEPLOY_USER")
env_dir=$(dirname -- "$ENV_FILE")
validate_absolute_path ENV_DIRECTORY "$env_dir"
validate_no_symlink_components ENV_FILE "$ENV_FILE"
validate_directory_target ENV_DIRECTORY "$env_dir"
case "$env_dir" in
  /etc|/opt|/srv|/var|/home|/usr|/tmp) die "Environment file needs a dedicated subdirectory, not $env_dir" ;;
esac

[[ -r /etc/os-release ]] || die 'Cannot identify this Linux distribution'
# shellcheck disable=SC1091
source /etc/os-release
case "${ID:-}" in
  ubuntu|debian) ;;
  *) die "Unsupported distribution: ${ID:-unknown}; use Ubuntu or Debian" ;;
esac

export DEBIAN_FRONTEND=noninteractive
apt-get update
packages=(
  ca-certificates certbot curl dnsutils git gnupg gzip iproute2 jq logrotate nginx \
  openssl python3 python3-certbot-nginx rsync sudo tar util-linux
)
[[ "$CONFIGURE_FIREWALL" == true ]] && packages+=(ufw)
apt-get install -y --no-install-recommends "${packages[@]}"

# Resolve the protected production layout before Docker is (re)started. This
# lets the service dependency below activate any fstab-backed mount that owns
# DEPLOY_ROOT before a container can bind-mount an empty directory on the root
# filesystem.
install -d -m 0750 -o root -g "$deploy_group" "$env_dir"
if [[ ! -e "$ENV_FILE" ]]; then
  LINGDIAN_ENV_FILE="$ENV_FILE" bash "$SCRIPT_DIR/init-env.sh" --owner "$DEPLOY_USER"
fi
chown "$DEPLOY_USER:$deploy_group" "$ENV_FILE"
chmod 0600 "$ENV_FILE"
runuser -u "$DEPLOY_USER" -- test -r "$ENV_FILE" || die "$DEPLOY_USER cannot read $ENV_FILE"
load_deploy_config

for path in "$DEPLOY_ROOT" "$DATA_DIR" "$BACKUP_DIR" "$RELEASES_DIR" "$STATE_DIR"; do
  [[ ! -L "$path" ]] || die "Deployment directory must not be a symbolic link during host bootstrap: $path"
done

compose_version=$(docker compose version --short 2>/dev/null || true)
if ! command -v docker >/dev/null 2>&1 || ! compose_version_is_supported "$compose_version"; then
  if [[ "$SKIP_DOCKER_INSTALL" == true ]]; then
    [[ -n "$compose_version" ]] || die 'Docker Engine with the Compose v2 plugin is required'
    die "Docker Compose 2.30.0+ is required (found $compose_version)"
  fi
  install -d -m 0755 /etc/apt/keyrings
  docker_key=$(mktemp)
  curl --proto '=https' --tlsv1.2 -fsSL "https://download.docker.com/linux/$ID/gpg" -o "$docker_key"
  gpg --batch --yes --dearmor -o /etc/apt/keyrings/docker.gpg "$docker_key"
  chmod 0644 /etc/apt/keyrings/docker.gpg
  architecture=$(dpkg --print-architecture)
  codename=${VERSION_CODENAME:?VERSION_CODENAME is unavailable}
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/%s %s stable\n' \
    "$architecture" "$ID" "$codename" >/etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y --no-install-recommends \
    containerd.io docker-buildx-plugin docker-ce docker-ce-cli docker-compose-plugin ||
    die 'Could not install/upgrade the official Docker Engine and Compose plugin; remove conflicting distro Docker packages and retry'
fi

docker_unit_tmp=$(mktemp)
sed \
  -e "s|__DEPLOY_ROOT__|$DEPLOY_ROOT|g" \
  -e "s|__DATA_DIR__|$DATA_DIR|g" \
  -e "s|__BACKUP_DIR__|$BACKUP_DIR|g" \
  -e "s|__RELEASES_DIR__|$RELEASES_DIR|g" \
  -e "s|__STATE_DIR__|$STATE_DIR|g" \
  "$LINGDIAN_REPO_ROOT/deploy/systemd/docker-lingdian-storage.conf.template" >"$docker_unit_tmp"
install -d -m 0755 /etc/systemd/system/docker.service.d
install -m 0644 "$docker_unit_tmp" /etc/systemd/system/docker.service.d/lingdian-storage.conf
systemctl daemon-reload
systemctl enable docker nginx
systemctl restart docker
systemctl start nginx
docker info >/dev/null 2>&1 || die 'Docker daemon did not become ready after host bootstrap'
compose_version=$(docker compose version --short 2>/dev/null || true)
compose_version_is_supported "$compose_version" ||
  die "Docker Compose 2.30.0+ is required after host bootstrap (found ${compose_version:-missing})"
getent group docker >/dev/null || groupadd --system docker
usermod -aG docker "$DEPLOY_USER"

# The deployment account is already root-equivalent through the Docker socket,
# and the supported workflow also needs non-interactive root access for Nginx,
# Certbot, protected environment replacement, and service reloads. Make this
# explicit and validate the sudoers policy before installing it.
if [[ "$DEPLOY_USER" != root ]]; then
  sudoers_tmp=$(mktemp)
  printf '%s ALL=(ALL:ALL) NOPASSWD: ALL\n' "$DEPLOY_USER" >"$sudoers_tmp"
  chmod 0440 "$sudoers_tmp"
  visudo -cf "$sudoers_tmp" >/dev/null || die 'Generated deployment sudoers policy is invalid'
  install -m 0440 "$sudoers_tmp" /etc/sudoers.d/lingdian-deploy
  runuser -u "$DEPLOY_USER" -- sudo -n true ||
    die "$DEPLOY_USER does not have working non-interactive sudo access"
fi
docker_binary=$(command -v docker)
runuser -u "$DEPLOY_USER" -- "$docker_binary" info >/dev/null 2>&1 ||
  die "$DEPLOY_USER cannot access Docker after group provisioning"

install -d -m 0750 -o "$DEPLOY_USER" -g "$deploy_group" \
  "$DEPLOY_ROOT" "$DATA_DIR" "$BACKUP_DIR" "$RELEASES_DIR" "$STATE_DIR"
validate_deployment_layout
if [[ ! -e "$DATA_DIR/mysql" ]]; then
  install -d -m 0750 -o "$DEPLOY_USER" -g "$deploy_group" "$DATA_DIR/mysql"
else
  [[ -d "$DATA_DIR/mysql" && ! -L "$DATA_DIR/mysql" ]] ||
    die "Existing MySQL data path must be a real directory: $DATA_DIR/mysql"
  log "Preserving existing MySQL data-directory ownership and mode: $DATA_DIR/mysql"
fi
# The API image runs as uid/gid 1000. Docker mounts this directory directly, so
# its ownership must match even when the host deployment account has another uid.
install -d -m 0750 -o 1000 -g 1000 "$DATA_DIR/uploads"
validate_deployment_layout
install -d -m 0755 /var/www/lingdian-acme
install -d -m 0750 -o www-data -g adm /var/log/lingdian/nginx

install -m 0644 "$LINGDIAN_REPO_ROOT/deploy/logrotate/lingdian-nginx" /etc/logrotate.d/lingdian-nginx

unit_tmp=$(mktemp)
timer_tmp=$(mktemp)
sed \
  -e "s|__DEPLOY_ROOT__|$DEPLOY_ROOT|g" \
  -e "s|__DATA_DIR__|$DATA_DIR|g" \
  -e "s|__BACKUP_DIR__|$BACKUP_DIR|g" \
  -e "s|__RELEASES_DIR__|$RELEASES_DIR|g" \
  -e "s|__STATE_DIR__|$STATE_DIR|g" \
  -e "s|__ENV_FILE__|$ENV_FILE|g" \
  -e "s|__DEPLOY_USER__|$DEPLOY_USER|g" \
  "$LINGDIAN_REPO_ROOT/deploy/systemd/lingdian-backup.service.template" >"$unit_tmp"
cp "$LINGDIAN_REPO_ROOT/deploy/systemd/lingdian-backup.timer" "$timer_tmp"
install -m 0644 "$unit_tmp" /etc/systemd/system/lingdian-backup.service
install -m 0644 "$timer_tmp" /etc/systemd/system/lingdian-backup.timer
systemctl daemon-reload
systemctl enable --now lingdian-backup.timer

if [[ "$CONFIGURE_FIREWALL" == true ]]; then
  need_command ufw
  firewall_ssh_port=$FIREWALL_SSH_PORT
  if [[ -z "$firewall_ssh_port" && -n ${SSH_CONNECTION:-} ]]; then
    firewall_ssh_port=${SSH_CONNECTION##* }
  fi
  [[ -n "$firewall_ssh_port" ]] || firewall_ssh_port=22
  [[ "$firewall_ssh_port" =~ ^[0-9]{1,5}$ ]] &&
    ((firewall_ssh_port >= 1 && firewall_ssh_port <= 65535)) ||
    die "Cannot determine a safe SSH port for UFW: $firewall_ssh_port"
  if ! ufw status | grep -q '^Status: active'; then
    ufw default deny incoming
    ufw default allow outgoing
  fi
  ufw allow "$firewall_ssh_port/tcp"
  ufw allow 'Nginx Full'
  ufw --force enable
  ufw status | grep -q '^Status: active' || die 'UFW did not become active'
fi

log 'Host bootstrap completed'
log "Edit every remaining CHANGE_ME value in $ENV_FILE"
if [[ $(id -u "$DEPLOY_USER") != 0 ]]; then
  warn "Docker group membership was updated for $DEPLOY_USER; log out and back in before deploying without sudo"
fi
