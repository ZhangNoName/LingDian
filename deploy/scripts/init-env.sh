#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
REPO_ROOT=$(cd -- "$SCRIPT_DIR/../.." && pwd -P)
# shellcheck source=deploy/scripts/lib.sh
source "$SCRIPT_DIR/lib.sh"
TARGET=${LINGDIAN_ENV_FILE:-/etc/lingdian/production.env}
TARGET_USER=${LINGDIAN_ENV_OWNER:-}

usage() {
  printf 'Usage: %s [--env /absolute/path] [--owner USER]\n' "${0##*/}"
}

while (($#)); do
  case "$1" in
    --env) TARGET=${2:?--env requires a path}; shift 2 ;;
    --owner) TARGET_USER=${2:?--owner requires a user}; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'Unknown argument: %s\n' "$1" >&2; usage >&2; exit 64 ;;
  esac
done

validate_absolute_path ENV_FILE "$TARGET"
validate_environment_location "$TARGET"
validate_no_symlink_components ENV_FILE "$TARGET"
[[ ! -e "$TARGET" ]] || { printf 'Refusing to overwrite existing environment: %s\n' "$TARGET" >&2; exit 73; }
command -v openssl >/dev/null 2>&1 || { printf 'openssl is required\n' >&2; exit 69; }

target_user=$TARGET_USER
if [[ -z "$target_user" ]]; then
  if [[ ${EUID:-$(id -u)} -eq 0 && -n ${SUDO_USER:-} ]]; then
    target_user=$SUDO_USER
  else
    target_user=$(id -un)
  fi
fi
if [[ ${EUID:-$(id -u)} -ne 0 && "$target_user" != "$(id -un)" ]]; then
  printf 'Only root may create an environment owned by another user: %s\n' "$target_user" >&2
  exit 77
fi
id "$target_user" >/dev/null 2>&1 || { printf 'Target user does not exist: %s\n' "$target_user" >&2; exit 67; }
target_group=$(id -gn "$target_user")

tmp=$(mktemp)
trap 'rm -f "$tmp" "$tmp.next"' EXIT
chmod 0600 "$tmp"
cp "$REPO_ROOT/deploy/production.env.example" "$tmp"

replace_literal() {
  local needle=$1 replacement=$2 line
  : >"$tmp.next"
  chmod 0600 "$tmp.next"
  while IFS= read -r line || [[ -n "$line" ]]; do
    printf '%s\n' "${line//"$needle"/"$replacement"}" >>"$tmp.next"
  done <"$tmp"
  mv -f "$tmp.next" "$tmp"
}

mysql_password=$(openssl rand -hex 24)
replace_literal CHANGE_ME_MYSQL_PASSWORD "$mysql_password"
replace_literal CHANGE_ME_MYSQL_URL_PASSWORD "$mysql_password"
replace_literal CHANGE_ME_MYSQL_ROOT_PASSWORD "$(openssl rand -hex 32)"
replace_literal CHANGE_ME_JWT_SECRET "$(openssl rand -hex 48)"
replace_literal CHANGE_ME_REFRESH_PEPPER "$(openssl rand -hex 48)"
replace_literal CHANGE_ME_SMS_WEBHOOK_TOKEN "$(openssl rand -hex 32)"
unset mysql_password

target_dir=$(dirname -- "$TARGET")
validate_directory_target ENV_DIRECTORY "$target_dir"
if [[ ${EUID:-$(id -u)} -eq 0 ]]; then
  install -d -o root -g "$target_group" -m 0750 "$target_dir"
  validate_directory_target ENV_DIRECTORY "$target_dir"
  install -o "$target_user" -g "$target_group" -m 0600 "$tmp" "$TARGET"
elif [[ -d "$target_dir" && -w "$target_dir" ]]; then
  install -m 0600 "$tmp" "$TARGET"
else
  command -v sudo >/dev/null 2>&1 || { printf 'sudo is required to write %s\n' "$TARGET" >&2; exit 77; }
  sudo -n install -d -o root -g "$target_group" -m 0750 "$target_dir"
  validate_directory_target ENV_DIRECTORY "$target_dir"
  sudo -n install -o "$target_user" -g "$target_group" -m 0600 "$tmp" "$TARGET"
fi

validate_no_symlink_components ENV_FILE "$TARGET"
if [[ $(id -u "$target_user") -eq $(id -u) ]]; then
  test -r "$TARGET" || { printf '%s cannot read %s\n' "$target_user" "$TARGET" >&2; exit 77; }
elif command -v runuser >/dev/null 2>&1; then
  runuser -u "$target_user" -- test -r "$TARGET" ||
    { printf '%s cannot read %s\n' "$target_user" "$TARGET" >&2; exit 77; }
else
  sudo -n -u "$target_user" test -r "$TARGET" ||
    { printf '%s cannot read %s\n' "$target_user" "$TARGET" >&2; exit 77; }
fi

printf 'Created protected production environment: %s\n' "$TARGET"
printf 'Technical secrets were generated. Replace every remaining CHANGE_ME value before deploying.\n'
