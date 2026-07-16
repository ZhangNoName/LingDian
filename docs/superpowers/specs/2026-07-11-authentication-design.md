# 多端认证系统设计

## 目标与边界

为 uni-app、Web 门户和 Admin 提供统一认证能力。手机号是用户的唯一主身份；微信与 QQ 是可绑定的第三方登录凭据。所有正式账号（包括通过第三方授权进入的账号）都必须完成手机号验证码校验。

第一期角色只有 `USER` 与 `ADMIN`。用户端支持手机号验证码、微信、QQ；管理端仅支持手机号验证码，并且只接受具有有效 `ADMIN` 角色的会话。设计预留平台管理员与门店管理员的授权范围，但不在第一期实现。

不包含密码登录、管理员微信/QQ 登录、静默账号合并，以及组织/门店级授权管理。

## 架构

在 NestJS 后端新增独立 `auth` 模块，作为所有客户端的唯一认证入口。该模块负责验证码、第三方 OAuth 回调、手机号归并、会话、授权校验与审计；业务模块只信任由认证 Guard 建立的用户上下文。

`users` 表代表人，而非某一种登录方式。手机号、微信、QQ 均通过 `auth_identities` 表关联到一个用户。角色与会话分别独立存放，避免把登录方式、用户档案和授权耦合在同一张表。

| 数据实体 | 关键字段 | 约束与职责 |
| --- | --- | --- |
| `users` | `id`, `status`, `profile`, `sessionVersion` | 用户主档案；一个手机号对应一个用户。 |
| `auth_identities` | `id`, `userId`, `provider`, `subject`, `phoneE164`, `verifiedAt` | `provider + subject` 唯一；手机号以 `PHONE` 凭据保存，`phoneE164` 唯一。 |
| `user_roles` | `userId`, `role`, `scopeType`, `scopeId`, `status` | 一期的角色值为 `USER`、`ADMIN`；`scopeType/scopeId` 为日后平台/门店授权预留。 |
| `auth_sessions` | `id`, `userId`, `audience`, `refreshTokenHash`, `device`, `expiresAt`, `revokedAt` | 一设备一会话；用于刷新、登出与吊销。 |
| `verification_codes` | `purpose`, `targetHash`, `codeHash`, `expiresAt`, `consumedAt` | 不保存明文验证码；一次性消费。 |
| `auth_audit_logs` | `event`, `userId`, `sessionId`, `ip`, `device`, `metadata` | 记录登录、绑定、解绑、角色变更及风险事件。 |

## 注册、登录与关联流程

### 手机号验证码

1. 客户端请求发送验证码，服务端对手机号标准化为 E.164，并执行手机号、IP、设备三级限流。
2. 客户端提交手机号和验证码；服务端原子地验证验证码、标记已消费并查询 `PHONE` 凭据。
3. 如果已存在用户，创建会话并登录；如果不存在，事务内创建 `users`、已验证的 `PHONE` 凭据及默认 `USER` 角色，再创建会话。

### 微信或 QQ 登录/注册

1. 客户端发起 OAuth 授权码流程，服务端生成并校验 `state`，并在供应商支持时启用 PKCE；授权码只在服务端交换第三方身份。
2. 无论该第三方身份是否已存在，都进入手机号验证码校验页；未完成该步骤不得签发正式会话或创建正式用户。
3. 手机号已关联用户时，在事务中将未绑定的第三方身份绑定到该用户；手机号不存在时，创建用户、手机号凭据和第三方凭据。
4. `provider + subject` 已关联到另一个用户时拒绝操作，不做静默合并。微信优先以可获得的 `unionid` 为 `subject`；若供应商未返回 `unionid`，使用 `appId:openid`。QQ 使用 `appId:openid`，避免不同应用下的标识碰撞。

### 登录后绑定与冲突处理

已登录用户可发起微信/QQ 绑定。服务端要求当前会话有效并完成近期二次验证，再完成 OAuth 回调和唯一性检查。外部身份或手机号归属其他用户时，提示走人工账号找回/合并流程；该流程必须同时校验两侧凭据并产生审计记录，第一期不实现自动合并。

## 会话与权限隔离

- 登录成功签发 15 分钟访问令牌与 30 天刷新令牌。访问令牌含 `sub`、`sid`、`aud` 和授权版本；刷新令牌为随机值，数据库只保存哈希。
- 用户会话使用 `aud=user-api`；后台会话使用 `aud=admin-api`。后台登录在验证码验证后还必须检查有效 `ADMIN` 角色，缺失则拒绝签发会话。
- API Guard 顺序为：验签与过期检查、受众检查、会话未吊销检查、用户状态检查、角色/范围检查。用户令牌不可调用后台路由，后台令牌也不默认获得用户业务以外的权限。
- 浏览器用 `HttpOnly`、`Secure`、合适 `SameSite` 的 Cookie 保存刷新令牌；uni-app/App 使用平台安全存储。不得把刷新令牌写入 LocalStorage。
- 角色撤销、用户禁用、强制登出时递增 `sessionVersion` 并吊销相关会话；后续令牌请求立即失效。

## 安全与运营规则

