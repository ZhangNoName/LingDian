# 多端认证系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 uni-app、Web 和 Admin 建立以手机号为主身份、支持微信/QQ 绑定的统一认证系统，并严格隔离用户与管理员会话。

**Architecture:** 在 NestJS 新增 `AuthModule`，用 Prisma 管理用户、身份凭据、角色、验证码、会话和审计。手机号验证是创建/关联用户的唯一入口；第三方 OAuth 仅产生待绑定身份。短期 JWT 访问令牌与数据库可吊销刷新会话配合，Guard 以 `audience` 和角色隔离 `user-api`、`admin-api`。

**Tech Stack:** NestJS 11、Prisma 7 / MySQL、TypeScript、Vue 3、uni-app、Node `crypto`、`@nestjs/jwt`、`@nestjs/throttler`、现有 `node:test`。

## Global Constraints

- 手机号以 E.164 保存；同一手机号只能关联一个用户。
- 所有微信/QQ 首次登录必须完成手机号验证码验证，禁止静默合并。
- 管理端只允许 `phoneLogin` 签发 `audience=admin-api` 的 `ADMIN` 会话；微信/QQ 不可登录 Admin。
- 访问令牌为 15 分钟；刷新令牌为 30 天、随机生成、仅保存哈希。
- 验证码为 6 位、5 分钟、一次性；按手机号/IP/设备限流。
- 使用项目声明的包管理器：`corepack pnpm`。

---

## File structure

| Path | Responsibility |
| --- | --- |
| `packages/db/prisma/schema.prisma` | 认证枚举、用户、身份、角色、验证码、会话和审计模型。 |
| `packages/contracts/src/auth.ts` | 多端共享的请求、响应和用户上下文类型。 |
| `backend/src/modules/auth/**` | 认证领域逻辑、OAuth 适配器、DTO、控制器、Guard 与测试。 |
| `backend/src/common/auth/**` | 仅供业务模块复用的装饰器和 `AdminGuard`。 |
| `backend/src/config/*` | JWT、Cookie、短信与 OAuth 环境配置及校验。 |
| `admin/src/auth/**` | 管理员登录页、内存访问令牌、刷新逻辑、路由保护。 |
| `uniapp/src/services/auth.ts` | 用户会话和令牌存储，替换演示令牌。 |
| `uniapp/src/pages/auth/login.vue` | 手机号、微信与 QQ 认证入口及手机号绑定页。 |

### Task 1: 认证依赖、配置和 Prisma 模型

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/.env.example`
- Modify: `backend/src/config/app.config.ts`
- Modify: `backend/src/config/env.validation.ts`
- Modify: `packages/db/prisma/schema.prisma`
- Modify: `packages/db/src/index.ts`
- Test: `backend/src/config/env.validation.spec.ts`

**Interfaces:**
- Produces: `AuthAudience`, `UserRole`, `IdentityProvider`, `UserStatus`, `SessionStatus`, `VerificationPurpose` Prisma enums.
- Produces: configuration keys `auth.jwtAccessSecret`, `auth.refreshPepper`, `auth.cookieSecure`, `auth.oauth.wechat`, `auth.oauth.qq`.

- [ ] **Step 1: Write failing environment-validation tests**

```ts
test('rejects missing JWT secrets outside test', () => {
  assert.throws(() => validateEnv({ NODE_ENV: 'production' }), /AUTH_JWT_ACCESS_SECRET/);
});

