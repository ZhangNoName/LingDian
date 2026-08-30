# Backend

后端已切换为 `Node.js + NestJS`，用于承载点餐、菜单、门店、订单、会员、支付和营销等服务能力。

## 本地开发

```bash
corepack pnpm install
cp backend/.env.example backend/.env
# 编辑 DATABASE_URL、STORE_MODE=single 和 PRIMARY_STORE_ID
corepack pnpm run db:push
# 若没有既有门店，只能对可丢弃库显式运行：
NODE_ENV=development ALLOW_DEMO_SEED=true corepack pnpm run db:seed:demo
corepack pnpm run dev:api
```

API 会在启动阶段校验主门店。必须先确认数据库存在 `PRIMARY_STORE_ID` 对应的门店行；不能先启动 API 再依赖读请求创建门店。

默认启动后访问：

- `GET /api/health`
- `GET /api/health/ready`
- `GET /api/stores/current`
- `GET /api/menu/current`
- `POST /api/orders`

## Prisma

当前后端已经接入 `Prisma`，默认使用 `MySQL`。

### 方式一：从你的 `local.yml` 生成本地 `.env`

```bash
cd backend
corepack pnpm run db:sync-local-config -- --config "E:\\私人\\local.yml"
```

### 方式二：手动配置 `.env`

```env
DATABASE_MODE=local
DATABASE_URL=mysql://username:password@host:3306/database
STORE_MODE=single
PRIMARY_STORE_ID=<existing-store-id>
```

`PRIMARY_STORE_ID` 必须引用数据库中已有门店。API 启动和 readiness 会精确校验该行；门店处于 `CLOSED` 或 `RESTING` 仍保持 ready，但不能下单。演示 seed 使用这个固定 ID，不会在读取菜单时创建门店；它会重置演示业务数据，只允许 `NODE_ENV=development` 或 `NODE_ENV=test` 的可丢弃库，并要求显式设置 `ALLOW_DEMO_SEED=true`。

MySQL 8.4 默认账号通常使用 `caching_sha2_password`。仅当数据库位于受信任的本机或 Docker 私有网络且没有 TLS 时，可在 URL 后增加
`?allowPublicKeyRetrieval=true`；公网或跨主机数据库应配置 TLS，或向客户端提供固定的 RSA 公钥，不能依赖动态公钥获取。

### 常用命令

```bash
corepack pnpm run prisma:generate
corepack pnpm run db:push
corepack pnpm run db:migrate:deploy
NODE_ENV=development ALLOW_DEMO_SEED=true corepack pnpm run db:seed:demo
corepack pnpm run prisma:studio
```

`db:push` 和 demo seed 不得用于生产或共享数据库；这些环境必须执行已审查的迁移，并在启动前只读确认主门店。

`db:migrate:deploy` 包含新旧数据库安全门禁：真正的空库会从
`20260710_fresh_business_baseline` 开始完整重放；已有 11 张历史业务表的数据库会先校验每张表的历史列签名和主键，再使用 `prisma migrate resolve` 只记录该基线。只存在部分业务表、存在无关的非空 schema、基线记录与实际表矛盾时都会停止，不会静默建表或覆盖。

可用一个独立的空数据库做真实迁移验收；该命令绝不清空数据库，目标非空时会拒绝：

```bash
FRESH_DATABASE_URL='mysql://user:password@127.0.0.1:3306/lingdian_fresh_verify?allowPublicKeyRetrieval=true' \
  corepack pnpm run db:migrate:fresh:verify
```

验收会重放全部迁移、检查失败记录和核心表，然后将数据库与
`schema.prisma` 做 drift 对比。`FRESH_DATABASE_URL` 不得与运行时
`DATABASE_URL` 相同。

## 目录说明

| 路径 | 说明 |
| --- | --- |
| `src/main.ts` | Nest 启动入口 |
| `src/app.module.ts` | 根模块 |
| `src/config/` | 环境变量与应用配置 |
| `src/modules/health/` | 健康检查 |
| `src/modules/stores/` | 门店上下文 |
| `src/modules/menu/` | 菜单与分类 |
| `src/modules/orders/` | 下单能力 |
| `src/prisma/` | Prisma 模块与客户端服务 |
| `prisma/schema.prisma` | 数据模型定义 |

## 环境变量

参考 `.env.example`：

```env
PORT=9000
API_PREFIX=api
NODE_ENV=development
STORE_MODE=single
PRIMARY_STORE_ID=<existing-store-id>
```

## Authentication operations

### Required configuration

Set these secrets through the deployment secret store; never commit them or
write their values to logs. Outside `NODE_ENV=test`, both secrets are required
and must contain at least 32 characters.

