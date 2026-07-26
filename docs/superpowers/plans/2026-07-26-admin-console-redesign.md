# Admin Console Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild login and the authenticated admin console with Element Plus, permission-derived routed navigation, three-state theming, and secure platform-wide user management without account deletion.

**Architecture:** Shared contracts define user-management inputs and paginated outputs. A dedicated NestJS admin-users module enforces role hierarchy, performs account mutations, revokes sessions, and audits security changes. The Vue admin uses a router-driven shell, a single permission policy for routes and menus, and focused composables for theme and responsive layout.

**Tech Stack:** Vue 3.5, Vue Router 4, Element Plus 2, TypeScript 5.9, Vite 8, Vitest 4, NestJS, Prisma/MySQL, Node test runner.

## Global Constraints

- Use the repository-declared `pnpm@11.7.0` through `corepack pnpm` for project commands.
- Preserve unrelated working-tree changes under `packages/observability`.
- Support light, dark, and system themes; persist the choice and react live to system-theme changes.
- Generate visible menus from the authenticated user's roles and enforce the same policy in route guards.
- Support platform user create, edit, role change, store-scope change, password reset, enable, and disable; do not expose or implement deletion.
- Disabling an account must revoke active sessions and block future authentication.
- Never log passwords, password hashes, refresh tokens, or access tokens.
- Use comfortable spacing: 24px content gaps, 20–24px card padding, and approximately 52px table rows.

---

### Task 1: Shared User-Management Contracts and Database Fields

**Files:**
- Modify: `packages/contracts/src/auth.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20260726_admin_user_management/migration.sql`
- Test: `backend/src/modules/auth/admin-users.contract.spec.ts`

**Interfaces:**
- Produces: `PlatformUserSummary`, `PlatformUserDetail`, `PlatformUserPage`, `PlatformUserQuery`, `CreatePlatformUserRequest`, `UpdatePlatformUserRequest`, `ResetPlatformUserPasswordRequest`.
- Produces database fields: `User.lastLoginAt: DateTime?` and `User.mustChangePassword: Boolean @default(false)`.

- [ ] **Step 1: Write the failing contract test**

Create a compile-time/runtime shape test that imports all new contract types and asserts a representative `PlatformUserPage` contains `items`, `page`, `pageSize`, and `total`, and that a user contains `userId`, `nickname`, `username`, `phone`, `roles`, `storeIds`, `status`, `lastLoginAt`, and `createdAt`.

- [ ] **Step 2: Run the contract test to verify it fails**

Run: `corepack pnpm --filter @lingdian/api test -- admin-users.contract.spec.ts`

Expected: FAIL because the platform-user contract exports do not exist.

- [ ] **Step 3: Add exact shared types**

Define query fields `keyword?: string`, `role?: AuthRole`, `status?: 'ACTIVE' | 'DISABLED'`, `storeId?: string`, `page: number`, and `pageSize: number`. Define create/update payloads with nickname, username, phone, roles, store IDs, status, and password as appropriate; keep password out of all response types.

- [ ] **Step 4: Add schema fields and migration**

Add nullable `lastLoginAt` and default-false `mustChangePassword` columns to `users`. The migration must use `ALTER TABLE users ADD COLUMN lastLoginAt DATETIME(3) NULL, ADD COLUMN mustChangePassword BOOLEAN NOT NULL DEFAULT false;` and contain no unrelated schema changes.

- [ ] **Step 5: Generate Prisma and run the contract test**

Run: `corepack pnpm prisma:generate`

Run: `corepack pnpm --filter @lingdian/api test -- admin-users.contract.spec.ts`

Expected: PASS.

- [ ] **Step 6: Commit the contract and schema slice**

```powershell
git add packages/contracts/src/auth.ts packages/contracts/src/index.ts packages/db/prisma/schema.prisma packages/db/prisma/migrations/20260726_admin_user_management/migration.sql backend/src/modules/auth/admin-users.contract.spec.ts
git commit -m "feat(auth): define platform user management contracts"
```

### Task 2: Backend Platform User Query and Authority Policy

