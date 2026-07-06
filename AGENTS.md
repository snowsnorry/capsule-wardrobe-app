# AGENTS.md

## Repository purpose
This repository is a full-stack capsule wardrobe application.

High-level responsibilities:
- `client/` contains the React frontend
- `server/` contains the Express API and server-side workflows
- `tests/e2e/` contains Playwright browser workflow/regression tests
- shared cross-workspace tests are run from the repository root

## Architecture
- Monorepo using npm workspaces
- Frontend: React + Vite + MUI + Tailwind CSS + Recharts + TypeScript
- Backend: Node.js + Express + TypeScript
- Persistence: Postgres
- Email auth delivery: Resend
- Passkey/WebAuthn auth: SimpleWebAuthn with DB-backed short-lived challenges
- External assistant access: read-only Streamable HTTP MCP connector with OAuth PKCE and DB-backed grants/tokens
- HTTP security: Helmet/CSP plus trusted-origin and CSRF guards for state-changing authenticated requests
- Public API contract: final camelCase request/response payloads
- Generated and uploaded image storage: Cloudflare R2 when configured
- Long-running work: Postgres-backed `pg-boss` jobs in production with in-memory jobs for tests/e2e
- Browser e2e: Playwright against a dedicated Express/Vite e2e server with in-memory mocks
- Render web-service deployment plus a cleanup cron is supported

## Directory map
- `client/` — frontend app
- `server/` — backend app
- `shared/` — shared TypeScript domain models, helpers, and tests
- `tests/e2e/` — Playwright fixtures, auth setup, and browser workflow/regression tests
- `playwright.config.ts` — Playwright projects, web server command, and auth setup wiring
- `client/src/api/` — HTTP client calls, API-facing logic, request cache, and CSRF header injection
- `client/src/api/jobs.ts` — queued job snapshots, SSE subscription, and wait helpers
- `client/src/app/` — app shell, route content, state/actions, session bootstrap, navigation, and dialogs
- `client/src/app/useActiveSidebarJobs.ts` — active job discovery, tracking, and UI wait orchestration
- `client/src/auth/` — browser auth helpers such as passkey/WebAuthn flows
- `client/src/components/` — reusable UI pieces
- `client/src/components/productDetail/` — product and uploaded wardrobe item detail dialogs
- `client/src/components/tremor/` — local chart component wrappers used by statistics
- `client/src/hooks/` — reusable frontend hooks
- `client/src/i18n/` — localization resources and helpers
- `client/src/screens/` — page/screen-level UI flows
- `client/src/screens/mainScreen/` — main capsule/wardrobe screen composition
- `client/src/screens/outfitScreen/` — saved outfit screen composition, report UI, item pickers, and media controls
- `client/src/screens/searchScreen/` — search screen composition
- `client/src/screens/statisticsScreen/` — statistics screen composition
- `client/src/search/` — search-related UI or logic
- `client/src/test/` — client-side test helpers
- `client/src/theme/` — centralized MUI theme factory, palette and radius tokens, CSS variables, component overrides, and typography
- `client/src/utils/` — client utilities
- `server/src/ai/` — AI-related integrations and orchestration
- `server/src/db/` — split DB modules for auth, passkeys, profiles, capsule data, wardrobe, personal item reports, search, liked items, schema, product options, and MCP OAuth persistence
- `server/src/mcp/` — Streamable HTTP MCP server, bearer auth, OAuth discovery/PKCE/token routes, and read-only product/wardrobe tools
- `server/src/e2e/` — isolated e2e server, in-memory dependencies, fixtures, and e2e-only routes
- `server/src/routes/` — grouped Express route modules
- `server/src/test/` — server-side test helpers
- `server/src/templates/` — server-side templates
- `server/src/index.ts` — server entrypoint
- `server/src/appFactory.ts` — Express app factory, middleware setup, route context creation, and direct plus `/api` route mounting
- `server/src/appDependencies.ts` — production dependency wiring for routes, stores, AI services, storage, passkeys, and OAuth helpers
- `server/src/appDependencyJobs.ts` — production/e2e job dependency selection and worker wiring
- `server/src/appRouteContext.ts` — route context assembly for guards, rate limiters, response mappers, and event helpers
- `server/src/appRoutes.ts` — central route group registration
- `server/src/appConfig.ts` — runtime env/config constants
- `server/src/appMiddleware.ts` — Helmet/CSP, CORS, rate limiters, auth guard, trusted-origin guard, and CSRF guard
- `server/src/serverStartup.ts` — DB bootstrap, dev Vite middleware, production static serving, and shared-capsule HTML metadata injection
- `server/src/db.ts` — database integration
- `server/src/db/sql/` — canonical schema SQL assets, including personal item report, liked-item, job run/event, and MCP OAuth tables
- `server/src/email.ts` — email delivery/auth messaging
- `server/src/jobs/` — persistent job queue, in-memory test/e2e jobs, workers, handlers, metrics, and staging helpers
- `server/src/maintenance/` — command-line maintenance entrypoints such as expired-record cleanup
- `server/src/authStore.ts` — auth/session-related storage logic
- `server/src/capsuleStore.ts` — capsule/domain storage logic
- `server/src/capsuleStore*.ts` — capsule context, delete, naming, sharing, model, and domain helpers
- `server/src/httpCookies.ts` — session, CSRF, and passkey challenge cookie helpers
- `server/src/passkeyHttp.ts` and `server/src/passkeyNames.ts` — passkey response/name helpers
- `server/src/r2Storage.ts` and `server/src/r2Delete.ts` — Cloudflare R2 upload/delete helpers
- `server/src/wardrobe*.ts` — uploaded wardrobe image processing, semantic metadata, Personal items reports, PDF, and download helpers
- `server/src/mcp/*.ts` — MCP OAuth config/routes, token validation, product search/stats/fetch tools, and wardrobe item tools
- `server/src/ai/sql/` — canonical SQL assets for AI wardrobe selection

