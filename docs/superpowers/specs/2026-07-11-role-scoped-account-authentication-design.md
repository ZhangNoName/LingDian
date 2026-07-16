# 灵点点餐系统：三端账号认证与门店授权设计

## 目标与边界

为灵点点餐系统提供三端隔离的认证与授权能力：

| 客户端 | 会话受众 | 可登录主体 | 登录方式 |
| --- | --- | --- | --- |
| `admin/` | `admin-api` | 后台管理员与超级管理员 | 账号密码 |
| `web/` | `merchant-api` | 商家 | 账号密码 |
| `uniapp/` | `user-api` | 消费者用户 | 手机验证码、微信、QQ |

商家不得自助注册。只有拥有 `SUPER_ADMIN` 角色的后台用户能创建、启用或禁用商家账号，并调整其门店范围。每个商家账号必须至少拥有一个门店范围，也可以拥有多个门店范围。现有 `USER`、`ADMIN` 角色继续保持兼容；`SUPER_ADMIN` 是后台管理的高权限角色，`MERCHANT` 是门店范围角色。

本设计不增加消费者账号密码登录；`uniapp/` 不提供忘记密码或修改密码；`admin/` 只提供账号密码登录，不提供密码找回或修改界面。只有商家 `web/` 提供忘记密码和修改密码。商家会话不得调用后台管理接口，后台会话也不得调用商家端接口。

## 身份、凭据与角色模型

`AuthIdentity` 新增 `ACCOUNT` provider。账号身份的 `subject` 与新增的 `accountName` 均保存规范化账号名（小写、去首尾空格），`accountName` 是仅供账号身份使用的可空唯一列，用于在数据库层防止 `admin` 与 ` admin` 等规范化碰撞；账号身份创建时两个值必须相同。账号身份与手机号身份都关联至同一个 `User`。`User` 新增可选 `nickname` 字段，最长 32 个字符且不设唯一约束；它是所有用户的显示名，不是登录账号，也不参与权限判断。

新增 `PasswordCredential` 一对一关联到 `ACCOUNT` 身份，保存下列字段：

- `identityId`：唯一外键；
- `passwordHash`：Node `crypto.scrypt` 产生的带参数、随机 salt 的编码哈希；
- `passwordChangedAt`：最近密码变更时间；
- `createdAt`、`updatedAt`。

绝不保存明文密码、可逆加密密码、验证码或重置令牌。密码校验使用固定格式和 timing-safe 比较。

`UserRoleAssignment` 新增枚举值 `SUPER_ADMIN`、`MERCHANT`。商家授权必须是 `role=MERCHANT`、`scopeType=STORE`、`scopeId=<store id>`；创建请求至少带一个不同的、真实存在的门店 ID。一个商家可拥有多条此类角色分配。`SUPER_ADMIN` 与既有 `ADMIN` 可以通过 `AdminGuard` 访问后台管理能力；仅 `SUPER_ADMIN` 可管理商家账号。

`AuthSession.audience` 增加 `MERCHANT_API`。JWT 与访问守卫的受众映射为 `admin-api`、`merchant-api`、`user-api`，不同受众不得互用。

## 账号与密码流程

### 账号密码登录

`POST /api/auth/account/login` 接收 `username`、`password`、`audience` 和设备信息。服务端按 `ACCOUNT` 身份查找、校验密码、验证用户状态及有效角色后签发对应受众会话：

- `admin-api` 必须含 `ADMIN` 或 `SUPER_ADMIN`；
- `merchant-api` 必须至少含一条有效、范围为真实门店的 `MERCHANT` 分配；
- `user-api` 不接受账号密码登录。

登录失败始终返回通用凭据错误，不区分账号不存在、密码错误、禁用或角色不匹配。审计记录结果、受众、设备与 IP，但不记录账号明文密码。

### 商家忘记与重置密码

