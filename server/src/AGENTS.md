# Server working guide

## Scope
This directory contains the Express backend and server-side domain logic.

Primary areas:
- `index.ts` — app/server entrypoint
- `db.ts` — database access
- `db/` — split database modules for auth, schema, passkeys, profiles, capsule data, search, and product options
- `routes/` — grouped Express route modules
- `email.ts` — email sending and auth delivery behavior
- `authStore.ts` — auth/session storage logic
- `capsuleStore.ts` — capsule/domain storage logic
- `capsuleStoreModel.ts` — capsule store model helpers
- `profileStore.ts` — profile storage logic
- `profileHttp.ts` — profile HTTP response helpers
- `searchStore.ts` — search-related storage logic
- `searchTypes.ts` — search-related server types
- `searchValidation.ts` — search request validation
- `ai/` — AI integrations and orchestration
- `templates/` — server-side templates

## Rules
- Keep request/response contracts stable unless explicitly changing them.
- When editing server behavior, inspect the client caller as well.
- When editing HTTP behavior, prefer the owning route module under `routes/` and keep `index.ts` focused on app wiring.
- Preserve auth test mode behavior.
- Be conservative around env vars and startup logic.
- Passkey/WebAuthn routes live in `routes/passkeyRoutes.ts` and persist through `db.ts` / `db/passkeys.ts`; preserve single-use challenge consumption and never expose `credential_public_key` in API responses.
- `PASSKEY_RP_ID` is the visible frontend hostname only, while `PASSKEY_ORIGIN` is the full visible frontend origin.
- Prefer small changes to existing modules over introducing new framework layers.
- For AI integrations, avoid changing provider behavior or output assumptions without corresponding tests.

## Validation
- `npm run test:server`
- `npm run typecheck:server`
- After tests and typecheck, run ESLint on changed server source files with zero warnings, for example `npx eslint --max-warnings=0 server/src/path/to/file.ts`

## First files to inspect
- `index.ts`
- `routes/`
- nearest domain module
- corresponding `*.test.ts` files
