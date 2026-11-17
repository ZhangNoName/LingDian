# LingDian

零点点餐一体化项目，面向餐饮门店的多端点餐与经营管理场景。

## 生产部署

Ubuntu/Debian 新服务器使用统一的单机部署入口。主机初始化并填写受保护的生产配置后，
一条命令完成不可变镜像构建、MySQL 迁移与首店初始化、健康门禁、TLS，以及
Prometheus/Grafana/Loki/Alloy 日志指标告警栈：

```bash
sudo bash deploy/scripts/bootstrap-host.sh --user "$USER"
# 编辑 /etc/lingdian/production.env，替换所有 CHANGE_ME
bash deploy/scripts/deploy-all.sh --sha "$(git rev-parse HEAD)"
```

完整前置条件、配置、备份恢复、回滚和监控访问方式见
[生产部署 Runbook](./deploy/README.md)。历史 Lighthouse 文档不再作为执行依据。

当前技术方向：

- `uniapp/`：用户端小程序/H5，后续可平滑扩展 App
- `web/`：Web 端门户/运营端基础前端
- `backend/`：Node.js + NestJS API 服务端，包名为 `@lingdian/api`
- `admin/`：轻量运营管理端
- `common/`：通用响应码与工具
- `packages/db/`：Prisma schema、Prisma Client 导出与数据库脚本
- `packages/contracts/`：前后端共享接口类型
- `theme/`：统一设计令牌，保证 Web 与 uni-app 颜色配置一致
- `docs/`：PRD、架构说明、开发约定

## 当前工程目标

- 统一三端技术基线
- 建立可复用的品牌主题与颜色令牌
- 搭建点餐业务骨架
- 输出一份可直接推进研发排期的详细 PRD

## 目录说明

| 目录 | 说明 |
| --- | --- |
| `backend/` | NestJS API 服务、业务模块 |
| `admin/` | 运营管理端 |
| `web/` | Web 前端基础工程，适合官网、门店展示、运营工作台扩展 |
| `uniapp/` | C 端点餐入口，默认面向微信小程序/H5 |
| `common/` | 通用响应码与工具函数 |
| `packages/db/` | Prisma schema、Prisma Client 导出与数据库脚本 |
| `packages/contracts/` | 商品、订单、响应等共享接口类型 |
| `theme/` | 单一主题源，包含 `json/css/scss/ts` 四种消费形式 |
| `docs/` | 产品文档、PRD、研发协作文档 |

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

首次安装会自动执行 Prisma generate 与基础包构建。也可以手动执行：

```bash
pnpm run prisma:generate
pnpm run build:packages
```

### 2. 配置本地开发数据库与门店

本地开发 API 启动前准备 `backend/.env`、数据库结构和 `PRIMARY_STORE_ID` 对应的门店行：

```bash
cp backend/.env.example backend/.env
# 编辑 backend/.env：至少确认 DATABASE_URL、STORE_MODE=single、PRIMARY_STORE_ID
pnpm run db:push
```

若数据库中已经有正式开发门店，把它的 ID 写入 `PRIMARY_STORE_ID` 即可。只有可随时丢弃的本地开发/测试库才能运行演示 seed；它会重置演示业务数据，并且必须显式授权：

```bash
NODE_ENV=development ALLOW_DEMO_SEED=true pnpm run db:seed:demo
```

演示 seed 只接受 `NODE_ENV=development` 或 `NODE_ENV=test`，且必须同时设置 `ALLOW_DEMO_SEED=true`；生产和共享数据库禁止运行。生产环境使用安全迁移和幂等 production bootstrap，不能用 `db:push` 或 demo seed 初始化。

### 3. 启动开发服务

```bash
pnpm dev
```

默认同时启动 `api`、`admin` 和 `uniapp`。也可以按项目单独启动：

```bash
pnpm run dev:api
pnpm run dev:admin
pnpm run dev:uniapp
pnpm run dev:web
```

### 4. Windows 启动脚本

```powershell
.\start.ps1 dev
.\start.ps1 api
.\start.ps1 admin
.\start.ps1 web
.\start.ps1 uniapp
.\start.ps1 all
```

`backend` 仍作为 `api` 的兼容别名，`miniapp` 仍作为 `uniapp` 的兼容别名。

### 5. 构建与验证

```bash
pnpm run test
pnpm run type-check
pnpm run build
```

### 6. 数据库脚本

```bash
pnpm run prisma:generate
pnpm run db:push
NODE_ENV=development ALLOW_DEMO_SEED=true pnpm run db:seed:demo
```

`db:push` 与 demo seed 都只用于可丢弃的本地开发/测试库。生产环境由部署脚本执行
`db:migrate:deploy`；该命令会识别空库/兼容旧库、应用已审查迁移，并在结束后检查实际
结构与 `schema.prisma` 是否漂移。不要在生产库运行 `db:push`。

## 认证账户初始化（灵点点餐系统）

生产首装使用合并后的幂等 bootstrap，同时创建/校验主门店、超级管理员和商家账号：

```bash
corepack pnpm run db:migrate:deploy
corepack pnpm run db:bootstrap:production
```

初始化命令从部署环境读取以下变量，仓库、文档和日志均不得写入它们的实际密码值：

