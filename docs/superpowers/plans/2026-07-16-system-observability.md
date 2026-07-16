# System Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver safe, low-coupling, source-aware logs that operators can inspect in the admin system.

**Architecture:** A standalone NestJS module owns persistence, retention and redaction. Framework hooks and lightweight client reporters are its only callers; business services remain independent of logging storage.

**Tech Stack:** NestJS 11, Prisma/MySQL, Vue 3, UniApp, TypeScript, Vitest/node:test.

## Global Constraints

- Sources are exactly `SERVER`, `MINIAPP`, `MERCHANT_WEB`, and `ADMIN_WEB`.
- Client logs are warning/error only and do not block user interactions.
- Persisted details are redacted and capped at 4 KiB; records are retained for 30 days.
- Only an `admin-api` session with the `SUPER_ADMIN` role may query logs.

---

### Task 1: Define contracts and persistence

**Files:**
- Modify: `packages/contracts/src/index.ts`, `packages/db/prisma/schema.prisma`, `packages/db/src/index.ts`
- Create: `packages/contracts/src/system-log.ts`, `packages/db/prisma/migrations/20260716_add_system_logs/migration.sql`

- [ ] Add source, level, category, client-event and paged-record TypeScript contracts.
- [ ] Add Prisma enums/model with `source, level, createdAt` and `event, createdAt` indexes.
- [ ] Add a deploy-only SQL migration matching the Prisma model.
- [ ] Build `@lingdian/contracts` and run `pnpm --filter @lingdian/db prisma:generate`.

### Task 2: Implement the bounded server log module

**Files:**
- Create: `backend/src/modules/system-log/system-log.service.ts`, `backend/src/modules/system-log/system-log.controller.ts`, `backend/src/modules/system-log/system-log.module.ts`, `backend/src/modules/system-log/dto/client-log-event.dto.ts`, `backend/src/modules/system-log/dto/query-system-logs.dto.ts`, `backend/src/modules/system-log/system-log.service.spec.ts`
- Modify: `backend/src/app.module.ts`, `backend/src/common/filters/all-exceptions.filter.ts`, `backend/src/main.ts`

- [ ] Write tests for truncation/redaction, client-source restrictions and retention throttle.
- [ ] Implement `SystemLogService.record`, `recordClientEvent`, and `query` with validation/redaction before persistence.
- [ ] Add client ingestion and super-admin query endpoints.
- [ ] Wire lifecycle, fatal exception/rejection, and HTTP 5xx logging at NestJS boundaries.
- [ ] Run `pnpm --filter @lingdian/api test` and `pnpm --filter @lingdian/api build`.

### Task 3: Add source-aware client reporters and admin viewer

**Files:**
- Create: `admin/src/logging/reporter.ts`, `admin/src/components/SystemLogsPage.vue`, `web/src/logging/reporter.ts`, `uniapp/src/logging/reporter.ts`
- Modify: `admin/src/App.vue`, `admin/src/services/api.ts`, `admin/src/main.ts`, `web/src/main.ts`, `uniapp/src/App.vue`, `uniapp/src/services/request.ts`, `admin/src/style.css`

- [ ] Add browser `error`/`unhandledrejection` hooks with capped, fire-and-forget transport.
- [ ] Add UniApp error/rejection and request-failure reporting.
- [ ] Add the admin list page with source/level controls and bounded server pagination.
- [ ] Run all client builds and focused client tests.

### Task 4: Verify and document operations

**Files:**
- Modify: `backend/.env.example`, `backend/README.md`

- [ ] Document configurable retention and operator endpoints.
- [ ] Run the workspace build, inspect generated Prisma client, and review the final diff for accidental sensitive-data collection.
