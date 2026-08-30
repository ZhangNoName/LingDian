# 后端：NestJS

后端工程位于 `backend/`，使用 NestJS 11、Prisma 7、MariaDB 和 TypeScript。`main.ts` 负责安全中间件、校验、统一响应、异常过滤和可选 Swagger；业务按 `src/modules/<domain>/` 组织。

## 分层

| 层 | 职责 |
| --- | --- |
| controller + DTO | HTTP 路由、输入校验、guard 组合 |
| application service | 用例、事务边界、数据范围与状态机 |
| domain/port | 稳定业务概念与外部能力接口 |
| adapter/provider | 短信、OAuth、connector 等易变 IO |
| `packages/db` | Prisma schema、迁移与 Client |
| `packages/contracts` | 对外 API 和事件契约 |

## 安全与发布

- 全局 ValidationPipe 启用 whitelist、transform 和 forbidNonWhitelisted。
- 用户、商家、平台管理员使用独立 audience guard。
- 生产 cookie 强制 Secure，CORS 只允许显式 origin，Swagger 默认关闭。
- 密钥只从环境读取；生产数据库变更使用 migration deploy。
- 外部平台事件采用事务 outbox，详细设计见 [08-integration-architecture.md](./08-integration-architecture.md)。

```bash
pnpm --filter @lingdian/api test
pnpm --filter @lingdian/api build
pnpm run db:migrate:deploy
```
