# Server working guide

## Scope
This directory contains the Express backend and server-side domain logic.

Primary areas:
- `index.js` — app/server entrypoint
- `db.js` — database access
- `email.js` — email sending and auth delivery behavior
- `authStore.js` — auth/session storage logic
- `capsuleStore.js` — capsule/domain storage logic
- `ai/` — AI integrations and orchestration
- `templates/` — server-side templates

## Rules
- Keep request/response contracts stable unless explicitly changing them.
- When editing server behavior, inspect the client caller as well.
- Preserve auth test mode behavior.
- Be conservative around env vars and startup logic.
- Prefer small changes to existing modules over introducing new framework layers.
- For AI integrations, avoid changing provider behavior or output assumptions without corresponding tests.

## Validation
- `npm run test:server`

## First files to inspect
- `index.js`
- nearest domain module
- corresponding `*.test.js` files