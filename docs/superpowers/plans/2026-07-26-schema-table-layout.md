# Schema-driven Admin Table Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable column-schema list-page system and migrate every admin list so only the table body scrolls, actions stay fixed, and all data is truly paginated.

**Architecture:** A domain-independent dictionary registry supplies stable select options and translated/fallback labels. A generic schema-table component family renders search, toolbar, table, actions, and pagination while each business page retains API/query ownership and custom cells through slots. The system-log contract and backend query become offset-paginated.

**Tech Stack:** Vue 3.5, TypeScript 5.9, Element Plus 2.11, Vitest 4, NestJS, Prisma, pnpm 11.7.

## Global Constraints

- Use the repository-declared `pnpm@11.7.0` through `corepack pnpm`.
- Do not modify or stage the existing `packages/observability` worktree changes.
- Dictionary code must not import table components, views, router, auth, or business services.
- The document viewport must not scroll inside authenticated admin routes.
- Tables own both horizontal and vertical overflow; action columns remain fixed at the right.
- Preserve the current permission policy and business mutation behavior.

---

### Task 1: Independent dictionary registry

**Files:**
- Create: `admin/src/dictionaries/types.ts`
- Create: `admin/src/dictionaries/registry.ts`
- Create: `admin/src/dictionaries/catalog.ts`
- Create: `admin/src/dictionaries/index.ts`
- Test: `admin/src/dictionaries/registry.spec.ts`

**Interfaces:**
- Produces: `DictionaryOption`, `DictionarySource`, `DictionaryRegistry`, `dictionaryRegistry`, and built-in dictionary codes.
- Produces: `getOptions(code)`, `getLabel(code, value, translate?)`, `register(code, source)`, and `invalidate(code?)`.

- [ ] Write tests proving fallback labels, translator use, async-loader caching, replacement registration, invalidation, and unknown-value fallback.
- [ ] Run `corepack pnpm --filter @lingdian/admin test -- registry.spec.ts` and verify failure because the module is absent.
- [ ] Implement the registry without UI or domain-service imports and register role/status/log dictionaries in `catalog.ts`.
- [ ] Re-run the focused test and verify it passes.

### Task 2: Schema types and pure helpers

**Files:**
- Create: `admin/src/components/schema-table/types.ts`
- Create: `admin/src/components/schema-table/schema.ts`
- Create: `admin/src/components/schema-table/schema.spec.ts`

**Interfaces:**
- Consumes: dictionary public types only.
- Produces: generic `SchemaColumn<Row>`, `SchemaAction<Row>`, `SchemaPagination`, `columnKey`, `getByDataIndex`, `formatCellValue`, and `createResetPatch`.

- [ ] Write tests proving nested `dataIndex` lookup, explicit-key normalization, `formatter` over `formater`, dictionary fallback, raw-value fallback, and reset patches for configured search fields only.
- [ ] Run the focused spec and verify expected missing-module failure.
- [ ] Implement the minimum pure helpers and types.
- [ ] Re-run the spec and verify it passes.

### Task 3: Schema search, actions, and table page components

