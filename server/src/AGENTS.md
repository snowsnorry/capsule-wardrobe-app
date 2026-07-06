# Server working guide

## Scope
This directory contains the Express backend and server-side domain logic.

Primary areas:
- `index.ts` — app/server entrypoint
- `appFactory.ts` — Express app factory, middleware setup, route context creation, and direct plus `/api` route mounting
- `appDependencies.ts` — production dependency wiring for routes, stores, AI services, storage, passkeys, and OAuth helpers
- `appDependencyJobs.ts` — production/e2e job dependency selection and worker wiring
- `appRouteContext.ts` — route context assembly for guards, rate limiters, response mappers, and event helpers
- `appRoutes.ts` — central route group registration
- `appConfig.ts` — env-backed runtime constants and client dist/root resolution
- `appMiddleware.ts` — Helmet/CSP, CORS, rate limiters, auth guard, trusted-origin guard, and CSRF guard
- `serverStartup.ts` — DB bootstrap, dev Vite middleware, production static serving, and shared-capsule HTML metadata injection
- `db.ts` — database access
- `db/` — split database modules for auth, schema, passkeys, profiles, capsule data, wardrobe, personal item reports, search, liked items, job runs/events, product lookup, and product options
- `db/sql/` — canonical schema SQL assets; keep one executable statement per schema file
- `routes/` — grouped Express route modules
- `routes/jobRoutes.ts` — authenticated job list/detail/SSE endpoints
- `httpCookies.ts` — session, CSRF, and passkey challenge cookie helpers
- `email.ts` — email sending and auth delivery behavior
- `authStore.ts` — auth/session storage logic
- `capsuleStore.ts` — capsule/domain storage logic
- `capsuleStoreContext.ts`, `capsuleStoreDelete.ts`, `capsuleStoreNaming.ts`, and `capsuleStoreSharing.ts` — capsule store helpers
- `capsuleStoreModel.ts` — capsule store model helpers
- `capsuleEventHttp.ts` — capsule SSE/event response helpers
- `profileStore.ts` — profile storage logic
- `profileHttp.ts` — profile HTTP response helpers
- `passkeyHttp.ts` and `passkeyNames.ts` — passkey response and naming helpers
- `searchStore.ts` — search-related storage logic
- `searchSemantic.ts` — semantic search helpers
- `searchTypes.d.ts` — search-related server types
- `searchValidation.ts` — search request validation
- `jobs/` — persistent job queue, in-memory test/e2e jobs, workers, handlers, metrics, and staging helpers
- `mcp/` — Streamable HTTP MCP server, bearer auth, OAuth discovery/PKCE/token routes, read-only product tools, wardrobe tools, and schemas
- `db/mcpOAuth.ts` and `db/mcpOAuthRefreshTokens.ts` — MCP authorization code, grant, dynamic client registration, and refresh-token persistence
- `ai/` — AI integrations and orchestration
- `ai/sql/` — SQL assets for AI wardrobe selection and regeneration queries
- `wardrobe*.ts` — upload normalization, image analysis, embeddings, metadata updates, cleanup, Personal items report PDF sections, PDF, and child-process helpers
- `sharedCapsuleMeta.ts` — shared capsule HTML/OG metadata injection helpers
- `e2e/` — isolated e2e server, in-memory dependencies, fixtures, and test-control routes
- `maintenance/` — command-line maintenance entrypoints such as expired-record cleanup
- `test/` — server-side test helpers
- `templates/` — server-side templates

## Rules
- Keep request/response contracts stable unless explicitly changing them.
- Public API payloads and fixtures use the final camelCase contract; do not reintroduce snake_case compatibility or removed naming-convention migration scripts unless explicitly requested.
- For broad pre-edit exploration or large multi-file code changes, follow the root AGENTS.md sub-agent exploration and post-change review workflow.
- When editing server behavior, inspect the client caller as well.
- When editing HTTP behavior, prefer the owning route module under `routes/` and keep `index.ts` focused on app wiring.
- When editing route registration or dependency injection, prefer `appFactory.ts`, `appRoutes.ts`, `appDependencies.ts`, and `appRouteContext.ts` over adding wiring directly to `index.ts`.
- State-changing authenticated routes should preserve `requireTrustedOrigin`, `requireAuth`, and `requireCsrf`; auth endpoints should preserve their route-specific guards and rate limiters.
- Preserve auth test mode behavior.
- Be conservative around env vars and startup logic.
- Passkey/WebAuthn routes live in `routes/passkeyRoutes.ts` and persist through `db.ts` / `db/passkeys.ts`; preserve single-use challenge consumption and never expose `credential_public_key` in API responses.
- `PASSKEY_RP_ID` is the visible frontend hostname only, while `PASSKEY_ORIGIN` is the full visible frontend origin.
- MCP connector routes live in `mcp/` and are registered through `appRoutes.ts` from `appFactory.ts`; keep tools read-only and preserve OAuth discovery, PKCE, dynamic client registration safeguards, redirect allowlists, bearer token issuer/audience/scope validation, hashed single-use authorization codes, and refresh-token rotation.
- Queued job routes live in `routes/jobRoutes.ts`, persistence in `db/job*.ts` and `db/jobs.ts`, and workers under `jobs/`; preserve production `pg_boss` persistence, test/e2e in-memory jobs, profile ownership, active job caps/dedupe, SSE semantics, worker startup/shutdown, and expired-record cleanup.
- Account removal lives under `DELETE /profile/me`; preserve cleanup of profile-scoped DB records, sessions, MCP OAuth refresh tokens/grants/unconsumed authorization codes, transient generation/image/PDF jobs, uploaded R2 image objects, and session/passkey challenge cookies.
- Production CSP lives in `appMiddleware.ts`; when changing image previews, Google Sign-In, or other external resources, update the CSP and its tests together.
- Prefer small changes to existing modules over introducing new framework layers.
- For AI integrations, avoid changing provider behavior or output assumptions without corresponding tests.

## Validation
- Documentation-only changes do not require validation commands when behavior and executable/config files are untouched.
- `npm run coverage:server`
- `npm run typecheck:server`
- At the end of server code or executable/config work, after the final file edits, run `npm run format`.
- If `npm run format` changes files, include those formatter changes in the diff.
- `npm run coverage:server` runs the server Vitest suite with coverage instrumentation, so do not also run `npm run test:server` unless debugging a coverage-specific issue, chasing a flaky failure, or doing a fast pre-coverage smoke run.
- After editing server code, verify coverage-backed test pass status and ESLint before handing off.
- After coverage, typecheck, and format, run `npm run quality:unused`, then `npm run lint:strict`.

## First files to inspect
- `index.ts`
- `appFactory.ts`, `appRoutes.ts`, `appDependencies.ts`, and `appRouteContext.ts` for app wiring or dependency changes
- `routes/`
- `routes/jobRoutes.ts`, `jobs/`, `db/job*.ts`, `db/jobs.ts`, and `appDependencyJobs.ts` for queued job work
- `mcp/` for MCP connector or OAuth work
- nearest domain module
- corresponding `*.test.ts` files

## Final response
- After changing files, include a recommended git commit message for the changes in the final response.