**Files:**
- Create: `backend/src/modules/admin-users/admin-user-policy.ts`
- Create: `backend/src/modules/admin-users/admin-user-policy.spec.ts`
- Create: `backend/src/modules/admin-users/dto/query-platform-users.dto.ts`
- Create: `backend/src/modules/admin-users/admin-users.service.ts`
- Create: `backend/src/modules/admin-users/admin-users.service.spec.ts`
- Create: `backend/src/modules/admin-users/admin-users.controller.ts`
- Create: `backend/src/modules/admin-users/admin-users.module.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: platform-user contracts from Task 1 and `AuthenticatedUser.roles`.
- Produces: `AdminUserPolicy.assertCanManage(operatorRoles, targetRoles, requestedRoles?)`.
- Produces: `AdminUsersService.list(query): Promise<PlatformUserPage>` and `get(userId): Promise<PlatformUserDetail>`.
- Produces endpoints: `GET /admin/users` and `GET /admin/users/:userId` protected by access-token and admin guards.

- [ ] **Step 1: Write failing authority-policy tests**

Cover: super admin can manage every role; admin can manage USER and MERCHANT; admin cannot manage ADMIN or SUPER_ADMIN; no operator can grant a role above their own authority; an operator cannot use a role update to escalate themselves.

- [ ] **Step 2: Run policy tests and verify failure**

Run: `corepack pnpm --filter @lingdian/api test -- admin-user-policy.spec.ts`

Expected: FAIL because `AdminUserPolicy` does not exist.

- [ ] **Step 3: Implement the role-rank policy**

Use explicit ranks `USER=0`, `MERCHANT=1`, `ADMIN=2`, `SUPER_ADMIN=3`. Throw `ForbiddenException` when the operator's maximum rank is not strictly greater than the target's maximum rank, except SUPER_ADMIN may manage lower-ranked targets; prohibit assigning a role whose rank is greater than or equal to the operator's rank.

- [ ] **Step 4: Write failing paginated-query tests**

Mock Prisma and verify keyword search spans nickname, account name, and phone; role/status/store filters are combined; pagination uses `(page - 1) * pageSize`; page size is clamped to 100; responses flatten active role assignments and store scopes without exposing credentials.

- [ ] **Step 5: Implement DTO validation, list, detail, controller, and module**

Use `class-validator` transforms for page defaults of 1 and pageSize defaults of 20. Select only required user, identity, role, and session timestamps. Map `lastLoginAt` directly from `User.lastLoginAt` and return ISO timestamps.

- [ ] **Step 6: Register the module and run focused tests**

Run: `corepack pnpm --filter @lingdian/api test -- admin-user-policy.spec.ts admin-users.service.spec.ts`

Expected: PASS.

- [ ] **Step 7: Commit read-only user administration**

```powershell
git add backend/src/modules/admin-users backend/src/app.module.ts
git commit -m "feat(admin): add platform user queries"
```

### Task 3: Backend User Mutations, Session Revocation, and Audit

**Files:**
- Create: `backend/src/modules/admin-users/dto/create-platform-user.dto.ts`
- Create: `backend/src/modules/admin-users/dto/update-platform-user.dto.ts`
- Create: `backend/src/modules/admin-users/dto/reset-platform-user-password.dto.ts`
- Modify: `backend/src/modules/admin-users/admin-users.service.ts`
- Modify: `backend/src/modules/admin-users/admin-users.controller.ts`
- Modify: `backend/src/modules/admin-users/admin-users.service.spec.ts`
- Modify: `backend/src/modules/auth/account-auth.service.ts`
- Modify: `backend/src/modules/auth/account-auth.service.spec.ts`

**Interfaces:**
- Consumes: `AdminUserPolicy` and Task 1 request contracts.
- Produces: `create`, `update`, `setStatus`, and `resetPassword` service methods.
- Produces endpoints: `POST /admin/users`, `PATCH /admin/users/:userId`, `PATCH /admin/users/:userId/status`, and `POST /admin/users/:userId/password-reset`.

- [ ] **Step 1: Write failing mutation tests**

Cover account creation with hashed password; merchant role requiring at least one store; atomic profile/identity/role/store-scope update; authority rejection; disabling increments `sessionVersion` and revokes all active sessions; enabling does not restore sessions; password reset hashes the new password, sets `mustChangePassword=true`, increments `sessionVersion`, and revokes sessions.

- [ ] **Step 2: Write failing audit tests**

Verify successful role, scope, status, and password-reset operations call the existing audit/system-log facilities with operator ID, target user ID, action, and result. Assert serialized metadata does not contain password or token values.

- [ ] **Step 3: Run focused tests and verify failure**

Run: `corepack pnpm --filter @lingdian/api test -- admin-users.service.spec.ts`

Expected: FAIL because mutation methods are absent.

- [ ] **Step 4: Implement validated transactional mutations**

Use Prisma transactions for multi-table writes. Reuse the existing `PasswordService` for policy checks and hashing. Reject empty role sets, duplicate identity values, merchant assignments without stores, and all authority-policy violations. Do not create a DELETE route.

- [ ] **Step 5: Enforce status and mandatory password change at login**

Update account login to record `lastLoginAt` after successful authentication. Continue rejecting `DISABLED` users. Include a non-secret `mustChangePassword` flag in authenticated session/user output so the frontend can redirect affected users to password change before normal modules.

- [ ] **Step 6: Run all focused backend auth/admin tests**

Run: `corepack pnpm --filter @lingdian/api test -- admin-users.service.spec.ts account-auth.service.spec.ts session.service.spec.ts`

Expected: PASS.

- [ ] **Step 7: Commit secure platform-user mutations**

```powershell
git add backend/src/modules/admin-users backend/src/modules/auth/account-auth.service.ts backend/src/modules/auth/account-auth.service.spec.ts
git commit -m "feat(admin): manage platform user accounts"
```

### Task 4: Admin Dependencies, Theme Bootstrap, and Permission Model

**Files:**
- Modify: `admin/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `admin/src/theme/theme.ts`
- Create: `admin/src/theme/theme.spec.ts`
- Create: `admin/src/auth/permissions.ts`
- Create: `admin/src/auth/permissions.spec.ts`
- Modify: `admin/src/main.ts`
- Modify: `admin/index.html`
- Modify: `admin/src/style.css`

