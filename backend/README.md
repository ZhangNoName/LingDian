# Backend

后端已切换为 `Node.js + NestJS`，用于承载点餐、菜单、门店、订单、会员、支付和营销等服务能力。

## 本地开发

```bash
cd backend
npm install
npm run start:dev
```

默认启动后访问：

- `GET /api/health`
- `GET /api/stores/current`
- `GET /api/menu/current`
- `POST /api/orders`

## Prisma

当前后端已经接入 `Prisma`，默认使用 `MySQL`。

### 方式一：从你的 `local.yml` 生成本地 `.env`

```bash
cd backend
npm run db:sync-local-config -- --config "E:\\私人\\local.yml"
```

### 方式二：手动配置 `.env`

```env
DATABASE_URL=mysql://username:password@host:3306/database
```

### 常用命令

```bash
npm run prisma:generate
npm run db:push
npm run prisma:studio
```

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

Authentication schema is deployed by the checked-in Prisma migration; do not
use `db:push` in production. From the repository root, with the production
`DATABASE_URL` supplied through the deployment secret store:

```bash
mysqldump --single-transaction --routines --triggers --host="$DB_HOST" --user="$DB_USER" --password="$DB_PASSWORD" "$DB_NAME" > lingdian-pre-auth-$(date +%F-%H%M%S).sql
pnpm --filter @lingdian/db migrate:deploy
```

Record the migration output and verify `auth_sessions`, `auth_identities`,
`verification_codes`, and `auth_audit_logs` exist before enabling traffic. The
migration is additive and Prisma has no safe automatic down migration. To roll
back an unsuccessful deployment, stop API traffic, restore the pre-migration
backup to the affected database (or remove the new auth tables only if no auth
data was written), then redeploy the prior API version. Practice this in
staging before production.

The automated suite uses a stateful Prisma-shaped adapter for its HTTP flow;
it is not a disposable MySQL integration test. Run the same migration and the
authentication flow against an isolated MySQL staging database before release.

### Native uni-app refresh transport

Refresh credentials are never returned in JSON responses. Browsers use the
HttpOnly refresh cookie; native clients must rely on their platform's
OS-managed cookie transport for the same cookie. On relaunch the uni-app client
recreates only the in-memory access token by calling the cookie-backed refresh
endpoint. It does not write refresh credentials or access tokens to uni-app
storage, Keychain/Keystore bridges, or any caller-controlled header. A future
native raw-token transport requires verifiable device attestation and a new
security review before it can be added.

### Account bootstrap, review, and incidents

Deploy the checked-in migrations before starting a version that uses account
authentication, then run the idempotent bootstrap command from the repository
root:

```bash
corepack pnpm run db:migrate:deploy
corepack pnpm --filter @lingdian/api db:seed:auth-bootstrap
```

The bootstrap command requires these seven deployment-secret variables. Keep
their values out of source control, shell history, command output, and logs:

```dotenv
AUTH_BOOTSTRAP_SUPER_ADMIN_USERNAME=
AUTH_BOOTSTRAP_SUPER_ADMIN_PASSWORD=
AUTH_BOOTSTRAP_SUPER_ADMIN_PHONE=
AUTH_BOOTSTRAP_MERCHANT_USERNAME=
AUTH_BOOTSTRAP_MERCHANT_PASSWORD=
AUTH_BOOTSTRAP_MERCHANT_PHONE=
AUTH_BOOTSTRAP_MERCHANT_STORE_IDS=
```

`AUTH_BOOTSTRAP_MERCHANT_STORE_IDS` is a comma-separated list of existing
store IDs and must contain at least one value. The command validates every
store before writing either bootstrap principal, and fails if a credential
group is incomplete or a bootstrap password is shorter than 8 characters.
Re-running it synchronizes the configured super administrator and test merchant
without writing plaintext credentials. This 8-character minimum is limited to
the controlled bootstrap path; merchant password reset and change remain at a
12-character minimum. The bootstrap administrator receives `SUPER_ADMIN` and
`ADMIN` global roles; the merchant receives only `MERCHANT` roles scoped to the
specified stores.

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