`POST /api/auth/password/forgot` 仅接受 `merchant-api` 账号和目标受众。只有账号存在、主体有效、受众匹配且绑定了已验证手机号时，服务端为该手机号签发 `PASSWORD_RESET` 验证码；对外始终返回相同的接受响应，防止账号枚举。

`POST /api/auth/password/reset` 接收账号、目标受众、手机号验证码与新密码。验证成功后原子更新该账号密码、递增该用户 `sessionVersion`、吊销全部现存会话并写入审计。验证码 5 分钟有效且仅能使用一次，沿用手机号、IP、设备三级限流。

### 修改密码

商家修改密码与忘记密码使用相同的手机号验证码流程，不校验旧密码。有效 `merchant-api` 会话通过 `POST /api/auth/password/change/code` 为当前账号的已验证手机号申请 `PASSWORD_RESET` 验证码，再通过 `POST /api/auth/password/change` 提交验证码与新密码。服务端将两条确认请求统一委托给同一个密码重置操作：原子更新密码、递增 `sessionVersion`、吊销该用户所有会话；调用该接口的当前会话也必须重新登录。

商家忘记密码使用 `POST /api/auth/password/forgot` 申请同一用途的验证码，并通过 `POST /api/auth/password/reset` 提交账号、目标受众、验证码和新密码。两种流程的验证码期限、限流、反枚举策略、密码校验、会话吊销和审计规则完全一致；区别仅在于修改密码的验证码目标由当前会话确定，而忘记密码的验证码目标由账号和受众查找。所有新密码长度至少 12 字符。

## 超级管理员、商家管理与初始化

新增仅限 `SUPER_ADMIN` 的商家管理 API：

- `POST /api/admin/merchants`：创建用户、账号身份、密码凭据、已验证手机号和至少一个门店范围；
- `GET /api/admin/merchants`：列出商家及其门店范围；
- `PATCH /api/admin/merchants/:userId`：调整门店范围或启用/禁用账号；

`admin/` 增加账号密码登录页、商家账号管理页面和当前管理员昵称编辑入口；创建表单要求账号、手机号、初始密码以及至少一个门店。`web/` 改为商家登录页，只请求 `merchant-api` 会话，并提供忘记密码、修改密码和当前商家昵称编辑页面。`uniapp/` 保持现有用户手机号和第三方登录流程，并在个人资料中提供昵称编辑；小程序不展示账号密码、忘记密码或修改密码入口。

后端提供幂等的 `db:seed:auth-bootstrap` 命令，只在明确配置时创建或更新启动账户。使用下列环境变量，所有密码变量只存于部署或本机密钥环境：

```dotenv
AUTH_BOOTSTRAP_SUPER_ADMIN_USERNAME=
AUTH_BOOTSTRAP_SUPER_ADMIN_PASSWORD=
AUTH_BOOTSTRAP_SUPER_ADMIN_PHONE=
AUTH_BOOTSTRAP_MERCHANT_USERNAME=
AUTH_BOOTSTRAP_MERCHANT_PASSWORD=
AUTH_BOOTSTRAP_MERCHANT_PHONE=
AUTH_BOOTSTRAP_MERCHANT_STORE_IDS=
```

超级管理员启动账户必须拥有 `SUPER_ADMIN` 和 `ADMIN` 全局角色。测试商家账户必须提供至少一个以逗号分隔的、存在的门店 ID；缺失、重复或无效门店 ID 时命令失败且不创建半成品账户。环境变量更改后再次执行命令会同步账号密码、状态与范围，并吊销该账号会话。

## 授权与数据隔离

新增 `MerchantGuard`，仅接受 `merchant-api` 受众且需要有效 `MERCHANT` 角色。商家业务查询和写入必须用 JWT 中的门店范围过滤；请求中提供的 store ID 必须包含在当前会话的 `MERCHANT` 范围内。后台路由保留 `AdminGuard`，商家管理路由额外使用 `SuperAdminGuard`。