**Interfaces:**
- Produces: `ThemePreference = 'light' | 'dark' | 'system'`.
- Produces: `useTheme()` with `preference`, `resolvedTheme`, and `setPreference`.
- Produces: `AdminPermission`, `hasPermission(roles, permission)`, and `firstAccessibleRoute(roles)`.

- [ ] **Step 1: Add Element Plus and Vue Router dependencies**

Run: `corepack pnpm --filter @lingdian/admin add element-plus@^2.11.8 vue-router@^4.6.4`

Expected: `admin/package.json` and `pnpm-lock.yaml` update without changing unrelated workspace dependencies.

- [ ] **Step 2: Write failing theme tests**

Test stored light/dark preference, system resolution through `matchMedia`, persistence, document `dark` class updates, and live `change` events only while preference is system.

- [ ] **Step 3: Implement theme bootstrap and composable**

Place a short inline bootstrap in `admin/index.html` that reads `lingdian-admin-theme`, resolves system preference, and sets `document.documentElement.classList` before CSS loads. In Vue, expose the same storage key and keep the media listener lifecycle stable.

- [ ] **Step 4: Write failing permission tests**

Assert SUPER_ADMIN sees users, logs, and profile; ADMIN sees users and profile but not logs unless explicitly allowed by policy; lower roles see profile only; first accessible route is deterministic.

- [ ] **Step 5: Implement one permission map**

Define permissions for `users:read`, `users:write`, `logs:read`, and `profile:write`. Keep role mapping in one object consumed by menus, route guards, and action visibility.

- [ ] **Step 6: Register Element Plus styles and dark variables**

