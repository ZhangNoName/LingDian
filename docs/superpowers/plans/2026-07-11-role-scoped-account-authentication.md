# 灵点点餐系统三端账号认证 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为灵点点餐系统实现管理员、商家、用户三端隔离的账号/密码与手机号认证，并提供门店范围授权、商家密码找回/修改、用户昵称及环境变量初始化账户。

**Architecture:** 账号身份以 `ACCOUNT` 形式复用 `AuthIdentity`，密码哈希放在独立的 `PasswordCredential` 表。会话以 `admin-api`、`merchant-api`、`user-api` 三个受众隔离；`MERCHANT` 角色通过现有范围字段绑定一至多个 `STORE`。账号登录、密码重置、商家创建和三端 UI 均通过同一认证模块与会话服务工作。

**Tech Stack:** NestJS 11、Prisma 7/MySQL、Node `crypto.scrypt`、Vue 3/Vite、uni-app、Node test/Vitest。

## Global Constraints

- `admin/` 仅允许 `ADMIN` 或 `SUPER_ADMIN` 的账号密码会话；`web/` 仅允许拥有至少一条门店范围的 `MERCHANT` 账号密码会话；`uniapp/` 仅允许用户手机号或微信/QQ 登录。
- 商家不得自助注册；仅 `SUPER_ADMIN` 可以创建、启停商家并调整门店范围。
- 商家账号至少拥有一个存在的门店；所有商家业务请求必须按 JWT 中的门店范围过滤。
- 只有 `web/` 提供忘记密码、修改密码；二者都使用 `PASSWORD_RESET` 手机验证码且不传旧密码。
- 密码以带参数、随机 salt 的 `scrypt` 哈希保存；明文密码、验证码与初始化密码不得写入源码、迁移、审计日志或 Git。
- 密码变更/重置、禁用和范围变更必须吊销相关会话或递增会话版本。
- `User.nickname` 为所有用户的显示名，最长 32 个字符、不设唯一约束且不参与身份或授权；每个已登录用户只能修改自己的昵称。

---

## File structure

- `packages/db/prisma/schema.prisma`：身份、密码凭据、角色、受众、验证码用途和用户昵称。
- `packages/db/prisma/migrations/20260711_role_scoped_account_authentication/migration.sql`：在已基线化的认证 schema 上扩展数据库。
- `packages/contracts/src/auth.ts`：三端账号、密码与商家管理的共享 DTO 类型。
- `backend/src/modules/auth/password.service.ts`：`scrypt` 哈希、密码校验、重置和会话失效。
- `backend/src/modules/auth/account-auth.service.ts`：账号登录、验证码重置和当前商家改密。
- `backend/src/modules/auth/merchant-admin.service.ts`：超级管理员创建、列出和调整商家。
- `backend/src/common/auth/merchant.guard.ts`、`super-admin.guard.ts`：受众和角色守卫。
- `backend/src/modules/auth/dto/`：HTTP 输入校验 DTO。
- `backend/scripts/seed-auth-bootstrap.mjs`：环境变量驱动、幂等的超级管理员与测试商家初始化。
- `admin/src/`：管理员账号登录与商家账号管理。
- `web/src/`：商家账号登录、忘记密码与改密，使用 `merchant-api`。
- `uniapp/src/`：用户昵称编辑；不增加账号密码入口。

### Task 1: 扩展数据模型、共享类型和迁移

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20260711_role_scoped_account_authentication/migration.sql`
- Modify: `packages/contracts/src/auth.ts`
- Modify: `packages/contracts/src/index.ts`
- Test: `backend/src/modules/auth/account-auth.service.spec.ts`

**Interfaces:**
- Produces `AuthRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN' | 'MERCHANT'` and `AuthAudience = 'user-api' | 'admin-api' | 'merchant-api'`.
- Produces `AccountLoginRequest`, `PasswordResetRequest`, `CreateMerchantRequest`, `MerchantSummary`.
- Produces `PasswordCredential` and `User.nickname` for later services.