test('accepts a complete auth configuration', () => {
  assert.equal(validateEnv({
    NODE_ENV: 'test', DATABASE_URL: 'mysql://root:password@localhost:3306/lingdian',
    AUTH_JWT_ACCESS_SECRET: 'a'.repeat(32), AUTH_REFRESH_PEPPER: 'b'.repeat(32),
  }).NODE_ENV, 'test');
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `corepack pnpm --filter @lingdian/api test -- --test-name-pattern="JWT secrets"`

Expected: FAIL because the authentication environment variables are not validated.

- [ ] **Step 3: Add dependencies, exact environment variables and configuration**

Add `@nestjs/jwt`, `@nestjs/throttler`, and `cookie-parser` to `backend/package.json`, plus `@types/cookie-parser` to its development dependencies. Add the following to `backend/.env.example`, then validate all required production values and expose typed values from `appConfig`:

```env
AUTH_JWT_ACCESS_SECRET=replace-with-at-least-32-random-characters
AUTH_REFRESH_PEPPER=replace-with-at-least-32-random-characters
AUTH_ACCESS_TOKEN_TTL_SECONDS=900
AUTH_REFRESH_TOKEN_TTL_DAYS=30
AUTH_COOKIE_SECURE=false
WECHAT_APP_ID=
WECHAT_APP_SECRET=
WECHAT_REDIRECT_URI=
QQ_APP_ID=
QQ_APP_KEY=
QQ_REDIRECT_URI=
SMS_PROVIDER=console
```

- [ ] **Step 4: Add the normalized database model**

Add these enums and models to the Prisma schema. Keep `phoneE164` nullable except for `PHONE` records, because MySQL allows multiple `NULL` values under a unique index:

```prisma
enum IdentityProvider { PHONE WECHAT QQ }
enum UserRole { USER ADMIN }
enum AuthAudience { USER_API ADMIN_API }
enum UserStatus { ACTIVE DISABLED }
enum SessionStatus { ACTIVE REVOKED }
enum VerificationPurpose { PHONE_LOGIN PHONE_LINK ADMIN_LOGIN }

model User {
  id String @id @default(cuid())
  status UserStatus @default(ACTIVE)
  sessionVersion Int @default(1)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  identities AuthIdentity[]
  roles UserRoleAssignment[]
  sessions AuthSession[]
  @@map("users")
}
model AuthIdentity {
  id String @id @default(cuid())
  userId String
  provider IdentityProvider
  subject String
  phoneE164 String?
  verifiedAt DateTime?
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, subject])
  @@unique([phoneE164])
  @@map("auth_identities")
}
```

Complete `UserRoleAssignment`, `AuthSession`, `VerificationCode`, `PendingOAuth`, and `AuthAuditLog` using the fields and indexes in the approved design. `PendingOAuth` stores `provider`, `subject`, `stateHash`, `audience`, encrypted provider metadata, `expiresAt`, and `consumedAt`; it must be uniquely addressable by its opaque ID. Export all new generated Prisma symbols from `packages/db/src/index.ts`.

- [ ] **Step 5: Generate client and run tests**

Run: `corepack pnpm prisma:generate`
Run: `corepack pnpm --filter @lingdian/api test`

Expected: Prisma generation succeeds and the environment tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/package.json backend/.env.example backend/src/config packages/db
git commit -m "feat(auth): add authentication data model and config"
```

### Task 2: Shared contracts and provider boundaries

**Files:**
- Create: `packages/contracts/src/auth.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `backend/src/modules/auth/providers/sms-provider.ts`
- Create: `backend/src/modules/auth/providers/oauth-provider.ts`
- Create: `backend/src/modules/auth/providers/console-sms.provider.ts`
- Test: `backend/src/modules/auth/providers/console-sms.provider.spec.ts`

**Interfaces:**
- Produces: `AuthTokens`, `AuthenticatedUser`, `PhoneLoginRequest`, `BeginOAuthResponse`, `PendingOAuthResponse` contracts.
- Produces: `SmsProvider.send(input)` and `OAuthProvider.exchange(input)` for real infrastructure adapters and deterministic test doubles.

- [ ] **Step 1: Write failing provider and contract tests**

```ts
test('console SMS provider returns a provider message id without exposing the code', async () => {
  const result = await new ConsoleSmsProvider().send({ phoneE164: '+8613800000000', code: '123456' });
  assert.match(result.messageId, /^console_/);
  assert.equal('code' in result, false);
});
```

- [ ] **Step 2: Implement exact cross-package types and adapters**

```ts
export type AuthAudience = 'user-api' | 'admin-api';
export type AuthTokens = { access_token: string; expires_in: number; user: AuthenticatedUser };
export interface SmsProvider { send(input: { phoneE164: string; code: string }): Promise<{ messageId: string }>; }
export interface OAuthProvider {
  readonly provider: 'WECHAT' | 'QQ';
  buildAuthorizationUrl(input: { state: string; redirectUri: string }): string;
  exchange(input: { code: string; redirectUri: string }): Promise<{ subject: string; displayName?: string }>;
}
```

`ConsoleSmsProvider` must log only a masked phone number and message ID; it must never log the verification code. Register adapters through injection tokens, allowing tests to replace them with in-memory fakes.

- [ ] **Step 3: Run package build and provider test**

Run: `corepack pnpm --filter @lingdian/contracts build`
Run: `corepack pnpm --filter @lingdian/api test -- --test-name-pattern="console SMS"`

Expected: both commands pass.

- [ ] **Step 4: Commit**

```bash
git add packages/contracts backend/src/modules/auth/providers
git commit -m "feat(auth): add shared authentication contracts"
```

### Task 3: Verification codes, rate limits and audit trail

**Files:**
- Create: `backend/src/modules/auth/verification.service.ts`
- Create: `backend/src/modules/auth/verification.service.spec.ts`
- Create: `backend/src/modules/auth/audit.service.ts`
- Create: `backend/src/modules/auth/dto/send-code.dto.ts`
- Create: `backend/src/modules/auth/phone.ts`

**Interfaces:**
- Consumes: `SmsProvider`, `PrismaService`.
- Produces: `VerificationService.issue(input)` and `VerificationService.consume(input)`.

- [ ] **Step 1: Write failing behavior tests**

```ts
test('consumes a code exactly once', async () => {
  const issued = await service.issue({ purpose: 'PHONE_LOGIN', phone: '13800000000', ip: '127.0.0.1', deviceId: 'd1' });
  await service.consume({ purpose: 'PHONE_LOGIN', phone: '+8613800000000', code: issued.testCode });
  await assert.rejects(() => service.consume({ purpose: 'PHONE_LOGIN', phone: '+8613800000000', code: issued.testCode }), /invalid or expired/i);
});
```

- [ ] **Step 2: Implement normalization, hashing and limit enforcement**

Implement `normalizeChinesePhone(phone: string): string` to accept mainland 11-digit input and return `+86${phone}`; reject all other input in the first release. Generate codes with `crypto.randomInt(100000, 1000000)`. Store `HMAC-SHA-256(refreshPepper, purpose + ':' + phoneE164 + ':' + code)`, `expiresAt = now + 5 minutes`, and consume inside a Prisma transaction. Before sending, reject more than 3 active sends/phone/10 minutes, 10/IP/hour, or 8/device/hour. Audit `CODE_SENT`, `CODE_CONSUMED`, `CODE_REJECTED`, and `RATE_LIMITED` with masked metadata.

- [ ] **Step 3: Run focused and full backend tests**

Run: `corepack pnpm --filter @lingdian/api test -- --test-name-pattern="consumes a code"`
Run: `corepack pnpm --filter @lingdian/api test`

Expected: focused and complete suites pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/auth
git commit -m "feat(auth): add secure phone verification"
```

### Task 4: Sessions, JWT claims and authorization guards

**Files:**
- Create: `backend/src/modules/auth/session.service.ts`
- Create: `backend/src/modules/auth/session.service.spec.ts`
- Create: `backend/src/common/auth/current-user.decorator.ts`
- Create: `backend/src/common/auth/authenticated-user.type.ts`
- Create: `backend/src/common/auth/access-token.guard.ts`
- Create: `backend/src/common/auth/admin.guard.ts`
- Create: `backend/src/common/auth/admin.guard.spec.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `backend/src/main.ts`

**Interfaces:**
- Produces: `SessionService.create(user, audience, device)`, `refresh(rawToken)`, `revoke(sessionId)`, `revokeAll(userId)`.
- Produces: `@CurrentUser() user: AuthenticatedUser`, where `AuthenticatedUser` is `{ userId: string; sessionId: string; audience: 'user-api' | 'admin-api'; roles: ('USER' | 'ADMIN')[] }`.

- [ ] **Step 1: Write failing guard/session tests**

```ts
test('AdminGuard rejects a user-api token even when it contains ADMIN', async () => {
  const context = contextWithUser({ userId: 'u1', sessionId: 's1', audience: 'user-api', roles: ['ADMIN'] });
  await assert.rejects(() => guard.canActivate(context), /admin audience required/i);
});
```

- [ ] **Step 2: Implement session issuance and guards**

Create 32-byte refresh tokens with `crypto.randomBytes(32).toString('base64url')`; store only `HMAC-SHA-256(AUTH_REFRESH_PEPPER, rawToken)`. JWT claims must be `{ sub, sid, aud, sv, roles }` and expire after `AUTH_ACCESS_TOKEN_TTL_SECONDS`. `AccessTokenGuard` must verify signature, `aud`, `sessionVersion`, active session and `UserStatus`. `AdminGuard` must then require `aud === 'admin-api'` and `roles.includes('ADMIN')`. Configure `cookie-parser`, CORS allow-list and secure refresh cookies in `main.ts`.

- [ ] **Step 3: Run tests and static build**

Run: `corepack pnpm --filter @lingdian/api test`
Run: `corepack pnpm --filter @lingdian/api build`

Expected: both commands pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/common/auth backend/src/modules/auth backend/src/app.module.ts backend/src/main.ts
git commit -m "feat(auth): add sessions and role-aware guards"
```

### Task 5: Phone authentication HTTP API and role-protected routes

**Files:**
- Create: `backend/src/modules/auth/auth.controller.ts`
- Create: `backend/src/modules/auth/auth.service.ts`
- Create: `backend/src/modules/auth/auth.module.ts`
- Create: `backend/src/modules/auth/dto/phone-login.dto.ts`
- Create: `backend/src/modules/auth/dto/refresh.dto.ts`
- Create: `backend/src/modules/auth/auth.service.spec.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `backend/src/modules/products/products.controller.ts`
- Modify: `backend/src/modules/orders/orders.controller.ts`
- Delete: `backend/src/modules/auth/demo-auth.ts`

**Interfaces:**
- Produces: `POST /auth/codes`, `POST /auth/phone/login`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/logout-all`, and `GET /auth/me`.
- Consumes: `VerificationService`, `SessionService`, `@AdminGuard()`.

- [ ] **Step 1: Write failing controller tests**

```ts
test('admin phone login rejects a verified user without ADMIN role', async () => {
  await assert.rejects(
    () => authService.phoneLogin({ phone: '13800000000', code: '123456', audience: 'admin-api' }, requestContext),
    /administrator role required/i,
  );
});
```

- [ ] **Step 2: Implement endpoints and transaction-safe user creation**

`phone/login` must consume the code before looking up `AuthIdentity(provider: PHONE, subject: phoneE164)`. In a serializable Prisma transaction, create `User`, `AuthIdentity`, and `UserRoleAssignment(USER)` if absent; reuse the existing user if present. On `admin-api`, never create an administrator: require an existing active `ADMIN` assignment. Return `AuthTokens`; set the raw refresh token only in a secure HTTP-only cookie for browser callers. Apply `AdminGuard` to product/category mutation routes and all administrative order-management routes; remove `resolveDemoUser` usage from `OrdersService` and take the customer ID from `@CurrentUser()` where an authenticated customer is required.

- [ ] **Step 3: Verify API behavior**

Run: `corepack pnpm --filter @lingdian/api test`
Run: `corepack pnpm --filter @lingdian/api build`

Expected: all existing and authentication tests pass; no code imports `demo-auth`.

- [ ] **Step 4: Commit**

```bash
git add backend/src
git commit -m "feat(auth): add phone login and protect admin APIs"
```

### Task 6: WeChat/QQ OAuth, pending binding and identity management

**Files:**
- Create: `backend/src/modules/auth/oauth.service.ts`
- Create: `backend/src/modules/auth/oauth.service.spec.ts`
- Create: `backend/src/modules/auth/dto/oauth-callback.dto.ts`
- Create: `backend/src/modules/auth/dto/link-phone.dto.ts`
- Create: `backend/src/modules/auth/dto/unlink-identity.dto.ts`
- Create: `backend/src/modules/auth/providers/wechat-oauth.provider.ts`
- Create: `backend/src/modules/auth/providers/qq-oauth.provider.ts`
- Modify: `backend/src/modules/auth/auth.controller.ts`
- Modify: `backend/src/modules/auth/auth.module.ts`

**Interfaces:**
- Produces: `GET /auth/oauth/:provider/start`, `POST /auth/oauth/:provider/callback`, `POST /auth/oauth/link-phone`, `POST /auth/identities/:provider/bind`, `DELETE /auth/identities/:identityId`.
- Produces: pending OAuth IDs that expire in 10 minutes and cannot grant access until `link-phone` succeeds.

- [ ] **Step 1: Write failing conflict and binding tests**

```ts
test('refuses to attach a QQ subject belonging to another user', async () => {
  await assert.rejects(() => oauthService.linkIdentity({ userId: 'u2', provider: 'QQ', subject: 'app:openid-1' }), /identity already linked/i);
});
```

- [ ] **Step 2: Implement state and identity rules**

Store a server-generated, single-use OAuth state hash with provider, audience and 10-minute expiry. On callback, exchange the code via the injected provider, map WeChat to `unionid` or `appId:openid`, map QQ to `appId:openid`, then create a pending binding record; do not create a session. `link-phone` consumes a `PHONE_LINK` code and atomically creates or finds the phone user before attaching the OAuth identity. Reject identities owned by another user. Require recent phone verification before bind/unbind, prevent deletion of the final `PHONE` identity, and audit every outcome.

- [ ] **Step 3: Run OAuth unit tests**

Run: `corepack pnpm --filter @lingdian/api test -- --test-name-pattern="QQ subject"`
Run: `corepack pnpm --filter @lingdian/api test`

Expected: OAuth adapters are isolated in tests and all tests pass without real provider credentials.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/auth
git commit -m "feat(auth): add third-party identity binding"
```

### Task 7: Admin login, refresh client and route protection

**Files:**
- Create: `web/src/auth/session.ts`
- Create: `web/src/auth/api-client.ts`
- Create: `web/src/views/auth/login.vue`
- Create: `web/vitest.config.ts`
- Modify: `web/package.json`
- Modify: `web/src/router/index.ts`
- Modify: `web/src/lib/api.ts`
- Modify: `web/src/main.ts`
- Test: `web/src/auth/session.spec.ts`

**Interfaces:**
- Produces: `adminSession.login(phone, code)`, `adminSession.refresh()`, `adminSession.logout()`.
- Consumes: browser refresh cookie and `POST /auth/phone/login` with `{ audience: 'admin-api' }`.

- [ ] **Step 1: Install the Web test runner and write the failing session test**

Add `vitest` to `web` development dependencies and add `"test": "vitest run"` to `web/package.json`. Then write:

```ts
it('does not persist the access token in localStorage', async () => {
  await session.acceptLogin({ access_token: 'jwt', expires_in: 900, user: adminUser });
  expect(localStorage.getItem('access_token')).toBeNull();
});
```

- [ ] **Step 2: Implement the login and router boundary**

Keep the access token only in module memory. Request refresh with `credentials: 'include'`; on 401 clear memory and redirect to `/login`. Add the `/login` route outside `AdminLayout`, and a `beforeEach` guard that calls `adminSession.ensureAccessToken()` before every non-login route. The login view sends a code then logs in with `audience: 'admin-api'`; it must not render WeChat or QQ options. Update `web/src/lib/api.ts` to inject `Authorization: Bearer ${token}` and `credentials: 'include'`.

- [ ] **Step 3: Run web unit and build checks**

Run: `corepack pnpm --filter @lingdian/web test`
Run: `corepack pnpm --filter @lingdian/web build`

Expected: the Web app builds; manual smoke test shows unauthenticated navigation redirects to `/login`.

- [ ] **Step 4: Commit**

```bash
git add web/src
git commit -m "feat(web): add administrator phone login"
```

### Task 8: uni-app customer authentication and request migration

**Files:**
- Replace: `uniapp/src/services/auth.ts`
- Modify: `uniapp/src/services/request.ts`
- Create: `uniapp/src/pages/auth/login.vue`
- Create: `uniapp/vitest.config.ts`
- Modify: `uniapp/package.json`
- Modify: `uniapp/src/pages.json`
- Modify: `uniapp/src/pages/user/user.vue`
- Test: `uniapp/src/services/auth.spec.ts`

**Interfaces:**
- Produces: `customerAuth.sendCode`, `phoneLogin`, `beginThirdPartyLogin`, `completePhoneLink`, `logout`, `getAccessToken`.
- Consumes: `POST /auth/codes`, `POST /auth/phone/login` with `{ audience: 'user-api' }`, and OAuth pending-binding endpoints.

- [ ] **Step 1: Install the uni-app service test runner and write failing token/storage tests**

Add `vitest` to `uniapp` development dependencies and add `"test": "vitest run"` to `uniapp/package.json`. Configure `uniapp/vitest.config.ts` to alias `@` to `src` and provide a `uni` storage mock. Then write:

```ts
test('replaces the demo token with an authenticated access token', () => {
  customerAuth.acceptLogin({ access_token: 'jwt', expires_in: 900, user: userProfile });
  assert.equal(uni.getStorageSync('lingdian_demo_token'), '');
  assert.equal(customerAuth.getAccessToken(), 'jwt');
});
```

- [ ] **Step 2: Implement customer sign-in and request recovery**

Replace `ensureDemoToken` and `getDemoToken` with an in-memory access token plus platform secure storage for the refresh credential where the runtime supports it. `request.ts` attaches the active bearer token, makes one refresh attempt on 401, then routes to `/pages/auth/login`. The login page offers phone-code login and conditionally shows `uni.login`-based WeChat/QQ entry points only on supported platforms. After a third-party callback returns `pending_oauth_id`, show the same phone code form and call `completePhoneLink`; do not enter the app until the API returns a user session.

- [ ] **Step 3: Run checks**

Run: `corepack pnpm --filter @lingdian/uniapp test`
Run: `corepack pnpm --filter @lingdian/uniapp type-check`
Run: `corepack pnpm --filter @lingdian/uniapp build:h5`

Expected: type check and H5 build pass; the profile page directs a signed-out user to login.

- [ ] **Step 4: Commit**

```bash
git add uniapp/src
git commit -m "feat(uniapp): add customer authentication"
```

### Task 9: End-to-end security regression and operational handoff

**Files:**
- Create: `backend/src/modules/auth/auth.e2e.spec.ts`
- Modify: `backend/README.md`
- Modify: `docs/README.md`
- Modify: `docs/superpowers/specs/2026-07-11-authentication-design.md`

**Interfaces:**
- Consumes: the completed HTTP authentication APIs and fake SMS/OAuth adapters.
- Produces: repeatable security regression coverage and documented operator configuration.

- [ ] **Step 1: Add end-to-end cases before final wiring**

```ts
test('the same phone on two clients resolves to one user id', async () => {
  const first = await phoneLogin('13800000000', '111111', 'user-api');
  const second = await phoneLogin('13800000000', '222222', 'user-api');
  assert.equal(first.user.id, second.user.id);
});

test('a revoked session cannot refresh or access an admin endpoint', async () => {
  const login = await adminLogin('13800000001');
  await logout(login.access_token);
  await expect(refresh(login.refresh_token)).rejects.toThrow(/session revoked/i);
});
```

- [ ] **Step 2: Document production setup and run all verification**

Document environment variables, WeChat/QQ callback registration, SMS provider replacement, administrator bootstrap via a direct database role assignment, key rotation, cookie/domain settings, audit event review and incident response. Run:

```bash
corepack pnpm test
corepack pnpm type-check
corepack pnpm build
git diff --check
```

Expected: all commands exit with status 0 and no demo-token code remains.

- [ ] **Step 3: Commit**

```bash
git add backend docs
git commit -m "test(auth): cover multi-client authentication flows"
```

## Plan self-review

- Spec coverage: Tasks 1–2 cover the data model/configuration; Tasks 3–6 cover verification, sessions, phone flow, OAuth, binding, auditing, and server authorization; Tasks 7–8 cover both administrator and customer clients; Task 9 covers operational documentation and end-to-end regressions.
- Placeholders: no implementation task relies on an unspecified type, provider API, error behavior, or generic testing instruction. Real production SMS/OAuth credentials are supplied only through documented environment variables and are replaced by injected test fakes.
- Type consistency: all clients consume `AuthTokens`; every Guard consumes the single `AuthenticatedUser` context; the only two audiences are `user-api` and `admin-api`.