Import Element Plus base CSS and `element-plus/theme-chalk/dark/css-vars.css` in `main.ts`. Replace global hard-coded control styles with layout tokens while retaining only application-level resets.

- [ ] **Step 7: Run frontend foundation tests and commit**

Run: `corepack pnpm --filter @lingdian/admin test -- theme.spec.ts permissions.spec.ts`

Expected: PASS.

```powershell
git add admin/package.json pnpm-lock.yaml admin/index.html admin/src/main.ts admin/src/style.css admin/src/theme admin/src/auth/permissions.ts admin/src/auth/permissions.spec.ts
git commit -m "feat(admin): add theme and permission foundations"
```

### Task 5: Router, Permission-Derived Navigation, and Classic Admin Shell

**Files:**
- Create: `admin/src/router/routes.ts`
- Create: `admin/src/router/index.ts`
- Create: `admin/src/router/router.spec.ts`
- Create: `admin/src/config/navigation.ts`
- Create: `admin/src/config/navigation.spec.ts`
- Create: `admin/src/layouts/AdminLayout.vue`
- Create: `admin/src/components/layout/AdminSidebar.vue`
- Create: `admin/src/components/layout/AdminHeader.vue`
- Create: `admin/src/components/layout/ThemeSwitcher.vue`
- Create: `admin/src/views/ForbiddenRedirect.vue`
- Modify: `admin/src/App.vue`
- Modify: `admin/src/main.ts`

**Interfaces:**
- Consumes: `hasPermission`, `firstAccessibleRoute`, `useTheme`, and `adminSession`.
- Produces: typed `navigationItems`, `visibleNavigationItems(roles)`, and the application router.

- [ ] **Step 1: Write failing navigation tests**

Test menu filtering, active-route calculation, grouped labels, and that every protected navigation entry names a permission understood by `hasPermission`.

- [ ] **Step 2: Write failing router-guard tests**

Test unauthenticated redirect to `/login?redirect=...`, authorized access, unauthorized redirect to the first accessible route with a warning marker, login-page redirect for an authenticated user, and route restoration after refresh.

- [ ] **Step 3: Implement route records and guards**

Use route metadata `{ title, permission?, public? }`. Lazy-load module views. Await `adminSession.ensureAccessToken()` before protected navigation and never use a component-local page switch.

- [ ] **Step 4: Build the classic shell with Element Plus**

Use `ElContainer`, `ElAside`, `ElHeader`, `ElMain`, `ElMenu`, `ElBreadcrumb`, `ElDropdown`, and `ElDrawer`. Implement desktop collapse, mobile drawer, active menu from `route.path`, theme switcher, nickname/profile link, and logout.

- [ ] **Step 5: Replace `App.vue` state switching with `RouterView`**

`App.vue` becomes a minimal router host. Login and authenticated layout selection come from route records rather than `v-if` page branches.

- [ ] **Step 6: Run navigation/router tests and build**

Run: `corepack pnpm --filter @lingdian/admin test -- navigation.spec.ts router.spec.ts`

Run: `corepack pnpm --filter @lingdian/admin build`

Expected: PASS.

- [ ] **Step 7: Commit routed admin shell**

```powershell
git add admin/src/router admin/src/config admin/src/layouts admin/src/components/layout admin/src/views/ForbiddenRedirect.vue admin/src/App.vue admin/src/main.ts
git commit -m "feat(admin): add permission-aware routed shell"
```

### Task 6: Rebuild Login and Profile Modules with Element Plus

**Files:**
- Create: `admin/src/views/LoginView.vue`
- Create: `admin/src/views/LoginView.spec.ts`
- Create: `admin/src/views/ProfileView.vue`
- Create: `admin/src/views/ProfileView.spec.ts`
- Modify: `admin/src/auth/session.ts`
- Modify: `admin/src/components/LoginPage.vue`
- Modify: `admin/src/components/ProfileNicknamePage.vue`

**Interfaces:**
- Consumes: router redirect query, `adminSession.login`, `adminSession.logout`, and existing nickname API.
- Produces: routed `/login` and `/profile` views; old page components become removable compatibility shells or are deleted after imports disappear.