## Commands
Run from repository root unless stated otherwise.

Install:
- `npm install`
- `npm run playwright:install`

Development:
- `npm run dev:all`
- `npm run dev:client`
- `npm run dev:server`
- `npm run dev:server:test-auth`
- `npm --workspace server run dev:e2e` — workspace-only e2e server helper used by Playwright

Build:
- `npm run build`

Start:
- `npm run start`
- `npm run start:render`
- `npm run start:client:render`

Maintenance:
- `npm run prune:expired-records`

Type checking:
- `npm run typecheck`
- `npm run typecheck:client`
- `npm run typecheck:server`
- `npm run typecheck:shared`

Tests:
- `npm test`
- `npm run test:client`
- `npm run test:server`
- `npm run test:shared`
- `npm run test:e2e`
- `npm run test:e2e:headed`
- `npm run test:e2e:ui`
- `npm run test:e2e:debug`

Coverage:
- `npm run coverage`
- `npm run coverage:client`
- `npm run coverage:server`
- `npm run coverage:shared`

Lint and quality:
- `npm run lint`
- `npm run lint:strict`
- `npm run lint:fix`
- `npm run format`
- `npm run format:check`
- `npm run quality:deps`
- `npm run quality:unused`
- `npm run quality:large-files`
- `npm run quality:large-files:strict`
- `npm run quality:gate`
- `npm run quality`
- `npm run security:audit`
- `npm run screenshots`

