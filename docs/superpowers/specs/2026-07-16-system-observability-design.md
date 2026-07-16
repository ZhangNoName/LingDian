# System Observability Design

## Goal

Add a low-coupling, queryable operational log stream for the API, merchant web,
administrator web, and mini-program without recording secrets or allowing
unbounded log growth.

## Architecture

`SystemLogService` is an application service with a small `record()` boundary.
It sanitizes and truncates log input before writing a structured `SystemLog`
row. Business modules do not know the table schema; HTTP and process concerns
are attached at framework entry points, while browser clients use a small
fire-and-forget reporter that only calls the public ingestion endpoint.

Each event has a source (`SERVER`, `MINIAPP`, `MERCHANT_WEB`, or `ADMIN_WEB`),
level, category, short event key, message, optional request/user context, and
bounded JSON details. The service deletes records older than 30 days when a
new row is recorded, at most once per hour per process. Sensitive headers,
credentials, cookies, token-like values, and over-sized values are not stored.

## Data flow

1. API lifecycle and fatal process hooks write `SERVER` events directly.
2. The exception filter records server-side failures with HTTP context.
3. Client reporters attach source and safe browser/platform context, then send
   errors to `POST /api/system-logs/client-events` without blocking the UI.
4. Super administrators use `GET /api/admin/system-logs` and the admin page to
   filter by source, level, and time window.

## Security and size limits

- Client ingestion accepts only `WARN` and `ERROR`; it cannot impersonate the
  server source or submit arbitrary user/session identifiers.
- Event/message/path/user-agent/details fields are capped at 64/512/256/256/
  4096 characters respectively; details are recursively redacted and capped.
- IP addresses are coarse-masked. No cookies, authorization headers, passwords,
  refresh tokens, or raw stack traces are persisted.
- Retention is 30 days, with indexed source/level/time and event/time queries.

## Verification

Unit tests cover sanitization, source validation, retention scheduling, and
query mapping. Build/type-check verifies all three clients and the API.
