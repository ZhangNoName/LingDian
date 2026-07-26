# Account Management Submenus Implementation Plan

> **For Codex:** Execute this plan task-by-task with test-first changes and verification after each layer.

**Goal:** Split platform accounts into administrator, merchant, and ordinary-user submenus while retaining a reusable schema-driven list page and moving page actions into the filter row.

**Architecture:** Add an account-category contract and exclusive backend query predicates so pagination is correct at the data source. Drive one frontend view from route metadata, render navigation as a tree, and extend the generic search form with an action slot.

**Tech Stack:** Vue 3, Vue Router, Element Plus, Vitest, NestJS, Prisma, TypeScript, pnpm.

---

### Task 1: Add the shared account category and backend filtering

**Files:**
- Modify: `packages/contracts/src/auth.ts`
- Modify: `backend/src/modules/admin-users/dto/query-platform-users.dto.ts`
- Test: `backend/src/modules/admin-users/admin-users.service.spec.ts`
- Modify: `backend/src/modules/admin-users/admin-users.service.ts`

1. Add failing service tests for administrator, merchant, and ordinary-user predicates and verify `count` and `findMany` share the same `where`.
2. Run the focused backend test and confirm it fails.
3. Add `PlatformAccountType`, DTO validation, and exclusive Prisma predicates.
4. Rebuild contracts and rerun the focused backend test.

### Task 2: Convert account navigation and routes to three children

**Files:**
- Test: `admin/src/config/navigation.spec.ts`
- Modify: `admin/src/config/navigation.ts`
- Modify: `admin/src/components/layout/AdminSidebar.vue`
- Test: `admin/src/router/index.spec.ts`
- Modify: `admin/src/router/index.ts`
- Test/Modify: `admin/src/auth/permissions.spec.ts`
- Modify: `admin/src/auth/permissions.ts`

1. Add failing tests for the nested menu, route metadata, compatibility redirect, and first accessible route.
2. Implement the typed navigation tree and nested sidebar rendering.
3. Add the three routes with account type metadata and redirect `/users`.
4. Rerun focused navigation/router/permission tests.

### Task 3: Add the reusable filter-row action slot

**Files:**
- Test: `admin/src/components/schema-table/components.spec.ts`
- Modify: `admin/src/components/schema-table/SchemaSearchForm.vue`
- Modify: `admin/src/components/schema-table/SchemaTablePage.vue`

1. Add a failing component test proving custom actions render in the search/reset button container.
2. Add and forward the `search-actions` slot.
3. Rerun the focused component test.

### Task 4: Make the reusable user view category-aware

**Files:**
- Test: `admin/src/views/users/user-columns.spec.ts`
- Modify: `admin/src/views/users/user-columns.ts`
- Add: `admin/src/views/users/account-page-config.ts`
- Add: `admin/src/views/users/account-page-config.spec.ts`
- Modify: `admin/src/views/users/UserManagementView.vue`
- Modify: `admin/src/views/users/UserEditorDrawer.vue`

1. Add failing tests for category labels, default roles, store visibility, and column sets.
2. Implement account page configuration and category-aware columns.
3. Bind the fixed route account type into queries, remove the page heading, and place the category create button in `search-actions`.
4. Restrict the editor to the current category and preserve existing privilege checks.
5. Rerun focused user-view unit tests.

### Task 5: Align the system log list layout

**Files:**
- Modify: `admin/src/views/logs/SystemLogsView.vue`

1. Remove the redundant page heading.
2. Move refresh into the schema table `search-actions` slot.
3. Run the admin test suite.

### Task 6: Full verification

1. Run contracts build.
2. Run backend tests and build.
3. Run admin tests and build.
4. Run `git diff --check` and inspect the scoped diff while preserving unrelated observability changes.