- 验证码为 6 位随机码，5 分钟有效且只能使用一次；仅保存哈希。高频或连续失败请求触发图形验证码/人机校验。
- OAuth 密钥、短信服务密钥和第三方长期令牌仅在服务端以环境变量或密钥服务保存；第三方长期令牌加密后持久化，若无需持久化则不保存。
- 手机号、OAuth subject 与 IP 在日志中脱敏；审计日志保留事件类型、时间、设备与风险结果，避免保存验证码、访问令牌或刷新令牌明文。
- 认证接口启用 HTTPS、CORS 白名单、请求体大小限制、通用速率限制与异常告警。
- 管理端应配置更严格的会话超时与登录风险策略；第一期不强制 MFA，但认证接口保留 `purpose` 与风险评分扩展点。

## API 边界

认证模块提供以下逻辑接口，具体路径可按现有 API 约定落地：

- `sendCode(purpose, phone)`：发送手机号验证码。
- `phoneLogin(phone, code, audience)`：手机号注册或登录；`audience=admin-api` 时验证 `ADMIN`。
- `beginOAuth(provider, audience)` / `completeOAuth(provider, code, state)`：启动及完成微信/QQ 授权。
- `verifyPhoneAndLink(pendingOAuthId, phone, code)`：完成第三方授权后的手机号验证、用户创建或归并。
- `bindIdentity(provider, authorization)` / `unbindIdentity(identityId)`：已登录用户管理第三方凭据，解绑前需保证手机号凭据仍存在。
- `refresh(refreshToken)`、`logout(sessionId)`、`logoutAll()`：会话刷新与吊销。

业务接口通过 `CurrentUser` 上下文获取 `userId`、`sessionId`、`audience`、角色和授权范围，不直接接收可伪造的用户 ID 或角色字段。

## 错误处理

认证失败对外统一使用有限的错误码，避免泄露账号存在性或第三方身份归属：验证码无效/过期、请求过频、授权失效、账号已禁用、无后台权限、会话失效、身份已关联。内部审计记录详细原因与关联 ID。第三方回调、短信服务或数据库暂时失败时不创建半成品用户，使用事务或可重试的待绑定状态保证幂等。

## 验收与测试

1. 同一手机号在小程序、H5、App 和 Web 登录后均返回同一用户 ID。
2. 微信或 QQ 首次登录必须验证手机号；使用已有手机号时只新增凭据而不新增用户。
3. 并发手机号注册只生成一个用户和一个手机号凭据。
4. 已属于其他用户的微信/QQ 身份不能被绑定或静默合并。
5. `USER` 令牌访问后台路由、无 `ADMIN` 角色的手机号登录后台均被拒绝。
6. 角色撤销、账号禁用、刷新令牌重复使用和单设备登出均按预期失效。
7. 验证码重放、超时、跨用途使用与超限请求均被拒绝并写入审计日志。

## 实施顺序

1. Prisma 数据模型与迁移；建立认证模块基础、配置和审计。
2. 验证码、手机号注册登录、JWT/刷新会话、用户/后台 Guard。
3. 微信与 QQ OAuth、待绑定状态、身份绑定/解绑。
4. 多端接入、限流与人机校验、监控告警。
5. 完整单元、集成与端到端测试，并进行安全评审。

## Implemented operations and regression boundary (2026-07-11)

The implementation keeps the access token at 900 seconds and the refresh
token at 30 days in production. Refresh tokens are opaque random values; only
their HMAC is stored. Browser refresh is sent as an `HttpOnly`, `SameSite=Lax`
cookie scoped to `/api/auth`, with `Secure` required in production. No cookie
`Domain` is configured, so deployment assumes a same-site browser/API topology
unless a separately reviewed CSRF/CORS change is made.

Web OAuth callback pages are registered with the exact HTTPS
`WECHAT_REDIRECT_URI` and `QQ_REDIRECT_URI` and relay the exact payload
`{ "code": "<provider-code>", "state": "<provider-state>", "audience": "user-api" }`
to `POST /api/auth/oauth/{wechat|qq}/callback`. WeChat and QQ mini-program
integrations register their mini-program app IDs and permitted server domains,
then exchange the one-time `uni.login` code with the exact payload
`{ "code": "<uni.login-code>", "audience": "user-api" }` through
`POST /api/auth/oauth/{wechat|qq}/miniapp/callback`. Both web and mini-program
flows stop at a pending binding until a phone code is consumed.

The currently wired SMS implementation is console-only. A real provider must
implement the `SmsProvider` interface and replace the module binding; setting
`SMS_PROVIDER` alone is not a production SMS integration. Administrator access
is bootstrapped only by audited direct database role assignment to an existing
phone-authenticated user. Secret rotation and a compromise response revoke
sessions/advance `sessionVersion`, rotate the affected secret, preserve audit
evidence, and review OAuth callback plus CORS configuration.

`auth.e2e.spec.ts` is a Nest HTTP/service-integrated regression: it uses real
controllers, verification/auth/session services, refresh-cookie parsing, JWT
guards, and an admin route. Its stateful Prisma-shaped persistence adapter is
explicitly used because the suite has no disposable MySQL database; only the
SMS transport is fake. It issues and consumes real verification codes through
the `/api` routes, asserts the refresh-cookie policy, proves that one phone
logged in from a mini-program and a web browser resolves the same user, and
proves that a revoked administrator session receives `401` for both refresh and
an admin-protected endpoint.