- [ ] **Step 1: Write failing login-view tests**

Test required username/password validation, disabled submit while pending, accessible error alert, successful redirect to the safe requested route, and fallback to first accessible route.

- [ ] **Step 2: Implement branded responsive login**

Use `ElForm`, `ElInput`, `ElButton`, and `ElAlert`. Render brand copy beside the card on wide screens and collapse to a centered card on mobile. Preserve theme switching on the public page.

- [ ] **Step 3: Write failing profile-view tests**

Test initial nickname display, validation, pending state, success message, and API failure alert.

- [ ] **Step 4: Implement constrained profile settings card**

Use `ElCard` and `ElForm`; update session-visible nickname after a successful save so the header changes without reload.

- [ ] **Step 5: Remove obsolete component imports and run tests**

Run: `corepack pnpm --filter @lingdian/admin test -- LoginView.spec.ts ProfileView.spec.ts session.spec.ts`

Expected: PASS.

- [ ] **Step 6: Commit login and profile redesign**

```powershell
git add admin/src/views/LoginView.vue admin/src/views/LoginView.spec.ts admin/src/views/ProfileView.vue admin/src/views/ProfileView.spec.ts admin/src/auth/session.ts admin/src/components/LoginPage.vue admin/src/components/ProfileNicknamePage.vue
git commit -m "feat(admin): redesign login and profile"
```

### Task 7: Platform User Management Interface

**Files:**
- Create: `admin/src/services/admin-users.ts`
- Create: `admin/src/services/admin-users.spec.ts`
- Create: `admin/src/views/users/UserManagementView.vue`
- Create: `admin/src/views/users/UserManagementView.spec.ts`
- Create: `admin/src/views/users/UserEditorDrawer.vue`
- Create: `admin/src/views/users/UserPasswordResetDialog.vue`
- Create: `admin/src/views/users/user-form.ts`
- Create: `admin/src/views/users/user-form.spec.ts`
- Modify: `admin/src/components/MerchantAccountsPage.vue`

**Interfaces:**
- Consumes: Task 1 contracts, Task 3 endpoints, `adminRequest`, and permission helpers.
- Produces: API methods `listUsers`, `getUser`, `createUser`, `updateUser`, `setUserStatus`, and `resetUserPassword`.

- [ ] **Step 1: Write failing API-client tests**

Assert query serialization omits undefined filters, encodes keyword/store values, and mutation methods use the exact endpoint and HTTP method from Task 3.

- [ ] **Step 2: Implement the typed user service**

Return shared contract types and keep envelope/token handling inside existing `adminRequest`.

- [ ] **Step 3: Write failing form-rule tests**

Test merchant store requirement, username format, 12-character password minimum on create/reset, empty-role rejection, and conditional field normalization when MERCHANT is removed.

- [ ] **Step 4: Write failing view tests**

Test loading, empty, error/retry, filters, pagination, role/status tags, permission-hidden actions, drawer opening, status confirmation, and refresh after successful mutations.

- [ ] **Step 5: Implement the user table and filters**

Use `ElCard`, inline `ElForm`, `ElTable`, `ElPagination`, `ElTag`, `ElEmpty`, and loading directives. Provide columns for identity, roles, stores, status, last login, creation time, and actions.

- [ ] **Step 6: Implement create/edit drawer and password dialog**

Use a responsive `ElDrawer`; dynamically require stores for MERCHANT. Confirm enable/disable and password reset with clear security copy. Never render a delete action.

- [ ] **Step 7: Remove the merchant-only page from routing/imports and run tests**

Run: `corepack pnpm --filter @lingdian/admin test -- admin-users.spec.ts user-form.spec.ts UserManagementView.spec.ts`

Expected: PASS.

- [ ] **Step 8: Commit platform user interface**

```powershell
git add admin/src/services/admin-users.ts admin/src/services/admin-users.spec.ts admin/src/views/users admin/src/components/MerchantAccountsPage.vue
git commit -m "feat(admin): add platform user management UI"
```

