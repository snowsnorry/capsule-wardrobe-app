# Server working guide

## Scope
This directory contains the Express backend and server-side domain logic.

Primary areas:
- `index.ts` — app/server entrypoint
- `db.ts` — database access
- `email.ts` — email sending and auth delivery behavior
- `authStore.ts` — auth/session storage logic
- `capsuleStore.ts` — capsule/domain storage logic
- `profileStore.ts` — profile storage logic
- `searchStore.ts` — search-related storage logic
- `ai/` — AI integrations and orchestration
- `templates/` — server-side templates

## Rules
- Keep request/response contracts stable unless explicitly changing them.
- When editing server behavior, inspect the client caller as well.
- Preserve auth test mode behavior.
- Be conservative around env vars and startup logic.
- Passkey/WebAuthn routes live in `index.ts` and persist through `db.ts`; preserve single-use challenge consumption and never expose `credential_public_key` in API responses.
- `PASSKEY_RP_ID` is the visible frontend hostname only, while `PASSKEY_ORIGIN` is the full visible frontend origin.
- Prefer small changes to existing modules over introducing new framework layers.
- For AI integrations, avoid changing provider behavior or output assumptions without corresponding tests.

## Validation
- `npm run test:server`
- `npm run server:typecheck`

## First files to inspect
- `index.ts`
- nearest domain module
- corresponding `*.test.ts` files
