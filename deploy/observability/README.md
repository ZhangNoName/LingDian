# LingDian 自托管日志与监控

该目录提供一套单机可持久化的生产观测栈：Prometheus、Alertmanager、Loki、Grafana Alloy、Grafana、node-exporter、cAdvisor 和 blackbox-exporter。所有镜像均同时固定版本 tag 和 manifest digest，不使用 `latest`，相同 release 不会因上游 tag 漂移而换镜像。

## 快速安装

核心服务先通过 `deploy/compose.yml` 启动并加入 `lingdian` 网络，然后执行：

```bash
cd deploy/observability
./observability.sh install
```

生产 release 采用 `/opt/lingdian/releases/<sha>` 时，应把 env 和生成状态放在 release 目录之外。这样切换 `current` 软链接或执行新版本脚本时不会重置 Grafana 密码、告警配置和探测目标：

```bash
sudo install -d -m 700 /opt/lingdian/observability
sudo cp deploy/observability/.env.example /opt/lingdian/observability/observability.env
sudo chmod 600 /opt/lingdian/observability/observability.env
sudo env \
  OBSERVABILITY_ENV_FILE=/opt/lingdian/observability/observability.env \
  OBSERVABILITY_STATE_DIR=/opt/lingdian/observability \
  /opt/lingdian/current/deploy/observability/observability.sh install
```

后续升级使用相同两个环境变量调用 `upgrade`。脚本会复用已存在的 `grafana-admin-password`，不会重新生成。

首次执行会创建 `.env`、Grafana 随机管理密码、合成探测目标和有效的 Alertmanager 配置。若配置了 `ALERT_WEBHOOK_URL`，告警会向该 HTTPS 地址发送 JSON；未配置时告警仍保留在 Alertmanager 和 Grafana 中。

常用入口：

```bash
./observability.sh check
./observability.sh status
./observability.sh logs grafana
./observability.sh restart
./observability.sh stop
./observability.sh down
```

`stop` 和 `down` 均保留具名 volumes；没有提供自动删除历史数据的命令，避免误清空日志和指标。

## 安全访问

Grafana、Prometheus 和 Alertmanager 仅绑定服务器 `127.0.0.1`，默认不会暴露到公网。远程访问示例：

```bash
ssh -L 3001:127.0.0.1:3001 -L 9090:127.0.0.1:9090 -L 9093:127.0.0.1:9093 user@server
```

然后访问 `http://127.0.0.1:3001`。管理员密码保存在 `$OBSERVABILITY_STATE_DIR/grafana-admin-password`；本地默认状态目录 `generated/` 被 Git 忽略。

应用的 `/api/metrics` 仅包含方法、Nest 路由模板、状态码及 Node.js 进程指标，不记录用户、IP、URL 参数、请求 ID 等高基数标签。生产 Nginx 必须阻断该路径及其所有子路径，避免尾斜杠绕过：

```nginx
location ^~ /api/metrics { return 404; }
```

Prometheus 通过 `lingdian` Docker 内网直接抓取 `api:9000/api/metrics`。

Alloy 不直接挂载 Docker socket。只有隔离在 internal `docker_socket` 网络中的 `docker-socket-proxy` 能读取 socket，并且只开放容器与网络发现、日志流、事件、版本和 ping 所需的 GET 接口，所有 POST 和管理接口均关闭；核心业务容器无法访问该代理。代理根文件系统只读、去除全部 capabilities，并直接读取仓库内只读 HAProxy 配置，不需要在宿主状态目录生成可写配置。Grafana 密码和 Alertmanager 配置位于权限为 `0700` 的状态目录内；单个容器只读输入文件使用 `0644`，使去除 `CAP_DAC_READ_SEARCH` 的容器 uid 0 在 Linux 上仍可读取，而宿主其他用户无法穿越父目录。其余监控组件通过 internal `monitoring` 网络互联；仅 Prometheus 同时接入业务网络抓取 API，blackbox-exporter、Alertmanager 和 Grafana 接入独立出网网络，分别用于公网探测、可选 webhook 通知和让 Docker 发布仅回环地址可访问的管理端口。

