# Icon Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize spacing for every icon-and-text button through a reusable Element Plus wrapper.

**Architecture:** `AppIconButton` is a thin presentational component that forwards attributes to `el-button` and owns only icon/text markup and spacing. Existing feature components consume it without changing events or behavior.

**Tech Stack:** Vue 3, TypeScript, Element Plus, Vue Test Utils, Vitest.

## Global Constraints

- Use a six-pixel icon/text gap.
- Do not change icon-only or text-only buttons.
- Preserve all existing button behavior and unrelated worktree changes.

---

### Task 1: Add and test AppIconButton

**Files:**
- Create: `admin/src/components/common/AppIconButton.vue`
- Test: `admin/src/components/common/AppIconButton.spec.ts`

- [ ] Write a failing test that mounts the component with an icon and label, asserts the two named elements, verifies disabled/type forwarding, and checks click emission.
- [ ] Implement the wrapper with `inheritAttrs: false`, `icon: Component`, `$attrs` forwarding, and scoped icon/text alignment classes.
- [ ] Run the focused test and confirm it passes.

### Task 2: Migrate shared controls

**Files:**
- Modify: `admin/src/components/schema-table/SchemaTablePage.vue`
- Modify: `admin/src/components/schema-table/SchemaSearchForm.vue`

- [ ] Replace search, reset, and collapse/expand icon-text buttons with `AppIconButton`.
- [ ] Run admin tests and build.
- [ ] Run `git diff --check` and commit only icon-button files.