### Task 8: Rebuild System Logs and Common Page States

**Files:**
- Create: `admin/src/views/logs/SystemLogsView.vue`
- Create: `admin/src/views/logs/SystemLogsView.spec.ts`
- Create: `admin/src/views/logs/LogDetailDrawer.vue`
- Create: `admin/src/components/common/PageHeader.vue`
- Create: `admin/src/components/common/PageError.vue`
- Modify: `admin/src/components/SystemLogsPage.vue`
- Modify: `admin/src/services/api.ts`

**Interfaces:**
- Consumes: existing system-log endpoint/contracts and `logs:read` permission.
- Produces: reusable page title/actions and retryable error components.

- [ ] **Step 1: Write failing log-view tests**

Test filter submission, refresh, loading, empty results, retryable failure, pagination, semantic log-level tags, and detail-drawer metadata rendering.

- [ ] **Step 2: Implement the filter card and paginated table**

Use Element Plus form controls, tags, table, pagination, empty state, and loading state. Keep verbose details out of table rows and render them in `LogDetailDrawer`.

- [ ] **Step 3: Add reusable page heading and error state**

`PageHeader` accepts title, description, and action slots. `PageError` accepts message and emits `retry`. Adopt both in users, logs, and profile modules.

- [ ] **Step 4: Remove obsolete log-page imports and run tests**

Run: `corepack pnpm --filter @lingdian/admin test -- SystemLogsView.spec.ts UserManagementView.spec.ts ProfileView.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit system-log redesign**

```powershell
git add admin/src/views/logs admin/src/components/common admin/src/components/SystemLogsPage.vue admin/src/services/api.ts admin/src/views/users/UserManagementView.vue admin/src/views/ProfileView.vue
git commit -m "feat(admin): redesign system logs"
```

### Task 9: End-to-End Verification and Cleanup

**Files:**
- Modify as needed: files changed in Tasks 1–8 only.
- Delete when unreferenced: `admin/src/components/HelloWorld.vue`
- Delete when fully replaced: `admin/src/components/LoginPage.vue`, `admin/src/components/MerchantAccountsPage.vue`, `admin/src/components/ProfileNicknamePage.vue`, `admin/src/components/SystemLogsPage.vue`
- Update: `admin/README.md`

**Interfaces:**
- Consumes: all earlier tasks.
- Produces: a buildable, tested admin console and documented local workflow.

- [ ] **Step 1: Run complete relevant tests**

Run: `corepack pnpm --filter @lingdian/contracts build`

Run: `corepack pnpm --filter @lingdian/api test`

Run: `corepack pnpm --filter @lingdian/admin test`

Expected: all suites PASS.

- [ ] **Step 2: Run production builds**

Run: `corepack pnpm --filter @lingdian/api build`

Run: `corepack pnpm --filter @lingdian/admin build`

Expected: both builds exit 0 with no TypeScript errors.

- [ ] **Step 3: Verify schema migration safety**

Run: `corepack pnpm --filter @lingdian/db prisma:validate`

Expected: Prisma schema is valid and the migration contains only the two user columns required by this feature.

- [ ] **Step 4: Perform manual visual and security smoke checks**

At desktop and mobile widths, verify login, sidebar collapse/drawer, breadcrumb, all theme modes, theme persistence, user filters, create/edit/reset/disable flows, log details, empty/error states, and horizontal table overflow. Confirm direct navigation to a forbidden route redirects safely and a disabled account loses access after its next request.

- [ ] **Step 5: Remove dead components and document commands**

Use `rg` to prove old components have no imports before deletion. Update `admin/README.md` with `corepack pnpm --filter @lingdian/admin dev`, test, build, route list, and theme behavior.

- [ ] **Step 6: Review the final diff and commit cleanup**

Run: `git diff --check`

Run: `git status --short`

Confirm unrelated `packages/observability` changes are not staged.

```powershell
git add admin backend packages/contracts packages/db/prisma admin/README.md pnpm-lock.yaml
git commit -m "feat(admin): complete classic management console redesign"
```
