#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
COMPOSE_FILE="$SCRIPT_DIR/compose.yml"
ENV_FILE="${OBSERVABILITY_ENV_FILE:-$SCRIPT_DIR/.env}"
GENERATED_DIR=''

log() {
  printf '[observability] %s\n' "$*"
}

fail() {
  printf '[observability] ERROR: %s\n' "$*" >&2
  exit 1
}

env_value() {
  local key="$1"
  local default_value="${2:-}"
  local value
  value="$(awk -v key="$key" '
    $0 !~ /^[[:space:]]*#/ && index($0, key "=") == 1 {
      print substr($0, length(key) + 2)
      found = 1
    }
    END { if (!found) exit 1 }
  ' "$ENV_FILE" 2>/dev/null || true)"
  if [[ -n "$value" ]]; then
    printf '%s' "$value"
  else
    printf '%s' "$default_value"
  fi
}

validate_core_project_name() {
  local project_name
  project_name="$(env_value CORE_COMPOSE_PROJECT_NAME lingdian)"
  [[ "$project_name" =~ ^lingdian([-_][a-z0-9][a-z0-9_-]*)?$ ]] || \
    fail 'CORE_COMPOSE_PROJECT_NAME 只支持 lingdian、lingdian-* 或 lingdian_*（小写字母、数字、连字符和下划线）'
}

