# Unified API Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route every browser request through `https://api.zsf.shopping/api` and start a temporary but persistent API stack.

**Architecture:** A shared frontend URL resolver normalizes old `/api/...` paths against `VITE_API_BASE`. The deployed API and MariaDB share a private Docker network, with generated server-only environment files.

**Tech Stack:** Vue 3, Vite, Vitest, NestJS, Docker, MariaDB, Nginx

## Global Constraints

- Do not commit credentials.
- Keep cookies secure and CORS restricted to the ZSF HTTPS origins.
- Preserve existing frontend and Sun World services.

---

### Task 1: Unified merchant API routing

**Files:**
- Create: `web/src/config/api.ts`
- Create: `web/src/config/api.spec.ts`
- Modify: `web/src/auth/session.ts`
- Modify: `web/src/auth/api-client.ts`
- Modify: `web/src/auth/session.spec.ts`
- Modify: `web/src/auth/api-client.spec.ts`

**Interfaces:**
- Produces: `resolveApiUrl(base: string, path: string): string` and `apiUrl(path: string): string`
- Consumes: `import.meta.env.VITE_API_BASE`

- [ ] Write failing tests expecting absolute API URLs for authentication and business requests.
- [ ] Run `corepack pnpm --filter @lingdian/web test -- --run` and verify the URL assertions fail.
- [ ] Add the URL resolver and use it at both request boundaries.
- [ ] Re-run the focused tests and the web build.
- [ ] Commit the frontend fix.

### Task 2: Temporary API runtime

**Files:**
- Modify: `deploy/scripts/release.sh`
- Modify: `scripts/deployment-targets.test.mjs`
- Modify: `docs/2026-07-27-zsf-shopping-lighthouse-deployment.md`

**Interfaces:**
- Consumes: server-only `/home/lighthouse/.config/lingdian/api.env`
- Produces: API container on `127.0.0.1:9000` connected to `lingdian-network`

- [ ] Add a failing deployment contract test for Docker network attachment.
- [ ] Run `corepack pnpm run check:deployment` and verify the contract fails.
- [ ] Attach migration, candidate, production, and rollback containers to the private network.
- [ ] Generate server-only database/API environment files and start MariaDB.
- [ ] Deploy and verify health, CORS, refresh behavior, and frontend availability.
- [ ] Commit and push the deployment fix.
