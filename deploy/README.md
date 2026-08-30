# LingDian 单机生产部署

这是当前唯一受支持的服务器部署入口。旧的固定 Lighthouse 路径、手工容器切换和
静态 Nginx 配置已经废弃；`release.sh` 仅保留旧调用签名并转发到本流程。

目标环境是 Ubuntu/Debian 单机，使用 Docker Compose 运行 API、三个前端和可选的
MySQL 8.4，宿主机 Nginx/Certbot 终止 TLS。应用端口、Grafana、Prometheus 和
Alertmanager 都只绑定 `127.0.0.1`。

## 最短部署流程

先把四个域名的 A 记录唯一解析到新服务器（不得混入旧服务器 A 记录），并确保安全组
允许 22、80、443。当前部署配置只启用 IPv4；四个域名不得残留 AAAA 记录，否则预检
会在 ACME 首签前拒绝继续。代码
必须提交到 Git；部署始终从指定 commit 导出 release，不会把当前工作区未提交文件打进镜像。

```bash
git clone <repository-url> lingdian
cd lingdian
sudo bash deploy/scripts/bootstrap-host.sh --user "$USER"
```

首次 bootstrap 会安装 Docker Compose v2、Nginx、Certbot 和基础运维工具，创建
`/opt/lingdian`，把 uploads 目录设为 API 运行用户 `1000:1000`，并创建权限为
`0600` 的 `/etc/lingdian/production.env`。生产配置固定存放在 `/etc/lingdian/`
下，避免 systemd 沙箱无法读取或重启后丢失。退出并重新登录一次，使 Docker 组生效。
部署要求 Docker Compose 2.30.0 或更高版本，以原样传递密码和令牌中的 `$` 等字符。
若把 `/opt`、`/srv` 或 `/var` 放在独立持久盘，必须先完成挂载再运行 bootstrap；脚本会给
Docker 和备份单元写入覆盖全部持久目录的 `RequiresMountsFor`，并在创建数据目录前重启
Docker 以激活挂载依赖，防止盘未挂载时在根文件系统误启空库。
部署根目录不接受 `/mnt`、`/data` 或临时目录。

若要由脚本同时启用宿主机 UFW，追加 `--configure-firewall`；它会先放行当前 SSH 会话
端口（无 SSH 会话时默认 22）和 Nginx 的 80/443，再启用防火墙。非标准端口也可显式传
`--ssh-port PORT`，避免远程初始化时锁断 SSH。

编辑环境文件，替换所有 `CHANGE_ME`。账号初始密码必须为 12–128 位、同时包含
大小写字母、数字和符号，且管理员与商家密码不能相同。若需要把 Alertmanager 告警
直接推送到值班系统，在同一文件填写可选的绝对 HTTPS `ALERT_WEBHOOK_URL`；一体化部署
会自动同步到 release 之外的持久观测配置，无需维护第二份环境文件。然后执行：

```bash
bash deploy/scripts/deploy-all.sh --sha "$(git rev-parse HEAD)"
```

该命令依次完成：主机/配置预检、不可变镜像构建、迁移前备份、安全迁移、首门店和
账号幂等初始化、容器健康门禁、HTTP ACME 首签、HTTPS 切换，以及日志/指标/告警栈
安装。首次账号初始化成功后，一次性 `AUTH_BOOTSTRAP_*` 会默认从生产配置清空。
生产入口强制 `TLS_ENABLED=true`、`TLS_STAGING=false`，不接受 `--skip-tls`；临时 HTTP
站点只在 ACME 首签事务内部使用，并且除 challenge 外一律返回 `503`，不会明文代理业务。
签发或 HTTPS 切换失败时会恢复部署前 Nginx 配置，
首次部署还会停止未提交的核心容器，不会留下无 TLS、无监控但看似可用的业务服务。

如果服务器资源暂时不足以运行完整观测栈，先设置
`OBSERVABILITY_ENABLED=false`，再仅部署核心服务：

```bash
bash deploy/scripts/deploy.sh --sha "$(git rev-parse HEAD)"
```

## 数据库模式

默认 `DATABASE_MODE=local`，Compose 会启动不暴露宿主端口的 MySQL 8.4。本地私有
Docker 网络使用：