- [ ] **Step 1: Extend Prisma schema and contracts**

```prisma
enum IdentityProvider { PHONE WECHAT QQ ACCOUNT }
enum UserRole { USER ADMIN SUPER_ADMIN MERCHANT }
enum AuthAudience { USER_API ADMIN_API MERCHANT_API }
enum VerificationPurpose { PHONE_LOGIN PHONE_LINK ADMIN_LOGIN PASSWORD_RESET }

model User {
  nickname String? @db.VarChar(32)
  // retain existing fields and relations
}

model AuthIdentity {
  passwordCredential PasswordCredential?
  // retain existing fields and unique provider/subject constraint
}

model PasswordCredential {
  id              String       @id @default(cuid())
  identityId      String       @unique
  passwordHash    String       @db.Text
  passwordChangedAt DateTime   @default(now())
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  identity        AuthIdentity @relation(fields: [identityId], references: [id], onDelete: Cascade)
  @@map("password_credentials")
}
```

Define shared account-login request types with explicit `audience: 'admin-api' | 'merchant-api'`, `username`, `password`, and `storeIds: string[]`. Define password-reset request types with `audience: 'merchant-api'` only because only merchant Web has password recovery/change. Ensure all-user nickname uses `UpdateNicknameRequest { nickname: string }`.

- [ ] **Step 2: Write the SQL migration and generate Prisma client**

Create enum alterations, `password_credentials`, `users.nickname`, and all required unique/index/foreign-key constraints in `20260711_role_scoped_account_authentication/migration.sql`. Use `ALTER TABLE` statements compatible with the existing MySQL schema and preserve the already-applied `20260711_add_authentication` migration.

Run: `corepack pnpm run prisma:generate`

Expected: exits 0 and generated client exposes `passwordCredential`.

- [ ] **Step 3: Run schema-format and contract build checks**

