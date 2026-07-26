# Schema Table Toolbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable toolbar row between the optional filter form and table, with business actions left and conditional search/reset controls right.

**Architecture:** Keep field rendering inside `SchemaSearchForm` and move all action ownership to `SchemaTablePage`. Derive visibility from `columns.some(column => column.isSearch)` and available slots, then migrate page-specific actions to `toolbar-actions`.

**Tech Stack:** Vue 3, TypeScript, Element Plus, Vue Test Utils, Vitest, pnpm.

## Global Constraints

- Preserve table-owned scrolling, fixed right action columns, and pagination.
- Preserve `toolbar` as a compatibility alias for left-side business actions.
- Do not render empty search or toolbar regions.
- Preserve unrelated observability worktree changes.

---

### Task 1: Specify toolbar rendering behavior

**Files:**
- Test: `admin/src/components/schema-table/components.spec.ts`

**Interfaces:**
- Consumes: `SchemaTablePage` props `columns`, `query`, `data`, and `pagination`.
- Produces: expected `toolbar-actions` slot and conditional DOM behavior.

- [ ] Add tests mounting `SchemaTablePage` with searchable columns and `toolbar-actions`, asserting `.schema-table-page__toolbar-left` contains the custom action and `.schema-table-page__toolbar-right` contains search/reset.
- [ ] Add tests mounting it with columns lacking `isSearch`, asserting the search form and right controls are absent while a supplied business action remains.
- [ ] Add a no-search/no-slot case asserting the toolbar is absent.
- [ ] Run `corepack pnpm --filter @lingdian/admin exec vitest run src/components/schema-table/components.spec.ts` and confirm failures identify missing toolbar behavior.

### Task 2: Move actions from the search form into the table toolbar

**Files:**
- Modify: `admin/src/components/schema-table/SchemaSearchForm.vue`
- Modify: `admin/src/components/schema-table/SchemaTablePage.vue`
- Modify: `admin/src/style.css`

**Interfaces:**
- Consumes: searchable `SchemaColumn<Row>[]` and slots named `toolbar-actions` or `toolbar`.
- Produces: `hasSearchColumns`, conditional search form, left business group, and right search/reset group.

- [ ] Remove Search/Refresh icon imports, button markup, and `search-actions` from `SchemaSearchForm` while retaining its submit event for Enter-key submission.
- [ ] Compute `hasSearchColumns` in `SchemaTablePage` and render `SchemaSearchForm` only when `searchable && hasSearchColumns`.
- [ ] Render the toolbar when search exists or either action slot exists; forward `toolbar-actions` first and `toolbar` as fallback on the left.
- [ ] Render Search and Reset buttons with icons on the right only when search exists; emit the existing events.
- [ ] Style the toolbar and its left/right groups for desktop alignment and narrow-screen wrapping.
- [ ] Rerun the focused component test and confirm it passes.

### Task 3: Migrate pages and verify

**Files:**
- Modify: `admin/src/views/users/UserManagementView.vue`
- Modify: `admin/src/views/logs/SystemLogsView.vue`

**Interfaces:**
- Consumes: `SchemaTablePage` slot `toolbar-actions`.
- Produces: account create and log refresh actions in the left toolbar group.

- [ ] Rename account and log page slots from `search-actions` to `toolbar-actions`.
- [ ] Run `corepack pnpm --filter @lingdian/admin test` and expect all tests to pass.
- [ ] Run `corepack pnpm --filter @lingdian/admin build` and expect Vue type-checking and Vite production build to pass.
- [ ] Run `git diff --check`, inspect the scoped diff, and commit only toolbar-related files.