Alloy 以非 root 的固定 UID/GID `473:473` 运行，并通过只读挂载采集宿主机 `/var/log/lingdian/nginx/*.log`。默认 `NGINX_LOG_GROUP_GID=4` 对应 Ubuntu/Debian 的 `adm` 组；其他系统应以 `getent group adm` 的结果覆盖该值，否则 Alloy 无法进入权限为 `0750` 的日志目录。它会解析核心 Nginx 的 `lingdian_json` 格式。Nginx 只记录 method、无查询字符串的标准化 URI 和 protocol，不把 `$request`、`$request_uri`、`$args` 或 Referer 写入原始访问日志，避免 OAuth code/token 在采集前落盘。Docker stdout 中若仍出现常见 `token`、`code`、`authorization`、`password`、`secret`，Alloy 会在发送至 Loki 前替换为 `[REDACTED]`。

核心 Compose project name 只支持 `lingdian`、`lingdian-*` 或 `lingdian_*`，以保持 dashboard、Prometheus 与 Loki 规则的统一过滤范围；使用允许的自定义名称时，必须在观测 `.env` 中同步设置 `CORE_COMPOSE_PROJECT_NAME`，否则容器日志会被过滤。共享网络名由 `LINGDIAN_NETWORK` 控制。

## 保留、容量与磁盘保护

- Prometheus 默认保留 30 天，同时设置 20GB 硬上限，先达到任一条件即清理旧 block。
- Loki 默认保留 14 天，并限制单实例写入速率；Loki filesystem 模式没有可移植的 volume 字节配额，因此由保留期以及主机磁盘告警共同保护。
- Alertmanager 告警历史默认保留 120 小时。
- 所有容器 stdout 使用 `json-file` 轮转：单文件 20MB，最多 5 个。
- 默认监控容器内存上限合计约 3GiB。连同 MySQL 和核心服务，建议新服务器至少 8GiB 内存、40GiB 可用磁盘。

安装脚本会执行容量门禁。低配机器只能在确认风险后设置 `ALLOW_LOW_RESOURCES=true`，并在 `.env` 中调低各组件的 `*_MEMORY_LIMIT`；过低限制可能导致 Prometheus/Loki OOM 或采集数据暂时丢失。

预置告警覆盖 API 不可达、5xx 比例、P95 延迟、事件循环阻塞、公网站点、TLS 到期、主机 CPU/内存、磁盘不足/写满趋势、容器内存、监控组件状态，以及备份失败、超时未更新和指标缺失。Loki ruler 另外监测 API 致命错误、错误日志突增和 Nginx 5xx 突增。

这是与业务同机部署的观测栈：整机断电、宿主网络中断或磁盘完全损坏时，Alertmanager 也会同时离线，无法自行发送告警。正式生产至少应再从另一台机器或第三方 uptime 服务探测公网首页与 `/api/health/ready`。同机数据库备份和 uploads 也不能覆盖整机丢失，必须定期加密复制到异机或对象存储，并独立演练恢复。

## 预置视图与日志查询

Grafana 自动加载 Prometheus 和 Loki 数据源，以及“LingDian 服务总览” dashboard。它包含 API 状态/吞吐/错误率/延迟、主机资源、容器内存、公网探测和错误日志。

常用 LogQL：

```logql
{compose_service="api"} | json | requestId="request-id"
{compose_project=~"lingdian.*", level=~"ERROR|FATAL"}
{job="nginx", status=~"5.."}
```

## 更新与验证

```bash
./observability.sh check
./observability.sh upgrade
```

`check` 会校验 Compose、Prometheus 规则、Alertmanager、Loki、Alloy 和 dashboard JSON。`upgrade` 只拉取 Compose 中同时固定 tag 与 manifest digest 的镜像，不会自动漂移到 `latest` 或被同名 tag 替换。