## Working rules
- Prefer minimal diffs.
- Do not refactor unrelated files during task-focused work.
- Preserve current workspace boundaries unless the task explicitly requires cross-cutting changes.
- When code exploration before edits is broad or uncertain, use sub-agents freely to inspect independent areas in parallel and synthesize their findings before choosing the implementation path.
- Read the nearest tests before editing implementation.
- When changing API contracts, inspect both `server/` and the corresponding `client/src/api/` usage.
- Keep public API payloads, client state, and e2e fixtures on the final camelCase contract; do not reintroduce snake_case compatibility or naming migration code unless explicitly requested.
- Treat personal wardrobe items as profile-owned records identified by `id`/`wardrobeId` and stable `wardrobe://...` keys. Determine their source only from the database-backed `source` field (`uploaded` or `from_catalog`) as exposed by the API. Do not infer personal item identity, source, ownership, or uploaded-vs-catalog status from any URL or storage path; product URLs, image URLs, and storage URLs are optional metadata and may be HTTP(S) for both uploaded and catalog-backed personal items.
- When changing localization-visible text, update locale resources and keep EN/RU parity.
- When changing auth, session, DB, email, or deployment behavior, be conservative and avoid incidental rewrites.
- When changing state-changing authenticated routes, preserve trusted-origin and CSRF checks and keep client calls on `client/src/api/request.ts` unless there is a specific reason not to.
- When changing passkeys/WebAuthn, preserve DB-backed challenge single-use semantics, do not return stored public keys to the client, and keep `PASSKEY_RP_ID`/`PASSKEY_ORIGIN` aligned with the visible frontend origin.
- When changing MCP connector/OAuth behavior, keep the connector read-only, preserve OAuth discovery, PKCE, dynamic client registration safeguards, redirect allowlists, bearer token issuer/audience/scope validation, hashed single-use authorization codes, and refresh-token rotation.
- When changing queued job behavior, preserve production `pg_boss` persistence, test/e2e in-memory jobs, profile ownership, active job caps/dedupe, `/jobs/*` SSE semantics, worker startup/shutdown, and expired-record cleanup.
- When changing account removal, preserve deletion of profile-scoped DB records, active sessions, MCP OAuth refresh tokens/grants/unconsumed authorization codes, transient generation/image/PDF jobs, uploaded R2 image objects, and session/passkey challenge cookies.
- When changing production CSP or image upload previews, update `server/src/appMiddleware.ts` tests with the allowed source behavior.
- When using Playwright for code validation, run it against the dedicated e2e server with in-memory dependencies, not against normal dev or production-like servers with external dependencies.
- Use Browser/Chrome DevTools/browser-use tools only when the user explicitly asks for browser-based validation or interaction in the current turn.
- If visual validation is explicitly requested, prefer headless Playwright against the dedicated e2e server with in-memory dependencies. Do not open interactive browsers or Browser plugin sessions unless explicitly requested.
- Keep Playwright e2e-only endpoints and env vars isolated from normal dev, production, and Render startup paths.
- Default Playwright e2e runs should not require real DB, email, LLM, embedding, or remote image services.
- Prefer extending existing patterns over introducing new abstractions.

## Change heuristics
For frontend tasks:
- first inspect `client/src/App.tsx`, `client/src/app/`, `client/src/screens/`, `client/src/components/`, and `client/src/api/`

For backend tasks:
- first inspect `server/src/index.ts`, app wiring in `server/src/appFactory.ts`, `server/src/appRoutes.ts`, `server/src/appDependencies.ts`, and `server/src/appRouteContext.ts` when relevant, the closest route module in `server/src/routes/`, and the closest domain module (`db.ts`, `db/`, `email.ts`, `authStore.ts`, `capsuleStore.ts`, `outfitStore.ts`, `profileStore.ts`, `searchStore.ts`, `wardrobe*.ts`, or `ai/`)
- for passkey/WebAuthn work, inspect `server/src/index.ts`, `server/src/routes/passkeyRoutes.ts`, `server/src/db.ts`, `server/src/db/passkeys.ts`, `client/src/api/passkeys.ts`, and `client/src/auth/passkeys.ts`
- for MCP connector/OAuth work, inspect `server/src/index.ts`, `server/src/mcp/`, `server/src/db/mcpOAuth*.ts`, `server/src/db/sql/schema/08*_mcp_*.sql`, `server/src/appConfig.ts`, `server/src/appMiddleware.ts`, and `client/src/app/oauthReturn.ts`
- for queued job work, inspect `client/src/api/jobs.ts`, `client/src/app/useActiveSidebarJobs.ts`, `server/src/routes/jobRoutes.ts`, `server/src/jobs/`, `server/src/db/job*.ts`, `server/src/db/jobs.ts`, `server/src/appDependencyJobs.ts`, `server/src/appConfig.ts`, and `server/src/serverStartup.ts`