```text
mysql://lingdian:<url-safe-password>@db:3306/lingdian?allowPublicKeyRetrieval=true
```

`allowPublicKeyRetrieval` 只允许用于该私有网络。使用外部数据库时设置
`DATABASE_MODE=external`，将服务商 CA PEM 放到 `EXTERNAL_MYSQL_SSL_CA`，并让
`DATABASE_URL` 包含 `sslaccept=strict&sslcert=external-mysql-ca.pem`；备份客户端固定使用
`VERIFY_IDENTITY` 校验 CA 和主机名。外部账号需要具备迁移、初始化和一致性备份所需权限；
完整备份会读取 routines、events 和 triggers，但已通过 `--no-tablespaces` 避免要求全局
`PROCESS` 权限。

API 容器只接收从生产配置生成的严格 allowlist runtime env；MySQL root 密码、部署
目录、备份设置和一次性初始化凭据不会进入长期运行的 API 容器。

## 更新、状态与日志

```bash
# 拉取 origin/main 并从远端 commit 原子升级
bash deploy/scripts/upgrade.sh

# 查看容器、四个健康端点、Nginx、TLS 和公网 metrics 阻断
bash deploy/scripts/status.sh

# 查看全部或单个服务日志
bash deploy/scripts/logs.sh --tail 200
bash deploy/scripts/logs.sh api -f

# 预览/执行安全清理；永远保留 current、previous、备份引用版本和最近 5 版
bash deploy/scripts/cleanup.sh
bash deploy/scripts/cleanup.sh --apply --confirm PRUNE_OLD_LINGDIAN_RELEASES
```

Docker stdout/stderr 默认单文件 20MB、保留 5 个；Nginx JSON 访问日志每天/10MB 轮转，
保留 14 份。每次成功部署会执行同一受控清理策略，只删除经过 SHA marker 验证的旧
LingDian release 目录及 `lingdian/{api,app,merchant,admin}:<sha>` 精确镜像标签；不会运行
`docker system prune`，也不会删除 current、previous 或仍被备份引用的版本。完整观测栈
说明见 [observability/README.md](observability/README.md)：Grafana、
Prometheus、Loki、Alloy、Alertmanager、主机/容器 exporter 和公网 blackbox 探测均有固定
版本与持久卷。容量预检会同时检查部署数据所在文件系统和 Docker Root Dir（命名卷、
镜像与构建缓存所在位置），两者分盘时都必须满足余量门禁。`/api/metrics` 仅允许 Prometheus 从 `lingdian` Docker 网络访问，公网
Nginx 对该路径及其子路径（包括大小写和尾斜杠变体）返回 404。

生产使用的 MySQL 与备份归档镜像均采用 `name:tag@sha256:digest` 固定；升级基础镜像时
应在代码评审中同时更新 tag、manifest digest 并完成一次空库迁移与备份恢复演练。预检
拒绝浮动 tag 和 `latest`。

## 备份、回滚与恢复边界

每天 02:17 的 systemd timer 会备份数据库和 uploads；每次迁移和人工回滚前也会先
备份。备份位于 `/opt/lingdian/backups`，包含压缩 SQL、uploads、元数据和 SHA-256
校验文件，默认保留 14 天。元数据分别记录快照对应的当前应用 SHA 和执行备份工具的
SHA，避免把“准备发布的新版本”误当成快照版本。首次部署前的空库快照没有已部署应用
基线，`snapshotHasDeployedRelease=false`，自动恢复会拒绝使用它。监控会记录备份最近
尝试、成功状态和成功时间；失败持续 10 分钟、30 小时没有新成功备份或首次 30 小时仍
无备份记录都会告警。

```bash
# 立即备份
bash deploy/scripts/backup.sh --reason manual

# 切回 previous 对应的不可变应用镜像
bash deploy/scripts/rollback.sh

# 指定历史完整 SHA
bash deploy/scripts/rollback.sh --sha <40-character-sha>
```

应用回滚不会自动反向执行数据库迁移；脚本会明确打印最近的恢复备份。恢复前必须先在
隔离 MySQL 中导入 SQL、核对行数和关键业务数据，不能把第一次恢复尝试放在生产库。