**Files:**
- Create: `admin/src/components/schema-table/SchemaSearchForm.vue`
- Create: `admin/src/components/schema-table/SchemaTableActions.vue`
- Create: `admin/src/components/schema-table/SchemaTablePage.vue`
- Create: `admin/src/components/schema-table/index.ts`
- Create: `admin/src/components/schema-table/components.spec.ts`
- Modify: `admin/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: Task 1 registry and Task 2 schema helpers.
- Produces: `v-model:query`, `search`, `reset`, `page-change`, `page-size-change`, `retry`, cell/search/toolbar/action slots, and accessible icon actions.

- [ ] Add Vue Test Utils as an admin dev dependency if absent.
- [ ] Write component tests for generated search controls, search/reset events, collapse state, pagination events, custom cell slots, fixed right action column, tooltip text, and disabled actions.
- [ ] Run the focused spec and verify expected failures.
- [ ] Implement the three components using Element Plus and a flex-height table with `height="100%"`.
- [ ] Re-run the focused spec and verify it passes.

### Task 4: Offset-paginated system-log contract and backend

**Files:**
- Modify: `packages/contracts/src/system-log.ts`
- Modify: `backend/src/modules/system-log/dto/query-system-logs.dto.ts`
- Modify: `backend/src/modules/system-log/system-log.service.ts`
- Modify: `backend/src/modules/system-log/system-log.service.spec.ts`
- Modify: `backend/src/modules/system-log/system-log.controller.ts`

**Interfaces:**
- Produces: `SystemLogQuery { page, pageSize, ...filters }` and `SystemLogPage { items, total, page, pageSize }`.
- Backend service uses one shared `where`, `count`, `skip=(page-1)*pageSize`, and `take=pageSize`.

- [ ] Replace the cursor regression test with a failing offset-pagination test using literal expected skip/take/count results and filter assertions.
- [ ] Run `corepack pnpm --filter @lingdian/api test -- system-log.service.spec.ts` and verify failure against cursor behavior.
- [ ] Implement DTO defaults/bounds, paginated service response, and controller mapping.
- [ ] Re-run the focused backend test and verify it passes.

### Task 5: Paginated admin system-log client

**Files:**
- Modify: `admin/src/services/api.ts`
- Modify: `admin/src/services/system-logs.spec.ts`

**Interfaces:**
- Consumes: new shared system-log query/page contracts.
- Produces: a URL containing `page`, `pageSize`, and optional filters with no cursor.

- [ ] Change the client-path test first to expect `page=2&pageSize=20` and encoded filters.
- [ ] Run the focused admin test and verify failure.
- [ ] Implement typed paginated path building and request handling.
- [ ] Re-run the focused test and verify it passes.

### Task 6: User and log column schemas

**Files:**
- Create: `admin/src/views/users/user-columns.ts`
- Create: `admin/src/views/users/user-columns.spec.ts`
- Create: `admin/src/views/logs/log-columns.ts`
- Create: `admin/src/views/logs/log-columns.spec.ts`

**Interfaces:**
- Produces: `createUserColumns(stores)` and `createLogColumns()`.
- User columns expose identity/roles slots and searchable keyword/role/status/store fields.
- Log columns use dictionaries for source/level and expose the detail action slot.

- [ ] Write schema-contract tests that assert search fields, option sources, fixed action configuration, overflow behavior, and slot names.
- [ ] Run the focused tests and verify missing-module failures.
- [ ] Implement the schema factories using only domain types plus generic schema/dictionary public contracts.
- [ ] Re-run focused tests and verify they pass.

### Task 7: Migrate all list views

**Files:**
- Modify: `admin/src/views/users/UserManagementView.vue`
- Modify: `admin/src/views/logs/SystemLogsView.vue`
- Create: `admin/src/views/logs/LogDetailDrawer.vue`

**Interfaces:**
- Consumes: Tasks 3, 5, and 6.
- User page retains existing create/edit/password/status methods and authority rules.
- Log page owns `{ page, pageSize, source, level }` and opens the detail drawer from an icon action.

- [ ] Add view-level tests or schema-driven integration assertions for search/reset paging, custom slots, and action emission before replacing templates.
- [ ] Run focused tests and verify failure against the current hand-written pages.
- [ ] Replace both repeated form/table templates with `SchemaTablePage` and `SchemaTableActions`, preserving business behavior.
- [ ] Re-run all admin focused tests and verify they pass.

### Task 8: Viewport layout and route scroll ownership

**Files:**
- Modify: `admin/src/router/index.ts`
- Modify: `admin/src/layouts/AdminLayout.vue`
- Modify: `admin/src/style.css`
- Modify: `admin/src/router/access.spec.ts` or add a focused layout metadata test.

**Interfaces:**
- Route meta adds `layout?: 'list' | 'scroll'`.
- List routes render in a non-scrolling flex viewport; other authenticated routes receive a dedicated scroll container.

- [ ] Write a route/layout test proving users and logs opt into list layout while profile uses standard scroll layout.
- [ ] Run it and verify failure because layout metadata is absent.
- [ ] Implement route metadata, layout wrapper, height/min-height constraints, collapsible search styles, responsive behavior, and internal table overflow.
- [ ] Re-run the focused test and admin build.

### Task 9: Full verification and documentation

**Files:**
- Modify: `admin/README.md`

**Interfaces:**
- Documents schema column properties, dictionary registration, slots, pagination, and scroll ownership.

- [ ] Document a minimal schema example and the rule that dictionaries remain independent of domain services and UI components.
- [ ] Run `corepack pnpm --filter @lingdian/contracts build`.
- [ ] Run `corepack pnpm --filter @lingdian/api test`.
- [ ] Run `corepack pnpm --filter @lingdian/admin test`.
- [ ] Run `corepack pnpm --filter @lingdian/api build` and `corepack pnpm --filter @lingdian/admin build`.
- [ ] Run `git diff --check` and inspect `git status --short`, proving observability changes remain untouched.
- [ ] Review every design requirement against files and fresh command output before completion.