For deployment/config tasks:
- inspect root `package.json`, `render.yaml`, `client/render-server.js`, `client/vite.config.ts`, `server/src/appConfig.ts`, `server/src/serverStartup.ts`, `server/src/maintenance/`, and README first

For Playwright/e2e infrastructure tasks:
- inspect `playwright.config.ts`, `tests/e2e/`, `server/src/e2e/`, `server/src/index.ts`, and `server/package.json`

## Validation expectations
After editing code or executable/config files, check coverage-backed test pass status, ESLint, unused-code status, and any needed type checks before handing off. Prefer the narrowest relevant validation first:
- workspace-local coverage for the changed area, or full coverage for cross-cutting changes
- `npm run coverage*` commands run the corresponding Vitest suites with coverage instrumentation, so do not also run the matching `npm run test*` command unless debugging a coverage-specific issue, chasing a flaky failure, or doing a fast pre-coverage smoke run
- Playwright e2e tests are separate from Vitest coverage and should still be run for Playwright/e2e infrastructure changes
- Run validation commands sequentially. Do not run different test blocks in parallel, do not run coverage blocks in parallel, and do not run coverage at the same time as tests; these runs contend for resources and create misleading timeouts.
- After a large code change that touches multiple files, launch a sub-agent to perform a code review and recommend follow-up fixes. Review the recommendations, apply the ones that are relevant, then rerun the necessary tests, coverage, typecheck, format, unused-code, and lint checks.
- At the end of code or executable/config work, after the final file edits, run `npm run format`, then `npm run quality:unused`, then `npm run lint:strict`.
- If `npm run format` changes files, include those formatter changes in the diff.
- Documentation-only changes do not require `npm run format`, `npm run lint:strict`, tests, coverage, typecheck, or `npm run quality:unused` unless code or executable/config files also changed.

At minimum:
- UI-only changes: `npm run coverage:client`
- server-only changes: `npm run coverage:server`
- shared logic changes: `npm run coverage:shared`
- Playwright/e2e infrastructure changes: `npm run test:e2e`
- cross-cutting changes: `npm run coverage`
- TypeScript-only or contract-shape changes: run the narrowest relevant `typecheck` command
- docs-only changes: no validation commands required when behavior and executable/config files are untouched
- after coverage, any needed tests, typecheck, and format, run `npm run quality:unused`, then `npm run lint:strict`

## Avoid
- Do not invent new architecture not already present in the repo.
- Never read, search, print, parse, or use `.env` / `.env*` files unless the user explicitly asks for that exact action in the current turn.
- Do not silently change env var names.
- Do not break auth-test mode.
- Do not identify, deduplicate, classify, or route personal wardrobe items by product `url`, image URL, storage path, URL scheme, or URL host. Never use URL shape checks such as `startsWith("http")`, pathname inspection, asset-domain checks, or `wardrobe://` key presence to determine item source; use only the database-backed `source` field for source classification.
- Do not change i18n behavior in only one locale.
- Do not move files across workspaces unless explicitly requested.
- Do not resurrect removed naming-convention migration scripts or package commands unless explicitly requested.

## When uncertain
- Consult `docs/repo_map.md`
- inspect nearest tests
- choose the smallest safe implementation

## Final response
- After changing files, include a recommended git commit message for the changes in the final response.