```dotenv
STORE_MODE=single
PRIMARY_STORE_ID=<existing-store-id>
AUTH_BOOTSTRAP_SUPER_ADMIN_USERNAME=
AUTH_BOOTSTRAP_SUPER_ADMIN_PASSWORD=
AUTH_BOOTSTRAP_SUPER_ADMIN_PHONE=
AUTH_BOOTSTRAP_MERCHANT_USERNAME=
AUTH_BOOTSTRAP_MERCHANT_PASSWORD=
AUTH_BOOTSTRAP_MERCHANT_PHONE=
AUTH_BOOTSTRAP_MERCHANT_STORE_IDS=<same-value-as-PRIMARY_STORE_ID>
STORE_BOOTSTRAP_CODE=
STORE_BOOTSTRAP_NAME=
```

默认单店模式使用 `STORE_MODE=single`，且
`AUTH_BOOTSTRAP_MERCHANT_STORE_IDS` 必须与 `PRIMARY_STORE_ID` 完全相同。bootstrap
会在串行化事务中幂等创建尚不存在的门店与账号；初始密码必须为 12–128 位并包含
大小写字母、数字和符号，两个账号不能共用密码。新建或由 bootstrap 更新凭据的账号会
被标记为首次登录必须改密。正式部署成功后，一次性账号凭据默认从生产配置中清除。

## 多店与租户隔离

需要共享 API 管理多家门店时配置 `STORE_MODE=multi`，保留一个已存在的 `PRIMARY_STORE_ID` 作为公开默认门店及 readiness 检查对象。通过平台账号管理为商家分配已存在的门店；多店商家在 Web 顶部明确选店后操作，接口按会话授权范围校验 `X-Store-Id`，不能靠请求参数扩大权限。新增门店当前仍需受控 bootstrap 或运维流程，尚无自助租户注册。

公开门店和菜单接口支持 `?storeId=...`；现有顾客前端仍默认进入主门店，未提供多店选店入口。详细边界见 [多店运行时迭代记录](./docs/16-multi-store-iteration-2026-11-17.md)。

## 微信小程序用户能力

微信手机号快捷登录、昵称/头像、收货地址与配送下单依赖服务端的小程序凭据：

```dotenv
WECHAT_MINI_APP_ID=
WECHAT_MINI_APP_SECRET=
```

AppSecret 只能配置在 API 部署环境，不能写入 `uniapp/`、前端环境变量或日志。部署新版本前必须执行 `corepack pnpm run db:migrate:deploy`，以创建用户地址表和资料/配送快照字段。微信公众平台的《用户隐私保护指引》需如实声明手机号、头像昵称和收货地址的使用目的；原生授权能力必须用真实开发者或体验账号在微信开发者工具和真机上验收。详细联调步骤见 [uni-app 前台说明](./docs/03-frontend-uniapp.md#微信原生用户能力联调)。

## 文档入口

- [产品 PRD](./docs/00-prd.md)
- [文档索引](./docs/README.md)
- [后端说明](./backend/README.md)


库存订单联动、隔离 MySQL 验证与历史迁移修正说明见 [订单库存迭代](./docs/18-order-inventory-2026-11-17.md)。本次修正了旧支付迁移中超长的唯一索引名称；目标库若存在该迁移失败、人工 resolve 或校验和不一致，应先停写核对部分 DDL 与实际结构，制定前向修复/备份恢复方案，不能直接把失败迁移标记为成功。新增配方预占迁移必须经安全迁移入口部署；未配置配方的规格不提供自动限量承诺。

商品与菜单的中英文、手机布局、配置版本/审计与兼容边界见 [商品配置迭代](./docs/22-product-catalog-2026-11-17.md)。本轮新增 `products.configurationVersion` 迁移；先走安全迁移入口，再同步发布 API 与商家 Web。商家旧客户端缺少 `expected_version` 的修改将被拒绝；平台旧接口仍兼容无版本写入。

供应商、采购单和分批入库见 [采购迭代](./docs/23-purchasing-2026-11-17.md)。部署本轮前需通过安全迁移入口应用 `20261117_warehouse_purchasing`；既有手工库存记录不补造采购来源，采购入库自动进入原料流水、预警和区间报表。

收货期间分析、完整快照 CSV 与未收采购补货建议见 [采购分析](./docs/24-purchasing-analysis-2026-11-17.md)。本轮增加查询索引迁移 `20261117_warehouse_reports`；补货建议不增加现货或下单可用库存。

商家商品草稿、资料维护和菜单发布见 [商品建档与发布](./docs/26-merchant-catalog-2026-11-17.md)。部署前通过安全迁移入口应用 `20261117_z_merchant_catalog`，以保存创建请求键并支持较长商品说明。

预警和库存可直接定位补货原料，并追查尚未收齐的采购单；已收齐原料不再计入部分收货单的未收单数。见 [补货追查迭代](./docs/27-replenishment-follow-through-2026-11-17.md)，本轮无需新增迁移。

库存增加可保存实盘与复核差异的独立盘点单，确认后整单过账至流水、报表和预警。部署前通过安全迁移入口应用 `20261118_warehouse_stocktakes` 并重新生成 Prisma Client，详见 [盘点单迭代](./docs/28-stocktakes-2026-11-18.md)。