validate_port_layout() {
  local entry key default port seen=' '
  for entry in \
    CORE_API_PORT:9000 CORE_APP_PORT:8082 CORE_MERCHANT_PORT:8083 CORE_ADMIN_PORT:8084 \
    GRAFANA_PORT:3001 PROMETHEUS_PORT:9090 ALERTMANAGER_PORT:9093; do
    key=${entry%%:*}
    default=${entry#*:}
    port="$(env_value "$key" "$default")"
    [[ "$port" =~ ^[0-9]{1,5}$ ]] && ((port >= 1 && port <= 65535)) ||
      fail "$key 必须是 1 到 65535 的整数"
    [[ "$seen" != *" $port "* ]] || fail "$key=$port 与另一个 LingDian 宿主端口重复"
    seen+="$port "
  done
}

compose() {
  OBSERVABILITY_STATE_DIR="$GENERATED_DIR" \
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

require_commands() {
  local command_name
  for command_name in docker openssl awk df; do
    command -v "$command_name" >/dev/null 2>&1 || fail "缺少命令：$command_name"
  done
  docker info >/dev/null 2>&1 || fail 'Docker daemon 不可用，或当前用户没有访问权限'
  docker compose version >/dev/null 2>&1 || fail '需要 Docker Compose v2'
}

ensure_env_file() {
  if [[ ! -f "$ENV_FILE" ]]; then
    mkdir -p "$(dirname -- "$ENV_FILE")"
    cp "$SCRIPT_DIR/.env.example" "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    log "已创建 ${ENV_FILE}；当前使用安全默认值，可按需修改域名和 webhook"
  fi
}

validate_state_directory() {
  local value="$1" component current='' probe="$1" suffix='' leaf physical canonical base
  local -a components=()
  [[ "$value" == /* ]] || fail "OBSERVABILITY_STATE_DIR 必须解析为绝对路径：$value"
  case "$value" in
    /|/bin|/boot|/data|/dev|/etc|/home|/lib|/lib64|/media|/mnt|/opt|/proc|/root|/run|/sbin|/srv|/sys|/tmp|/usr|/var)
      fail "OBSERVABILITY_STATE_DIR 过于宽泛且不安全：$value"
      ;;
  esac
  [[ "$value" =~ ^/[A-Za-z0-9._/-]+$ ]] || fail "OBSERVABILITY_STATE_DIR 含不支持的字符：$value"
  [[ "$value" != */ && "$value" != *//* && "$value" != *'/../'* && "$value" != */.. &&
     "$value" != *'/./'* && "$value" != */. ]] ||
    fail "OBSERVABILITY_STATE_DIR 必须是规范化路径：$value"
  base=${value##*/}
  [[ "$base" == observability || "$base" == generated ]] ||
    fail 'OBSERVABILITY_STATE_DIR 最终目录必须命名为 observability（生产）或 generated（本地）'

  IFS='/' read -r -a components <<<"${value#/}"
  for component in "${components[@]}"; do
    [[ -n "$component" ]] || continue
    current="$current/$component"
    [[ ! -L "$current" ]] ||
      fail "OBSERVABILITY_STATE_DIR 不得包含符号链接路径：$current"
  done

  while [[ ! -e "$probe" ]]; do
    leaf=${probe##*/}
    suffix="/$leaf$suffix"
    probe=${probe%/*}
    [[ -n "$probe" ]] || probe=/
  done
  [[ -d "$probe" ]] || fail "OBSERVABILITY_STATE_DIR 的现有祖先不是目录：$probe"
  physical=$(cd -P -- "$probe" 2>/dev/null && pwd -P) ||
    fail "无法解析 OBSERVABILITY_STATE_DIR 的现有祖先：$probe"
  if [[ "$physical" == / ]]; then
    canonical="/${suffix#/}"
  else
    canonical="$physical$suffix"
  fi
  [[ "$canonical" == "$value" ]] ||
    fail "OBSERVABILITY_STATE_DIR 物理路径不一致：$value -> $canonical"
}

configure_state_dir() {
  local configured
  validate_core_project_name
  validate_port_layout
  configured="${OBSERVABILITY_STATE_DIR:-$(env_value OBSERVABILITY_STATE_DIR)}"
  if [[ -z "$configured" ]]; then
    configured="$SCRIPT_DIR/generated"
  elif [[ "$configured" != /* ]]; then
    case "$configured" in
      generated|./generated) configured="$SCRIPT_DIR/generated" ;;
      *) fail '相对 OBSERVABILITY_STATE_DIR 只允许 generated；生产环境请使用以 observability 结尾的绝对路径' ;;
    esac
  fi
  validate_state_directory "$configured"
  mkdir -p -- "$configured"
  validate_state_directory "$configured"
  GENERATED_DIR="$(cd -P -- "$configured" && pwd -P)"
  export OBSERVABILITY_STATE_DIR="$GENERATED_DIR"
}

memory_gb() {
  if [[ -r /proc/meminfo ]]; then
    awk '/^MemTotal:/ { printf "%d", $2 / 1024 / 1024 }' /proc/meminfo
    return
  fi
  if command -v sysctl >/dev/null 2>&1; then
    local bytes
    bytes="$(sysctl -n hw.memsize 2>/dev/null || printf '0')"
    printf '%d' "$((bytes / 1024 / 1024 / 1024))"
    return
  fi
  printf '0'
}

disk_free_gb() {
  local path="$1"
  df -Pk "$path" | awk 'NR == 2 { printf "%d", $4 / 1024 / 1024 }'
}

capacity_preflight() {
  local required_memory required_disk available_memory available_state_disk available_docker_disk allow_low docker_root
  required_memory="$(env_value MIN_HOST_MEMORY_GB 8)"
  required_disk="$(env_value MIN_FREE_DISK_GB 40)"
  allow_low="$(env_value ALLOW_LOW_RESOURCES false)"
  available_memory="$(memory_gb)"
  docker_root="$(docker info --format '{{.DockerRootDir}}' 2>/dev/null)"
  [[ "$docker_root" == /* && -d "$docker_root" ]] || fail "无法确定 Docker 数据目录：${docker_root:-empty}"
  available_state_disk="$(disk_free_gb "$GENERATED_DIR")"
  available_docker_disk="$(disk_free_gb "$docker_root")"

  [[ "$required_memory" =~ ^[0-9]+$ ]] || fail 'MIN_HOST_MEMORY_GB 必须是非负整数'
  [[ "$required_disk" =~ ^[0-9]+$ ]] || fail 'MIN_FREE_DISK_GB 必须是非负整数'
  log "容量检查：内存 ${available_memory} GiB（建议至少 ${required_memory} GiB），状态盘 ${available_state_disk} GiB、Docker 数据盘 ${available_docker_disk} GiB（各要求至少 ${required_disk} GiB；同一文件系统只计一次实际空间）"

  if (( available_memory < required_memory || available_state_disk < required_disk || available_docker_disk < required_disk )); then
    if [[ "$allow_low" == 'true' ]]; then
      log '警告：已通过 ALLOW_LOW_RESOURCES=true 跳过容量门禁，存在 OOM 或日志/指标停止写入风险'
    else
      fail '服务器容量不足；扩容后重试，或确认风险后设置 ALLOW_LOW_RESOURCES=true 并调低各服务 MEMORY_LIMIT'
    fi
  fi
}

functional_stack_ready() {
  local url
  FUNCTIONAL_HEALTH_FAILURE=
  for url in \
    http://loki:3100/ready \
    http://alloy:12345/-/ready \
    http://node-exporter:9100/metrics \
    http://cadvisor:8080/metrics \
    http://blackbox-exporter:9115/metrics \
    http://alertmanager:9093/-/ready \
    http://grafana:3000/api/health; do
    if ! compose exec -T prometheus wget -q -T 5 -O /dev/null "$url" >/dev/null 2>&1; then
      FUNCTIONAL_HEALTH_FAILURE=$url
      return 1
    fi
  done
}

yaml_quote() {
  local value="${1//\'/\'\'}"
  printf "'%s'" "$value"
}

validate_http_url() {
  local name="$1"
  local value="$2"
  [[ -z "$value" || "$value" =~ ^https?://[^[:space:]]+$ ]] || fail "$name 必须为空或绝对 HTTP(S) URL"
}

render_blackbox_targets() {
  local name value target_count=0
  local -a target_names=(PUBLIC_APP_URL PUBLIC_MERCHANT_URL PUBLIC_ADMIN_URL PUBLIC_API_READY_URL)
  {
    for name in "${target_names[@]}"; do
      value="$(env_value "$name")"
      validate_http_url "$name" "$value"
      if [[ -n "$value" ]]; then
        printf -- '- targets:\n    - %s\n  labels:\n    target_name: %s\n' \
          "$(yaml_quote "$value")" "$(yaml_quote "$name")"
        target_count=$((target_count + 1))
      fi
    done
  } > "$GENERATED_DIR/blackbox-targets.yml"
  (( target_count > 0 )) || fail '至少配置一个 PUBLIC_*_URL 合成探测目标'
}

render_alertmanager() {
  local webhook_url receiver
  webhook_url="$(env_value ALERT_WEBHOOK_URL)"
  receiver='local'
  if [[ -n "$webhook_url" ]]; then
    [[ "$webhook_url" =~ ^https://[^[:space:]]+$ ]] || fail 'ALERT_WEBHOOK_URL 必须为空或绝对 HTTPS URL'
    receiver='webhook'
  fi

  {
    printf 'global:\n  resolve_timeout: 5m\n\n'
    printf 'route:\n  receiver: %s\n' "$receiver"
    printf '  group_by: [alertname, cluster, severity]\n  group_wait: 30s\n  group_interval: 5m\n  repeat_interval: 4h\n'
    printf '  routes:\n    - matchers:\n        - severity="critical"\n      repeat_interval: 30m\n\n'
    printf 'receivers:\n  - name: local\n'
    if [[ -n "$webhook_url" ]]; then
      printf '  - name: webhook\n    webhook_configs:\n      - url: %s\n        send_resolved: true\n        max_alerts: 20\n' "$(yaml_quote "$webhook_url")"
    fi
    printf '\ninhibit_rules:\n  - source_matchers:\n      - severity="critical"\n    target_matchers:\n      - severity="warning"\n    equal: [alertname, instance]\n'
  } > "$GENERATED_DIR/alertmanager.yml"
}

prepare_generated_config() {
  umask 077
  mkdir -p "$GENERATED_DIR"
  chmod 700 "$GENERATED_DIR"
  mkdir -p "$GENERATED_DIR/node-exporter-textfile"
  chmod 755 "$GENERATED_DIR/node-exporter-textfile"
  if [[ ! -s "$GENERATED_DIR/grafana-admin-password" ]]; then
    openssl rand -base64 36 | tr -d '\n' > "$GENERATED_DIR/grafana-admin-password"
    printf '\n' >> "$GENERATED_DIR/grafana-admin-password"
    log "已生成 Grafana 管理员随机密码（保存在 ${GENERATED_DIR}/grafana-admin-password）"
  fi
  render_blackbox_targets
  render_alertmanager
  # These inputs live below a 0700 host directory, but containers run as uid 0
  # with every capability dropped. World-readability on the individual
  # read-only bind/secret files is required for Linux DAC checks and does not
  # make them traversable to other host users.
  chmod 644 \
    "$GENERATED_DIR/grafana-admin-password" \
    "$GENERATED_DIR/alertmanager.yml"
  chmod 644 "$GENERATED_DIR/blackbox-targets.yml"
}

ensure_network() {
  local network
  network="$(env_value LINGDIAN_NETWORK lingdian)"
  if ! docker network inspect "$network" >/dev/null 2>&1; then
    docker network create "$network" >/dev/null
    log "已创建共享 Docker 网络：$network"
  fi
}

validate_configs() {
  log '校验 Compose、Prometheus、Alertmanager、Loki、Alloy 与 Grafana dashboard 配置'
  compose config --quiet

  docker run --rm \
    -v "$SCRIPT_DIR/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro" \
    -v "$SCRIPT_DIR/prometheus/rules:/etc/prometheus/rules:ro" \
    -v "$GENERATED_DIR/blackbox-targets.yml:/etc/prometheus/generated/blackbox-targets.yml:ro" \
    --entrypoint /bin/promtool \
    prom/prometheus:v3.5.0@sha256:63805ebb8d2b3920190daf1cb14a60871b16fd38bed42b857a3182bc621f4996 \
    check config /etc/prometheus/prometheus.yml

  docker run --rm \
    --cap-drop ALL \
    --user 0:0 \
    -v "$GENERATED_DIR/alertmanager.yml:/etc/alertmanager/alertmanager.yml:ro" \
    --entrypoint amtool \
    prom/alertmanager:v0.28.1@sha256:27c475db5fb156cab31d5c18a4251ac7ed567746a2483ff264516437a39b15ba \
    check-config /etc/alertmanager/alertmanager.yml

  docker run --rm \
    --cap-drop ALL \
    -e LOG_LEVEL=warning \
    -v "$SCRIPT_DIR/docker-socket-proxy/haproxy.cfg:/usr/local/etc/haproxy/lingdian.cfg:ro" \
    --entrypoint /usr/local/sbin/haproxy \
    tecnativa/docker-socket-proxy:0.3.0@sha256:9e4b9e7517a6b660f2cc903a19b257b1852d5b3344794e3ea334ff00ae677ac2 \
    -c -f /usr/local/etc/haproxy/lingdian.cfg

  docker run --rm \
    -e LOKI_RETENTION="$(env_value LOKI_RETENTION 336h)" \
    -v "$SCRIPT_DIR/loki/loki.yml:/etc/loki/loki.yml:ro" \
    -v "$SCRIPT_DIR/loki/rules:/etc/loki/rules:ro" \
    grafana/loki:3.5.2@sha256:d0a95e651bb7d0a5a6468035c5b49c52f4678d90d598f853c06716bca102686b \
    -config.file=/etc/loki/loki.yml -config.expand-env=true -verify-config=true

  docker run --rm \
    -e DOCKER_HOST=tcp://docker-socket-proxy:2375 \
    -e 'LINGDIAN_PROJECT_REGEX=lingdian|lingdian-observability' \
    -v "$SCRIPT_DIR/alloy/config.alloy:/etc/alloy/config.alloy:ro" \
    grafana/alloy:v1.10.2@sha256:bcf27f18c4402869af112fb39e35e1db3804a404686f4caa20bdf77814219223 \
    validate /etc/alloy/config.alloy

  if command -v node >/dev/null 2>&1; then
    node -e 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))' \
      "$SCRIPT_DIR/grafana/dashboards/lingdian-overview.json"
  fi
}

wait_until_healthy() {
  local deadline now all_healthy service container_id state health
  deadline=$((SECONDS + 180))
  while (( SECONDS < deadline )); do
    all_healthy=true
    while IFS= read -r service; do
      container_id="$(compose ps -q "$service")"
      if [[ -z "$container_id" ]]; then
        all_healthy=false
        continue
      fi
      state="$(docker inspect --format '{{.State.Status}}' "$container_id")"
      health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id")"
      if [[ "$state" == 'exited' || "$state" == 'dead' || "$health" == 'unhealthy' ]]; then
        compose ps
        compose logs --tail=80 "$service"
        fail "${service} 启动失败（state=$state, health=$health）"
      fi
      if [[ "$state" != 'running' || "$health" != 'healthy' ]]; then
        all_healthy=false
      fi
    done < <(compose config --services)

    if [[ "$all_healthy" == 'true' ]] && functional_stack_ready; then
      log '所有监控组件均已健康'
      return
    fi
    sleep 3
    now=$((deadline - SECONDS))
    (( now % 30 != 0 )) || log "等待服务健康，剩余 ${now}s"
  done
  compose ps
  [[ -z "${FUNCTIONAL_HEALTH_FAILURE:-}" ]] ||
    log "最后一个未通过的跨组件就绪探测：$FUNCTIONAL_HEALTH_FAILURE"
  fail '等待监控组件健康超时'
}

check_stack_status() {
  local failures=0 service container_id state health
  compose ps
  while IFS= read -r service; do
    container_id="$(compose ps -q "$service")"
    if [[ -z "$container_id" ]]; then
      printf '[observability] UNHEALTHY: %s 容器不存在\n' "$service" >&2
      failures=$((failures + 1))
      continue
    fi
    state="$(docker inspect --format '{{.State.Status}}' "$container_id")"
    health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id")"
    if [[ "$state" != 'running' || ( "$health" != 'healthy' && "$health" != 'none' ) ]]; then
      printf '[observability] UNHEALTHY: %s state=%s health=%s\n' "$service" "$state" "$health" >&2
      failures=$((failures + 1))
    fi
  done < <(compose config --services)

  (( failures == 0 )) || fail "监控栈有 ${failures} 个服务缺失或不健康"
  log '监控栈全部服务 running/healthy'
}

print_access() {
  local grafana_port prometheus_port alertmanager_port admin_user
  grafana_port="$(env_value GRAFANA_PORT 3001)"
  prometheus_port="$(env_value PROMETHEUS_PORT 9090)"
  alertmanager_port="$(env_value ALERTMANAGER_PORT 9093)"
  admin_user="$(env_value GRAFANA_ADMIN_USER admin)"
  log "Grafana: http://127.0.0.1:${grafana_port}（用户 ${admin_user}，密码文件 $GENERATED_DIR/grafana-admin-password）"
  log "Prometheus: http://127.0.0.1:${prometheus_port}"
  log "Alertmanager: http://127.0.0.1:${alertmanager_port}"
  log '远程访问请使用 SSH 本地端口转发，不要把这些端口直接开放到公网'
}

install_stack() {
  require_commands
  ensure_env_file
  configure_state_dir
  capacity_preflight
  prepare_generated_config
  ensure_network
  compose pull
  validate_configs
  compose up -d --remove-orphans
  wait_until_healthy
  compose ps
  print_access
}

case "${1:-install}" in
  install|upgrade)
    install_stack
    ;;
  check)
    require_commands
    ensure_env_file
    configure_state_dir
    prepare_generated_config
    validate_configs
    ;;
  status)
    require_commands
    ensure_env_file
    configure_state_dir
    check_stack_status
    print_access
    ;;
  logs)
    require_commands
    ensure_env_file
    configure_state_dir
    shift
    compose logs --tail=200 -f "$@"
    ;;
  restart)
    require_commands
    ensure_env_file
    configure_state_dir
    compose restart
    wait_until_healthy
    ;;
  stop)
    require_commands
    ensure_env_file
    configure_state_dir
    compose stop
    log '监控容器已停止，持久化 volumes 和历史数据均保留'
    ;;
  down)
    require_commands
    ensure_env_file
    configure_state_dir
    compose down
    log '监控容器与网络引用已移除，持久化 volumes 和历史数据均保留'
    ;;
  *)
    fail '用法：observability.sh {install|upgrade|check|status|logs [service]|restart|stop|down}'
    ;;
esac
