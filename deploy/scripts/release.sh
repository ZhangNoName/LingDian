#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=${LINGDIAN_ROOT:-/home/lighthouse/apps/lingdian}
ENV_FILE=${LINGDIAN_ENV_FILE:-/home/lighthouse/.config/lingdian/api.env}
UPLOADS=${LINGDIAN_UPLOADS:-/data/lingdian/uploads}
SHA=${1:?usage: release.sh <git-sha> [app,merchant,admin,api|all]}
SELECTION=${2:-all}
LOCK=/tmp/lingdian-release.lock

if ! docker info >/dev/null 2>&1; then
  sudo -n docker info >/dev/null
  docker() { sudo docker "$@"; }
fi

exec 9>"$LOCK"
flock -n 9 || { echo 'Another LingDian release is running' >&2; exit 75; }
cd "$ROOT"
if ! git cat-file -e "$SHA^{commit}" 2>/dev/null; then
  for attempt in 1 2 3; do
    git -c http.version=HTTP/1.1 fetch --prune origin main && break
    [[ "$attempt" -lt 3 ]] || { echo "Unable to fetch $SHA from origin" >&2; exit 69; }
    sleep $((attempt * 2))
  done
fi
git cat-file -e "$SHA^{commit}"
git checkout --detach "$SHA"

wants() { [[ "$SELECTION" == all || ",$SELECTION," == *",$1,"* ]]; }
wait_for_health() {
  local url=$1 attempts=${2:-30}
  for ((i = 0; i < attempts; i++)); do
    curl -fsS "$url" >/dev/null && return 0
    sleep 1
  done
  return 1
}

release_frontend() {
  local name=$1 port=$2 app=$3 image old_image
  image="lingdian-$name:$SHA"
  docker build --pull -f Dockerfile.frontend --build-arg "APP=$app" -t "$image" .
  old_image=$(docker inspect -f '{{.Config.Image}}' "lingdian-$name" 2>/dev/null || true)
  docker rm -f "lingdian-$name-candidate" >/dev/null 2>&1 || true
  docker run -d --name "lingdian-$name-candidate" -p "127.0.0.1:$((port + 1000)):80" "$image" >/dev/null
  if ! wait_for_health "http://127.0.0.1:$((port + 1000))/healthz"; then
    docker logs "lingdian-$name-candidate" >&2 || true
    docker rm -f "lingdian-$name-candidate" >/dev/null 2>&1 || true
    return 1
  fi
  docker rm -f "lingdian-$name-candidate" >/dev/null
  docker rm -f "lingdian-$name" >/dev/null 2>&1 || true
  if ! docker run -d --name "lingdian-$name" --restart unless-stopped -p "127.0.0.1:$port:80" "$image" >/dev/null; then
    [[ -n "$old_image" ]] && docker run -d --name "lingdian-$name" --restart unless-stopped -p "127.0.0.1:$port:80" "$old_image" >/dev/null
    return 1
  fi
  if ! wait_for_health "http://127.0.0.1:$port/healthz" 15; then
    docker logs "lingdian-$name" >&2 || true
    docker rm -f "lingdian-$name" >/dev/null 2>&1 || true
    [[ -n "$old_image" ]] && docker run -d --name "lingdian-$name" --restart unless-stopped -p "127.0.0.1:$port:80" "$old_image" >/dev/null
    return 1
  fi
}

release_api() {
  [[ -r "$ENV_FILE" ]] || { echo "Missing production environment: $ENV_FILE" >&2; return 1; }
  local image="lingdian-api:$SHA" old_image
  docker build --pull -f Dockerfile.api -t "$image" .
  mkdir -p "$UPLOADS"
  docker run --rm --env-file "$ENV_FILE" "$image" corepack pnpm run db:migrate:deploy
  old_image=$(docker inspect -f '{{.Config.Image}}' lingdian-api 2>/dev/null || true)
  docker rm -f lingdian-api-candidate >/dev/null 2>&1 || true
  docker run -d --name lingdian-api-candidate --env-file "$ENV_FILE" -p 127.0.0.1:19000:9000 -v "$UPLOADS:/workspace/uploads" "$image" >/dev/null
  if ! wait_for_health http://127.0.0.1:19000/api/health 45; then
    docker logs lingdian-api-candidate >&2 || true
    docker rm -f lingdian-api-candidate >/dev/null 2>&1 || true
    return 1
  fi
  docker rm -f lingdian-api-candidate >/dev/null
  docker rm -f lingdian-api >/dev/null 2>&1 || true
  if ! docker run -d --name lingdian-api --restart unless-stopped --env-file "$ENV_FILE" -p 127.0.0.1:9000:9000 -v "$UPLOADS:/workspace/uploads" "$image" >/dev/null; then
    [[ -n "$old_image" ]] && docker run -d --name lingdian-api --restart unless-stopped --env-file "$ENV_FILE" -p 127.0.0.1:9000:9000 -v "$UPLOADS:/workspace/uploads" "$old_image" >/dev/null
    return 1
  fi
  if ! wait_for_health http://127.0.0.1:9000/api/health 20; then
    docker logs lingdian-api >&2 || true
    docker rm -f lingdian-api >/dev/null 2>&1 || true
    [[ -n "$old_image" ]] && docker run -d --name lingdian-api --restart unless-stopped --env-file "$ENV_FILE" -p 127.0.0.1:9000:9000 -v "$UPLOADS:/workspace/uploads" "$old_image" >/dev/null
    return 1
  fi
}

if wants app; then release_frontend app 8082 app; fi
if wants merchant; then release_frontend merchant 8083 merchant; fi
if wants admin; then release_frontend admin 8084 admin; fi
if wants api; then release_api; fi
