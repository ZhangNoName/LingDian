# 项目总览

## 目标

LingDian 是面向餐饮门店的多端点餐与经营系统，当前由消费者小程序、商家工作台、平台管理端、统一 API 和共享基础包组成。后端是唯一业务数据源；收银、打印和外卖平台通过可选连接器接入，不能反向侵入订单领域。

## 当前技术基线

| 层级 | 工程 | 技术与职责 |
| --- | --- | --- |
| 消费者端 | `uniapp/` | Vue 3 + uni-app；微信/QQ 小程序与 H5，共用 API 传输和协议层 |
| 商家端 | `web/` | Vue 3 + Vite + Element Plus/shadcn-vue；商品、订单、门店经营 |
| 平台端 | `admin/` | Vue 3 + Vite + Element Plus；平台账号、权限与系统日志 |
| API | `backend/` | NestJS + Prisma + MariaDB；鉴权、业务规则、持久化、集成 outbox |
| 契约 | `packages/contracts/` | 前后端共享且版本稳定的 DTO/事件类型 |
| 数据库 | `packages/db/` | Prisma schema、迁移与 Client 导出 |
| 基础能力 | `common/`、`packages/*` | 响应码、图标、可观测性等无业务状态能力 |
| 主题 | `theme/` | 管理端共享蓝色令牌与消费者小程序品牌令牌 |

## 系统边界

- `uniapp/` 只能包含公开 API 地址，不得包含 AppSecret、平台 token、连接器密钥或数据库配置。
- `admin/` 与 `web/` 使用不同 audience 和权限守卫，不能只依赖前端菜单隐藏。
- `backend/` 负责价格重算、订单幂等、门店/用户数据范围、第三方事件可靠投递。
- 外部平台不直接调用订单服务内部类。官方 SDK、证书和易变协议放在独立 connector 中，由 HMAC 签名的中立事件协议衔接。
- `packages/contracts/` 只放跨进程契约，不放页面 ViewModel 或 Prisma 实体。

## 关键运行链路

1. 小程序业务服务通过 `HttpTransport` 调用统一 API 协议层。
2. API 在事务中校验门店、SKU、选项、价格、用户归属并创建订单。
3. 若门店启用了可选集成，同一事务写入 `integration_outbox`。
4. worker 原子认领事件，通过对应 connector 投递；失败指数退避，超过上限进入死信。
5. connector 将稳定的 LingDian 事件翻译为收银、打印、美团或京东当前官方协议。

具体集成边界见 [08-integration-architecture.md](./08-integration-architecture.md)。