```env
AUTH_JWT_ACCESS_SECRET=<at-least-32-character-random-secret>
AUTH_REFRESH_PEPPER=<at-least-32-character-random-secret>
AUTH_ACCESS_TOKEN_TTL_SECONDS=900
AUTH_REFRESH_TOKEN_TTL_DAYS=30
AUTH_COOKIE_SECURE=true
CORS_ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com

WECHAT_APP_ID=<wechat-web-app-id>
WECHAT_APP_SECRET=<wechat-web-app-secret>
WECHAT_REDIRECT_URI=https://app.example.com/auth/wechat/callback
WECHAT_MINI_APP_ID=<wechat-mini-program-app-id>
WECHAT_MINI_APP_SECRET=<wechat-mini-program-app-secret>

QQ_APP_ID=<qq-web-app-id>
QQ_APP_KEY=<qq-web-app-key>
QQ_REDIRECT_URI=https://app.example.com/auth/qq/callback
QQ_MINI_APP_ID=<qq-mini-program-app-id>
QQ_MINI_APP_SECRET=<qq-mini-program-app-secret>
SMS_PROVIDER=console
```

Production validation fixes access-token and refresh-token lifetimes at 900
seconds and 30 days respectively, and requires `AUTH_COOKIE_SECURE=true` plus
all listed OAuth values. The refresh cookie is `HttpOnly`, `SameSite=Lax`, and
limited to `/api/auth`; clients must use `credentials: 'include'` for browser
refresh requests. It deliberately has no configurable cross-subdomain `Domain`
attribute. Keep the browser app and API on the same site, or change the cookie
policy only after a CSRF/CORS review.

### Provider registration and SMS handoff

For each production web application, register the exact HTTPS value of
`WECHAT_REDIRECT_URI` with WeChat Open Platform and `QQ_REDIRECT_URI` with QQ
Connect. Those browser callback pages must preserve the provider `code` and
`state` and send this exact JSON payload to
`POST /api/auth/oauth/{wechat|qq}/callback`; the API returns a pending binding,
not a session, until phone verification completes:

```json
{ "code": "<provider-code>", "state": "<provider-state>", "audience": "user-api" }
```

For mini-programs, register the corresponding mini-program app ID and server
domain with the WeChat and QQ mini-program consoles. Mini-program clients send
the one-time `uni.login` code using this exact JSON payload to
`POST /api/auth/oauth/{wechat|qq}/miniapp/callback`; no browser redirect URI is
used by that exchange:

```json
{ "code": "<uni.login-code>", "audience": "user-api" }
```

Verify callback/domain registration in staging before changing production values.

`SMS_PROVIDER=console` is a development/test-only adapter: it logs a masked
destination and **does not deliver SMS**. Production must use
`SMS_PROVIDER=webhook` together with `SMS_WEBHOOK_URL` and `SMS_WEBHOOK_TOKEN`.
The webhook receives a bearer-authenticated JSON body containing `phoneE164`
and `code`, and may return `{ "messageId": "..." }`. The downstream gateway
must never log the verification code and should restrict requests to the API
network or an allowlist.

### Database migration, backup, and rollback

The complete schema is deployed by the checked-in Prisma migrations; do not use
`db:push` in production. From the repository root, with the production
`DATABASE_URL` supplied through the deployment secret store:

```bash
mysqldump --single-transaction --routines --triggers --host="$DB_HOST" --user="$DB_USER" --password="$DB_PASSWORD" "$DB_NAME" > lingdian-pre-auth-$(date +%F-%H%M%S).sql
corepack pnpm run db:migrate:deploy
```

Record the migration output and verify the readiness endpoint before enabling
traffic. Migrations are forward-only and Prisma has no safe automatic down migration. To roll
back an unsuccessful deployment, stop API traffic, restore the pre-migration
backup to the affected database (or remove the new auth tables only if no auth
data was written), then redeploy the prior API version. Practice this in
staging before production.

The automated suite uses a stateful Prisma-shaped adapter for its HTTP flow;
it is not a disposable MySQL integration test. Run the same migration and the
authentication flow against an isolated MySQL staging database before release.

### Native uni-app refresh transport

Refresh credentials are never returned in JSON responses. H5 uses the
HttpOnly refresh cookie. WeChat and QQ mini-programs do not rely on cookie
persistence: after an access token expires or the process relaunches, the
client obtains a fresh `uni.login` code and calls
`POST /auth/oauth/:provider/miniapp/session`. The API exchanges that one-time
platform code, requires an already linked active `USER` identity, and creates a
new database session. Explicit logout and a server-side 401 block automatic
recovery until the user signs in again.

