# 本地开发与协作

## 前置条件

- Node.js LTS；pnpm 版本以根目录 `packageManager` 为准；
- MariaDB/MySQL，连接配置见 `backend/.env.example`；
- 微信/QQ 小程序原生能力需要对应开发者工具与真实体验账号。

## 启动与验证

```bash
pnpm install
pnpm dev
pnpm run test:all
pnpm run type-check
pnpm run build
```

生产部署数据库结构必须执行 `pnpm run db:migrate:deploy`，不能用 `db:push` 代替迁移历史。

## 环境变量

- 后端：从 `backend/.env.example` 复制本地 `.env`，真实文件不提交。
- 小程序：公开 API 入口使用 `VITE_API_BASE`，示例见 `uniapp/.env.example`；生产必须 HTTPS。
- `WECHAT_*_SECRET`、`QQ_*_SECRET`、短信 token 和 integration signing secret 只允许出现在服务端密钥系统。
- Swagger 在非生产默认启用；生产默认关闭，仅排障环境可显式设置 `SWAGGER_ENABLED=true`。

## 变更规则

- API 契约先更新 `packages/contracts/`，再改调用方；破坏性事件变更提升 schema version。
- Prisma schema 变更必须同时提交 migration，并执行 generate/build。
- 页面颜色优先使用 `theme/` 语义令牌；管理端禁止另建主色体系。
- 外部平台逻辑通过 integration port/connector 接入，订单模块不得出现厂商 SDK。
- 合并前至少运行与改动相关的测试；共享包、主题、数据库或部署脚本变更运行全量测试和构建。
