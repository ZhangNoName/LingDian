# LingDian

零点点餐一体化项目初始化仓库，面向餐饮门店的多端点餐与经营管理场景。

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

## 当前初始化目标

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

### 2. 启动开发服务

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

### 3. Windows 启动脚本

```powershell
.\start.ps1 dev
.\start.ps1 api
.\start.ps1 admin
.\start.ps1 web
.\start.ps1 uniapp
.\start.ps1 all
```

`backend` 仍作为 `api` 的兼容别名，`miniapp` 仍作为 `uniapp` 的兼容别名。

### 4. 构建与验证

```bash
pnpm run test
pnpm run type-check
pnpm run build
```

### 5. 数据库脚本

```bash
pnpm run prisma:generate
pnpm run db:push
pnpm run db:seed:demo
```

## 文档入口

- [产品 PRD](./docs/00-prd.md)
- [文档索引](./docs/README.md)
- [后端说明](./backend/README.md)