现有需要后台权限的商品、分类、订单、库存和上传接口不得直接开放给商家。商家端会新增以 `merchant/*` 为前缀的、仅处理已授权门店的数据接口，从而避免客户端仅靠传入 store ID 越权。

## 安全与审计

- 密码哈希使用 `scrypt`，随机 16 字节 salt、64 字节派生值与明确的工作参数；验证用 `timingSafeEqual`。
- 所有密码修改、重置、失败登录、商家创建、禁用和范围变更均写入 `auth_audit_logs`，不写入密码、验证码或完整手机号。
- 忘记密码响应不泄露账号是否存在；验证码重放、跨用途和过期均拒绝。
- 所有已登录用户均可更新自己的昵称；昵称允许重复，且只能更新当前令牌所代表的用户主档案。
- 密码变更、重置、账号禁用、门店范围移除都会递增会话版本或吊销相关会话，确保旧 JWT 立即失效。
- 初始化密码只通过环境变量注入，`.env.example` 仅说明变量名，源码、迁移、文档、日志和 Git 均不包含默认密码明文。

## 数据库迁移与验收

新增 Prisma 迁移以扩展身份 provider、角色、会话受众与验证码用途，并创建 `PasswordCredential` 表及必要索引/外键。迁移必须以现有认证迁移为前提，使用已建立的 Prisma 迁移历史部署。

验收覆盖：

1. 超级管理员账号密码可获得 `admin-api` 会话；普通管理员不能调用商家管理 API。
2. 商家账号密码可获得 `merchant-api` 会话，且无门店范围时被拒绝。
3. 商家不可访问后台路由，用户不可访问商家或后台路由。
4. 超级管理员创建商家时，空门店、重复门店、无效门店均失败；多门店范围被正确保存。
5. 忘记密码与修改密码均通过同一手机号验证码策略更新哈希并吊销会话，错误凭据不会泄露账号存在性。
6. 管理员、商家和用户均可编辑自己的昵称；相同昵称可同时存在，且昵称不会改变登录身份、门店范围或角色。
7. 启动初始化命令可以重复执行并按环境变量同步超级管理员和测试商家，不创建重复身份或角色。
8. `admin/`、`web/`、`uniapp/` 的构建、后端测试与迁移状态均通过。

## 上线运行手册

认证版本上线前先执行已检查入库的 Prisma 迁移，再执行幂等的启动账户初始化：

```bash
corepack pnpm run db:migrate:deploy
corepack pnpm --filter @lingdian/api db:seed:auth-bootstrap
```

初始化只读取以下七个部署环境变量，实际账号和密码不进入源代码、文档、迁移、审计日志或 Git：

```dotenv
AUTH_BOOTSTRAP_SUPER_ADMIN_USERNAME=
AUTH_BOOTSTRAP_SUPER_ADMIN_PASSWORD=
AUTH_BOOTSTRAP_SUPER_ADMIN_PHONE=
AUTH_BOOTSTRAP_MERCHANT_USERNAME=
AUTH_BOOTSTRAP_MERCHANT_PASSWORD=
AUTH_BOOTSTRAP_MERCHANT_PHONE=
AUTH_BOOTSTRAP_MERCHANT_STORE_IDS=
```

测试商家的 `AUTH_BOOTSTRAP_MERCHANT_STORE_IDS` 必须是以逗号分隔的真实门店 ID，并且至少包含一个门店；变量组不完整、启动账户密码少于 8 个字符或任一门店不存在时，脚本终止而不会留下半成品账户。该 8 字符规则仅适用于受控启动初始化，商家忘记密码与修改密码的新密码仍至少为 12 个字符。只有商家 Web 端包含忘记密码和修改密码页面；后台仅登录与商家管理，小程序仅保留用户手机号、微信和 QQ 登录。验收场景必须验证 `admin-api`、`merchant-api` 与 `user-api` 会话互不混用，且商家以错误受众登录时只得到通用凭据错误。