Neither refresh credentials nor access tokens are written to uni-app storage,
Keychain/Keystore bridges, or caller-controlled headers. A future native raw-
token transport requires verifiable device attestation and a new security
review. This split follows the documented uni-app transport boundary: the
[`withCredentials` option applies to H5](https://uniapp.dcloud.net.cn/api/request/request.html),
not mini-program cookie persistence.

### Account bootstrap, review, and incidents

Deploy the checked-in migrations, then run the idempotent production bootstrap
from the repository root. It creates the first store and both controlled
accounts in one serializable transaction:

```bash
corepack pnpm run db:migrate:deploy
corepack pnpm run db:bootstrap:production
```

The command requires `NODE_ENV=production`, `STORE_MODE=single`, one explicit
store identity, and the seven account variables below. Keep their values out of
source control, shell history, command output, and logs:

```dotenv
PRIMARY_STORE_ID=<stable-production-store-id>
STORE_BOOTSTRAP_CODE=<stable-production-store-code>
STORE_BOOTSTRAP_NAME=<production-store-name>
# Optional; defaults to CLOSED for a newly created store.
STORE_BOOTSTRAP_STATUS=CLOSED
STORE_BOOTSTRAP_CONTACT_NAME=
STORE_BOOTSTRAP_CONTACT_PHONE=
STORE_BOOTSTRAP_ADDRESS=
STORE_BOOTSTRAP_BUSINESS_HOURS=
AUTH_BOOTSTRAP_SUPER_ADMIN_USERNAME=
AUTH_BOOTSTRAP_SUPER_ADMIN_PASSWORD=
AUTH_BOOTSTRAP_SUPER_ADMIN_PHONE=
AUTH_BOOTSTRAP_MERCHANT_USERNAME=
AUTH_BOOTSTRAP_MERCHANT_PASSWORD=
AUTH_BOOTSTRAP_MERCHANT_PHONE=
AUTH_BOOTSTRAP_MERCHANT_STORE_IDS=<same-value-as-PRIMARY_STORE_ID>
```

In this single-store build, `AUTH_BOOTSTRAP_MERCHANT_STORE_IDS` must contain
exactly one value and equal `PRIMARY_STORE_ID`. Both passwords must be different,
12-128 characters, contain lowercase, uppercase, numeric, and symbol characters,
and must not contain common weak tokens or account-derived values. Demo/test
store or account identities and `ALLOW_DEMO_SEED=true` are rejected. A newly created store
defaults to `CLOSED`; explicitly set `STORE_BOOTSTRAP_STATUS=OPEN` only when its
catalogue and integrations are ready. Re-running the command verifies the
immutable store ID/code pair and synchronizes only changed account state without
printing identifiers, phone numbers, or plaintext credentials. Creating an
account or changing its bootstrap password sets `mustChangePassword=true`;
re-running with an unchanged password does not re-enable that flag after the
user has completed the forced change. The bootstrap administrator receives `SUPER_ADMIN` and
`ADMIN` global roles; the merchant receives only one `MERCHANT` role scoped to
the primary store.

Only merchant `web/` contains password-reset and password-change pages. The
administrator client supports account/password login and merchant management
but no password-recovery UI. The user mini-program keeps phone, WeChat, and QQ
login only. All three authenticated clients may update their own non-unique
nickname.

Never create an administrator by editing a JWT or allowing an unknown phone
number to use `admin-api`. Review `auth_audit_logs` at least weekly for login,
verification, OAuth bind/unbind, role, and session events; investigate spikes,
repeated failures, unfamiliar devices, and unexpected administrator sessions.

Rotate `AUTH_JWT_ACCESS_SECRET`, `AUTH_REFRESH_PEPPER`, OAuth app secrets, and
the SMS vendor secret through the secret manager. A JWT-secret rotation should
be accompanied by `sessionVersion` advancement and session revocation so old
access and refresh credentials cannot survive the change. For suspected account
or secret compromise: disable the user or revoke all sessions, advance its
session version, rotate the affected secret, preserve audit evidence, and
review the affected provider callback and CORS configuration before restoring
access.

### System observability

The additive `20260716_add_system_logs` migration creates the operational log
table. Apply it with the normal production migration procedure before deploying
this API version. The API keeps logs for 30 days and removes expired rows at
most once per process per hour; it never stores cookies, authorization headers,
passwords, token-like query values, raw stacks, or client-controlled user IDs.

`POST /api/system-logs/client-events` accepts only bounded `WARN` and `ERROR`
events from an authenticated session whose audience matches `MINIAPP`,
`MERCHANT_WEB`, or `ADMIN_WEB`, with a per-source/IP limit of 20 events per
minute. `GET /api/admin/system-logs` requires an
`admin-api` access token with `SUPER_ADMIN`; the Admin Web system-log page is
the intended operator interface. Startup, graceful stop, uncaught exceptions,
unhandled rejections, HTTP 5xx responses, and registered client errors share
this endpoint's structured store.