```bash
# 非破坏性校验：核对目录白名单、SHA256SUMS、gzip 和 metadata release SHA
bash deploy/scripts/restore.sh --backup /opt/lingdian/backups/lingdian-...

# 仅限 DATABASE_MODE=local；会先再做一份 safety backup，然后停止 API，
# 替换数据库/uploads，并切到与备份 metadata 对应的保留镜像
bash deploy/scripts/restore.sh \
  --backup /opt/lingdian/backups/lingdian-... \
  --apply-local --confirm RESTORE_LOCAL_DATABASE_AND_UPLOADS
```

外部数据库禁止自动覆盖：完成 `sha256sum -c SHA256SUMS` 和隔离库演练后，由 DBA 使用
TLS 连接执行导入，再按备份 `metadata.json` 的 `releaseSha` 回滚应用。不要用 `git reset`
或镜像回滚冒充数据恢复。

## TLS 和权限

首次签发先安装可用的 HTTP 站点与 ACME 路径，证书成功后才原子切换 HTTPS。已有证书
续期失败时不会降级现有 HTTPS。Certbot 保存固定的 Nginx reload hook，系统 timer
负责自动续期。

部署账号需要 Docker 权限，并需要通过 `sudo` 执行 Nginx/Certbot 和受保护配置替换。
`bootstrap-host.sh` 会安装 `sudo` 并为所选专用部署账号建立经 `visudo` 校验的无密码
策略；Docker socket 权限本身已经等价于宿主机 root，因此该账号必须是受控的专用运维
账号，不能提供给普通业务用户。生产环境文件仍固定为 `0600`，不得改成组/全局可读。

## 新服务器上线验收清单

部署前必须逐项确认：

- 服务器为受支持的 Ubuntu/Debian，至少 8GiB 内存，部署数据盘和 Docker Root Dir
  各自满足容量预检，建议均预留至少 40GiB；
- 四个域名只有指向新服务器的 A 记录，没有旧服务器 A 记录和 AAAA 记录，安全组已开放
  SSH、80 和 443；
- 独立持久盘已完成开机自动挂载，之后才运行 `bootstrap-host.sh`；
- 待部署代码已经提交，`git status --short` 为空，目标 SHA 是经过测试的完整 40 位 commit；
- `/etc/lingdian/production.env` 权限为 `0600`，不存在 `CHANGE_ME`，四个域名、数据库、
  JWT、短信/OAuth、主门店和首批账号配置均为生产值；
- 外部数据库 CA、账号权限、备份权限已验证；值班 webhook 和异机备份目的地已准备。

部署成功后，在服务器执行以下验收：

```bash
bash deploy/scripts/status.sh
bash deploy/scripts/logs.sh --tail 200
bash deploy/scripts/backup.sh --reason post-deploy-acceptance

curl --fail --silent --show-error "https://<APP_DOMAIN>/" >/dev/null
curl --fail --silent --show-error "https://<MERCHANT_DOMAIN>/" >/dev/null
curl --fail --silent --show-error "https://<ADMIN_DOMAIN>/" >/dev/null
curl --fail --silent --show-error "https://<API_DOMAIN>/api/health/ready"

metrics_status="$(curl --silent --output /dev/null --write-out '%{http_code}' \
  "https://<API_DOMAIN>/api/metrics")"
test "$metrics_status" = 404
```

随后通过 SSH 隧道登录 Grafana，确认 Prometheus 与 Loki 数据源正常、四个 blackbox
目标为 up、Nginx/API 日志可检索、主机与容器指标有数据，并发送一条测试告警到值班
webhook。首次正式营业前至少完成一次隔离库恢复演练；同机备份必须按既定周期加密复制到
异机或对象存储。同机监控不能发现整机断电，必须另配异地 uptime 探测。

交接时记录实际 release SHA、证书到期时间、备份目录与异地副本、Grafana 密码文件位置、
值班联系人和一次恢复演练结果；不得在工单或文档中复制任何明文密钥。

## 失败语义

- 构建、备份、迁移或初始化失败：现有应用容器不切换。
- 新容器或 TLS 健康门禁失败：自动恢复上一 release 的应用容器。
- 数据库迁移不会被自动反向执行；日志会给出迁移前备份位置。
- 没有上一 release 的首次部署失败时，保留 HTTP/数据库现场供排查，不伪报成功。