Run: `corepack pnpm --filter @lingdian/db prisma:format && corepack pnpm --filter @lingdian/contracts build`

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add packages/db/prisma packages/contracts backend/src/modules/auth/account-auth.service.spec.ts
git commit -m "feat(auth): add account credential schema"
```

### Task 2: 实现密码哈希和会话失效服务

**Files:**
- Create: `backend/src/modules/auth/password.service.ts`
- Create: `backend/src/modules/auth/password.service.spec.ts`
- Modify: `backend/src/modules/auth/auth.module.ts`
- Modify: `backend/src/modules/auth/audit.service.ts`

**Interfaces:**
- Produces `PasswordService.hash(password): Promise<string>`.
- Produces `PasswordService.verify(password, encodedHash): Promise<boolean>`.
- Produces `PasswordService.replace(identityId, newPassword, userId, context): Promise<void>` which increments `sessionVersion`, updates hash, and revokes active sessions.

- [ ] **Step 1: Write failing password-service tests**

```ts
test('stores a salted scrypt hash and verifies only the original password', async () => {
  const encoded = await passwords.hash('long-password-123');
  assert.match(encoded, /^scrypt\$32768\$8\$1\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
  assert.equal(await passwords.verify('long-password-123', encoded), true);
  assert.equal(await passwords.verify('wrong-password-123', encoded), false);
});

test('replacing a password invalidates existing sessions', async () => {
  await passwords.replace('account-id', 'replacement-password-123', 'user-id', context);
  assert.equal(user.sessionVersion, 2);
  assert.equal(session.status, 'REVOKED');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `corepack pnpm --filter @lingdian/api test -- --test-name-pattern="salted scrypt|invalidates existing sessions"`

Expected: FAIL because `PasswordService` is absent.

- [ ] **Step 3: Implement `PasswordService`**

Use `randomBytes(16)`, `scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })`, and encode `scrypt$32768$8$1$<base64url salt>$<base64url hash>`. Parse only this exact five-field format; compare equal-length buffers using `timingSafeEqual`. Reject passwords shorter than 12 characters.

In `replace`, use one transaction to update `PasswordCredential`, increment `User.sessionVersion`, update active sessions to `REVOKED`, and record `PASSWORD_CHANGED` without secret material.

- [ ] **Step 4: Run focused tests to verify they pass**

Run: `corepack pnpm --filter @lingdian/api test -- --test-name-pattern="salted scrypt|invalidates existing sessions"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/auth/password.service.ts backend/src/modules/auth/password.service.spec.ts backend/src/modules/auth/auth.module.ts backend/src/modules/auth/audit.service.ts
git commit -m "feat(auth): secure account passwords"
```

### Task 3: 账号登录、商家密码找回与修改 API

**Files:**
- Create: `backend/src/modules/auth/account-auth.service.ts`
- Create: `backend/src/modules/auth/account-auth.service.spec.ts`
- Create: `backend/src/modules/auth/dto/account-login.dto.ts`
- Create: `backend/src/modules/auth/dto/password-forgot.dto.ts`
- Create: `backend/src/modules/auth/dto/password-reset.dto.ts`
- Create: `backend/src/modules/auth/dto/password-change.dto.ts`
- Modify: `backend/src/modules/auth/auth.controller.ts`
- Modify: `backend/src/modules/auth/verification.service.ts`
- Modify: `backend/src/modules/auth/auth.module.ts`

**Interfaces:**
- Produces `POST /api/auth/account/login`.
- Produces `POST /api/auth/password/forgot`, `POST /api/auth/password/reset`, `POST /api/auth/password/change/code`, and guarded `POST /api/auth/password/change`.
- Consumes `PasswordService`, `VerificationService`, and `SessionService`.

- [ ] **Step 1: Write failing HTTP/service tests**

```ts
test('issues a merchant session only for an account with a store-scoped merchant role', async () => {
  const tokens = await accountAuth.login(
    { username: 'merchant-one', password: 'merchant-password-123', audience: 'merchant-api' },
    { deviceId: 'web' },
  );
  assert.equal(tokens.user.audience, 'merchant-api');
});

test('forgot-password response does not reveal an unknown account', async () => {
  const response = await accountAuth.requestPasswordReset({ username: 'unknown', audience: 'merchant-api' }, context);
  assert.deepEqual(response, { accepted: true });
});

test('merchant password reset consumes PASSWORD_RESET and revokes sessions', async () => {
  await accountAuth.resetPassword({ username: 'merchant-one', audience: 'merchant-api', code: '123456', password: 'replacement-password-123' }, context);
  assert.equal(consumedPurpose, 'PASSWORD_RESET');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `corepack pnpm --filter @lingdian/api test -- --test-name-pattern="merchant session|does not reveal|consumes PASSWORD_RESET"`

Expected: FAIL because account endpoints and `PASSWORD_RESET` do not exist.

- [ ] **Step 3: Implement account and password flows**

Normalize account names with `trim().toLowerCase()` and reject names outside `[a-z0-9._-]{3,64}`. `account/login` finds `ACCOUNT` identity plus credential, verifies the password, validates user status and audience role, then calls `SessionService.create`.

For forgot-password, always return `{ accepted: true }`; only issue a `PASSWORD_RESET` code when a matching active merchant account has a verified `PHONE` identity. `password/reset` consumes that same verification code before `PasswordService.replace`. `password/change/code` requires `AccessTokenGuard` plus `MerchantGuard` and issues code for the current account phone; `password/change` requires the same guards and calls the same reset operation. Audit successful and rejected paths with `ACCOUNT_LOGIN_*`, `PASSWORD_RESET_*`, and `PASSWORD_CHANGE_*` event names.

- [ ] **Step 4: Run focused tests to verify they pass**

Run: `corepack pnpm --filter @lingdian/api test -- --test-name-pattern="merchant session|does not reveal|consumes PASSWORD_RESET"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/auth
git commit -m "feat(auth): add merchant account password flows"
```

### Task 4: 角色守卫、超级管理员商家管理与门店范围

**Files:**
- Create: `backend/src/common/auth/merchant.guard.ts`
- Create: `backend/src/common/auth/super-admin.guard.ts`
- Create: `backend/src/common/auth/merchant.guard.spec.ts`
- Create: `backend/src/common/auth/super-admin.guard.spec.ts`
- Create: `backend/src/modules/auth/merchant-admin.service.ts`
- Create: `backend/src/modules/auth/merchant-admin.service.spec.ts`
- Create: `backend/src/modules/auth/dto/create-merchant.dto.ts`
- Create: `backend/src/modules/auth/dto/update-merchant.dto.ts`
- Modify: `backend/src/common/auth/authenticated-user.type.ts`
- Modify: `backend/src/common/auth/admin.guard.ts`
- Modify: `backend/src/modules/auth/auth.controller.ts`
- Modify: `backend/src/modules/auth/auth.module.ts`

**Interfaces:**
- Produces `MerchantGuard` requiring `merchant-api` plus `MERCHANT`.
- Produces `SuperAdminGuard` requiring `admin-api` plus `SUPER_ADMIN`.
- Produces `MerchantAdminService.create(input)`, `list()`, `update(userId, input)`.

- [ ] **Step 1: Write failing guard and service tests**

```ts
test('MerchantGuard rejects an admin-api token with MERCHANT role', async () => {
  await assert.rejects(() => guard.canActivate(contextWith({ audience: 'admin-api', roles: ['MERCHANT'] })), /merchant audience required/i);
});

test('super administrator creates a merchant only when every requested store exists', async () => {
  await assert.rejects(
    () => merchants.create({ username: 'store-owner', phone: '13800000000', password: 'merchant-password-123', storeIds: ['missing'] }),
    /store not found/i,
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `corepack pnpm --filter @lingdian/api test -- --test-name-pattern="MerchantGuard rejects|every requested store"`

Expected: FAIL because guards and merchant administration service are absent.

- [ ] **Step 3: Implement guards and merchant administration endpoints**

`AdminGuard` accepts `ADMIN` or `SUPER_ADMIN` under `admin-api`; `SuperAdminGuard` accepts only `SUPER_ADMIN`; `MerchantGuard` accepts only `MERCHANT` under `merchant-api`.

Create `POST /api/admin/merchants`, `GET /api/admin/merchants`, and `PATCH /api/admin/merchants/:userId`, guarded by `AccessTokenGuard` and `SuperAdminGuard`. Validate deduplicated `storeIds.length >= 1`, query all stores before creation, create `User`, `ACCOUNT` identity, credential, verified `PHONE` identity, and one `MERCHANT/STORE` role for every store in one transaction. Update flow must reject an empty or non-existent replacement scope list; disabling or changing scope increments session version and revokes sessions.

- [ ] **Step 4: Run focused tests to verify they pass**

Run: `corepack pnpm --filter @lingdian/api test -- --test-name-pattern="MerchantGuard rejects|every requested store|store scope rejects"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/common/auth backend/src/modules/auth
git commit -m "feat(auth): manage store-scoped merchant accounts"
```

### Task 5: 初始化账户和用户昵称 API

**Files:**
- Create: `backend/scripts/seed-auth-bootstrap.mjs`
- Create: `backend/src/modules/auth/profile.service.ts`
- Create: `backend/src/modules/auth/profile.service.spec.ts`
- Create: `backend/src/modules/auth/dto/update-nickname.dto.ts`
- Modify: `backend/package.json`
- Modify: `backend/.env.example`
- Modify: `backend/src/config/env.validation.ts`
- Modify: `backend/src/modules/auth/auth.controller.ts`

**Interfaces:**
- Produces `pnpm run db:seed:auth-bootstrap`.
- Produces guarded `PATCH /api/auth/profile/nickname` for every authenticated audience.

- [ ] **Step 1: Write failing profile tests**

```ts
test('an authenticated user nickname is trimmed, repeatable, and cannot exceed 32 characters', async () => {
  await profile.setNickname('user-1', '  灵点用户  ');
  assert.equal(savedNickname, '灵点用户');
  await profile.setNickname('user-2', '灵点用户');
  assert.equal(secondSavedNickname, '灵点用户');
  await assert.rejects(() => profile.setNickname('user-1', 'x'.repeat(33)), /32/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `corepack pnpm --filter @lingdian/api test -- --test-name-pattern="nickname is trimmed, repeatable"`

Expected: FAIL because `ProfileService` is absent.

- [ ] **Step 3: Implement bootstrap and nickname update**

The bootstrap script reads all seven `AUTH_BOOTSTRAP_*` variables; exits with a clear error when one credential group is incomplete, a bootstrap password is under 8 characters, test merchant store IDs are empty, or referenced stores do not exist. This controlled bootstrap-only minimum does not change the 12-character requirement for merchant password reset or change. It upserts `ACCOUNT` and verified `PHONE` identities, password credentials, `SUPER_ADMIN`/`ADMIN` roles for the administrator, and `MERCHANT/STORE` roles for the merchant. Each run updates credentials/scopes and invalidates sessions only when a value changes.

`PATCH /api/auth/profile/nickname` uses `AccessTokenGuard` without an audience-specific guard, validates trimmed 1–32 character nickname, updates only the current user, permits duplicate values, and returns `{ nickname }`.

- [ ] **Step 4: Run targeted verification**

Run: `corepack pnpm --filter @lingdian/api test -- --test-name-pattern="nickname is trimmed, repeatable"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/seed-auth-bootstrap.mjs backend/src/modules/auth backend/.env.example backend/package.json backend/src/config/env.validation.ts
git commit -m "feat(auth): bootstrap accounts and user nicknames"
```

### Task 6: 管理员端登录与商家账号管理 UI

**Files:**
- Modify: `admin/src/main.ts`
- Create: `admin/src/auth/session.ts`
- Create: `admin/src/auth/api-client.ts`
- Create: `admin/src/components/LoginPage.vue`
- Create: `admin/src/components/MerchantAccountsPage.vue`
- Create: `admin/src/components/ProfileNicknamePage.vue`
- Modify: `admin/src/App.vue`
- Modify: `admin/vite.config.ts`
- Test: `admin/src/auth/session.spec.ts`

**Interfaces:**
- Consumes `POST /api/auth/account/login` with `audience: 'admin-api'`.
- Consumes `/api/admin/merchants` with an in-memory bearer token.
- Produces a form that creates merchant accounts with at least one store selection.

- [ ] **Step 1: Write failing admin session/UI tests**

```ts
it('logs a super administrator in using admin-api', async () => {
  await adminSession.login('admin', 'long-password-123');
  expect(fetchMock).toHaveBeenCalledWith('/api/auth/account/login', expect.objectContaining({
    body: JSON.stringify({ username: 'admin', password: 'long-password-123', audience: 'admin-api' }),
  }));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `corepack pnpm --filter @lingdian/admin test -- --runInBand`

Expected: FAIL because the admin auth session module is absent; add the Vitest script/config only if necessary.

- [ ] **Step 3: Implement administrator login and merchant page**

Keep the access token in memory and refresh via HttpOnly cookie. Route unauthenticated users to login. The merchant create form contains username, phone, password, and a multi-select of existing stores; disable submit until at least one store is selected. Render backend validation messages without logging credentials. Include list, enabled state, and allowed stores; scope updates call `PATCH /api/admin/merchants/:userId`. Add a current-administrator profile page that calls `PATCH /api/auth/profile/nickname`; do not require nickname uniqueness.

- [ ] **Step 4: Run admin tests and build**

Run: `corepack pnpm --filter @lingdian/admin test && corepack pnpm --filter @lingdian/admin build`

Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add admin
git commit -m "feat(admin): manage merchant accounts"
```

### Task 7: 商家 Web 登录、忘记密码和修改密码 UI

**Files:**
- Modify: `web/src/auth/session.ts`
- Modify: `web/src/auth/session.spec.ts`
- Modify: `web/src/router/index.ts`
- Modify: `web/src/views/auth/login.vue`
- Create: `web/src/views/auth/forgot-password.vue`
- Create: `web/src/views/auth/change-password.vue`
- Create: `web/src/views/profile/nickname.vue`
- Modify: `web/src/layouts/admin-layout/index.vue`

**Interfaces:**
- Consumes account login with `audience: 'merchant-api'`.
- Consumes the four merchant password endpoints from Task 3.
- Produces Web-only forgot/change password routes.

- [ ] **Step 1: Write failing session tests**

```ts
it('logs a merchant in using merchant-api', async () => {
  await merchantSession.login('merchant-demo', 'merchant-password-123');
  expect(fetchMock).toHaveBeenCalledWith('/api/auth/account/login', expect.objectContaining({
    body: JSON.stringify({ username: 'merchant-demo', password: 'merchant-password-123', audience: 'merchant-api' }),
  }));
});

it('uses the same password-reset code flow for forgot and change password', async () => {
  await merchantSession.resetPassword('merchant-demo', '123456', 'replacement-password-123');
  expect(fetchMock).toHaveBeenCalledWith('/api/auth/password/reset', expect.any(Object));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `corepack pnpm --filter @lingdian/web test -- --runInBand`

Expected: FAIL because merchant session methods/routes are absent.

- [ ] **Step 3: Implement merchant-only pages**

Replace the phone-code administrator form with username/password merchant login. Add a `忘记密码` route with username, code request, code and new-password fields. Add a guarded `修改密码` route that requests the current merchant account's code and submits it with the new password. Both pages use the same six-digit code and new-password validation, clear in-memory access state after success, and redirect to merchant login. Add a current-merchant nickname page that calls `PATCH /api/auth/profile/nickname`; do not enforce uniqueness. Do not add password routes to `admin/` or `uniapp/`.

- [ ] **Step 4: Run Web tests and build**

Run: `corepack pnpm --filter @lingdian/web test && corepack pnpm --filter @lingdian/web build`

Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add web
git commit -m "feat(web): add merchant account password flows"
```

### Task 8: 小程序昵称与商家范围业务端点

**Files:**
- Modify: `uniapp/src/pages/user/user.vue`
- Modify: `uniapp/src/services/auth.ts`
- Create: `uniapp/src/services/profile.ts`
- Create: `uniapp/src/services/profile.spec.ts`
- Create: `backend/src/modules/merchant/merchant.controller.ts`
- Create: `backend/src/modules/merchant/merchant.service.ts`
- Create: `backend/src/modules/merchant/merchant-store-scope.ts`
- Create: `backend/src/modules/merchant/merchant.service.spec.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes `PATCH /api/auth/profile/nickname` under the current authenticated session.
- Produces `/api/merchant/stores` and store-filtered merchant reads protected by `MerchantGuard`.

- [ ] **Step 1: Write failing nickname and scope tests**

```ts
test('updates only the signed-in user nickname', async () => {
  await profile.updateNickname('灵点用户');
  assert.deepEqual(request.mock.calls[0][0].data, { nickname: '灵点用户' });
});

test('merchant stores endpoint returns only JWT-authorized stores', async () => {
  const stores = await merchantService.listStores({ roles: merchantRoles(['store-a']) });
  assert.deepEqual(stores.map((store) => store.id), ['store-a']);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `corepack pnpm --filter @lingdian/uniapp test -- --runInBand && corepack pnpm --filter @lingdian/api test -- --test-name-pattern="merchant stores endpoint"`

Expected: FAIL because nickname service and merchant store service are absent.

- [ ] **Step 3: Implement user nickname and merchant store endpoint**

Add a nickname entry to the uni-app profile page and call `profile.updateNickname`; do not add account-password UI or password routes. Implement `MerchantStoreScope` in `backend/src/modules/merchant/merchant-store-scope.ts`; it derives store IDs only from active `MERCHANT/STORE` JWT roles and rejects requested IDs outside that set. Add merchant endpoints only under `/api/merchant`, guarded by `AccessTokenGuard` and `MerchantGuard`, and use this helper for every store lookup. Return no store outside the granted scope.

- [ ] **Step 4: Run targeted tests and type-check**

Run: `corepack pnpm --filter @lingdian/uniapp test && corepack pnpm --filter @lingdian/uniapp type-check && corepack pnpm --filter @lingdian/api test -- --test-name-pattern="merchant stores endpoint"`

Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add uniapp backend/src/modules/merchant backend/src/app.module.ts
git commit -m "feat: add user nickname and merchant store scope"
```

### Task 9: 部署、测试与数据库初始化验证

**Files:**
- Modify: `backend/README.md`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-07-11-role-scoped-account-authentication-design.md`
- Test: `backend/src/modules/auth/auth.e2e.spec.ts`

**Interfaces:**
- Documents exact environment variable names and `db:seed:auth-bootstrap` invocation.
- Verifies database migration deploy and all three client builds.

- [ ] **Step 1: Add failing end-to-end scenarios**

```ts
test('isolates super-admin, merchant, and user audiences', async () => {
  assert.equal((await loginAccount('super-admin', 'admin-api')).user.audience, 'admin-api');
  assert.equal((await loginAccount('merchant-demo', 'merchant-api')).user.audience, 'merchant-api');
  await assert.rejects(() => loginAccount('merchant-demo', 'admin-api'), /credentials invalid/i);
});
```

- [ ] **Step 2: Run the scenario to verify it fails before the final wiring**

Run: `corepack pnpm --filter @lingdian/api test -- --test-name-pattern="isolates super-admin"`

Expected: FAIL until all account, role, and guard wiring is complete.

- [ ] **Step 3: Document operational steps**

Document migration deployment, all `AUTH_BOOTSTRAP_*` variables, the requirement to select existing store IDs, bootstrap invocation, and the fact that only merchant Web contains password recovery/change pages. Do not document actual passwords.

- [ ] **Step 4: Apply the new migration and bootstrap to the configured development database**

Run:

```bash
corepack pnpm run db:migrate:deploy
corepack pnpm run db:seed:auth-bootstrap
```

Expected: migration is applied once; bootstrap reports the upserted super administrator and test merchant without printing passwords.

- [ ] **Step 5: Run complete verification**

Run:

```bash
corepack pnpm test
corepack pnpm type-check
corepack pnpm build
git diff --check
```

Expected: all commands exit 0; API tests include account login, password flow, role/audience isolation, merchant store scope, and duplicate nickname coverage across authenticated audiences.

- [ ] **Step 6: Commit**

```bash
git add backend/README.md README.md docs/superpowers/specs/2026-07-11-role-scoped-account-authentication-design.md backend/src/modules/auth/auth.e2e.spec.ts
git commit -m "docs(auth): document account authentication operations"
```

## Plan self-review

- Spec coverage: Tasks 1–2 implement data and password security; Task 3 implements merchant password flows; Task 4 implements super-admin and merchant boundaries; Task 5 handles bootstrap and nickname API; Tasks 6–8 connect the three clients; Task 9 proves deployment and documents operation.
- Placeholder scan: every task names concrete files, interfaces, test names, commands, and expected results; no unresolved implementation marker remains.
- Type consistency: `merchant-api`, `SUPER_ADMIN`, `MERCHANT`, `PASSWORD_RESET`, `PasswordService.replace`, and `AUTH_BOOTSTRAP_*` use the same spelling in all tasks.
