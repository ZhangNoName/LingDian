# Unified API Routing Design

## Goal

All browser API requests from the app, merchant, and administrator sites use
`https://api.zsf.shopping/api`, while a temporary server configuration keeps the
API usable before production SMS and OAuth credentials are available.

## Design

The merchant frontend will use one URL helper for authentication and business
requests. It accepts both `/api/...` and API-relative paths so existing callers
can migrate without duplicating `/api`. The production build continues to inject
`VITE_API_BASE=https://api.zsf.shopping/api`.

The API runs with `NODE_ENV=development`, secure cookies, and an explicit CORS
allowlist for the four HTTPS sites. A dedicated MariaDB container and Docker
network provide temporary persistent storage. Secrets and database passwords are
generated on the server and remain outside Git.

## Verification

Unit tests cover URL construction, merchant session requests, and authenticated
business requests. Deployment verification checks API health, CORS preflight,
the public refresh endpoint, and all frontend health endpoints.
