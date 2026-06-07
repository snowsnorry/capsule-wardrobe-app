# AGENTS.md

## Repository purpose
This repository is a full-stack capsule wardrobe application.

High-level responsibilities:
- `client/` contains the React frontend
- `server/` contains the Express API and server-side workflows
- `tests/e2e/` contains Playwright browser tests
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
- Browser e2e: Playwright against a dedicated Express/Vite e2e server with in-memory mocks
- Render single-service deployment is supported

## Directory map
- `client/` — frontend app
- `server/` — backend app
- `shared/` — shared TypeScript domain models, helpers, and tests
- `tests/e2e/` — Playwright fixtures, auth setup, and browser smoke tests
- `playwright.config.ts` — Playwright projects, web server command, and auth setup wiring
- `client/src/api/` — HTTP client calls, API-facing logic, request cache, and CSRF header injection
- `client/src/app/` — app shell, route content, state/actions, session bootstrap, navigation, and dialogs
- `client/src/auth/` — browser auth helpers such as passkey/WebAuthn flows
- `client/src/components/` — reusable UI pieces
- `client/src/components/productDetail/` — product and uploaded wardrobe item detail dialogs
- `client/src/components/tremor/` — local chart component wrappers used by statistics
- `client/src/i18n/` — localization resources and helpers
- `client/src/screens/` — page/screen-level UI flows
- `client/src/screens/mainScreen/` — main capsule/wardrobe screen composition
- `client/src/screens/searchScreen/` — search screen composition
- `client/src/screens/statisticsScreen/` — statistics screen composition
- `client/src/search/` — search-related UI or logic
- `client/src/test/` — client-side test helpers
- `client/src/utils/` — client utilities
- `server/src/ai/` — AI-related integrations and orchestration
- `server/src/db/` — split DB modules for auth, passkeys, profiles, capsule data, wardrobe, search, schema, product options, and MCP OAuth persistence
- `server/src/mcp/` — Streamable HTTP MCP server, bearer auth, OAuth discovery/PKCE/token routes, and read-only product/wardrobe tools
- `server/src/e2e/` — isolated e2e server, in-memory dependencies, fixtures, and e2e-only routes
- `server/src/routes/` — grouped Express route modules
- `server/src/test/` — server-side test helpers
- `server/src/templates/` — server-side templates
- `server/src/index.ts` — server entrypoint
- `server/src/appConfig.ts` — runtime env/config constants
- `server/src/appMiddleware.ts` — Helmet/CSP, CORS, rate limiters, auth guard, trusted-origin guard, and CSRF guard
- `server/src/serverStartup.ts` — DB bootstrap, dev Vite middleware, production static serving, and shared-capsule HTML metadata injection
- `server/src/db.ts` — database integration
- `server/src/db/sql/` — canonical schema SQL assets, including MCP OAuth tables
- `server/src/email.ts` — email delivery/auth messaging
- `server/src/authStore.ts` — auth/session-related storage logic
- `server/src/capsuleStore.ts` — capsule/domain storage logic
- `server/src/capsuleStore*.ts` — capsule context, delete, naming, sharing, model, and domain helpers
- `server/src/httpCookies.ts` — session, CSRF, and passkey challenge cookie helpers
- `server/src/passkeyHttp.ts` and `server/src/passkeyNames.ts` — passkey response/name helpers
- `server/src/r2Storage.ts` and `server/src/r2Delete.ts` — Cloudflare R2 upload/delete helpers
- `server/src/wardrobe*.ts` — uploaded wardrobe image processing, semantic metadata, PDF, and download helpers
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

Build:
- `npm run build`

Start:
- `npm run start`

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
- `npm run quality:cycles`
- `npm run quality:unused`
- `npm run quality:large-files`
- `npm run quality:large-files:strict`
- `npm run quality:gate`
- `npm run quality`
- `npm run security:audit`

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
- first inspect `server/src/index.ts`, the closest route module in `server/src/routes/`, and the closest domain module (`db.ts`, `db/`, `email.ts`, `authStore.ts`, `capsuleStore.ts`, `profileStore.ts`, `searchStore.ts`, or `ai/`)
- for passkey/WebAuthn work, inspect `server/src/index.ts`, `server/src/routes/passkeyRoutes.ts`, `server/src/db.ts`, `server/src/db/passkeys.ts`, `client/src/api/passkeys.ts`, and `client/src/auth/passkeys.ts`
- for MCP connector/OAuth work, inspect `server/src/index.ts`, `server/src/mcp/`, `server/src/db/mcpOAuth*.ts`, `server/src/db/sql/schema/08*_mcp_*.sql`, `server/src/appConfig.ts`, `server/src/appMiddleware.ts`, and `client/src/app/oauthReturn.ts`

For deployment/config tasks:
- inspect root `package.json`, `client/render-server.js`, `client/vite.config.ts`, and README first

For Playwright/e2e infrastructure tasks:
- inspect `playwright.config.ts`, `tests/e2e/`, `server/src/e2e/`, `server/src/index.ts`, and `server/package.json`

## Validation expectations
After editing files, check test coverage, ESLint, and test pass status before handing off. Prefer the narrowest relevant validation first:
- workspace-local tests for the changed area
- then broader repo tests if the change crosses boundaries
- coverage for the changed area, or full coverage for cross-cutting changes
- Run test commands and coverage commands sequentially. Do not run different test blocks in parallel, do not run coverage blocks in parallel, and do not run coverage at the same time as tests; these runs contend for resources and create misleading timeouts.
- After a large code change that touches multiple files, launch a sub-agent to perform a code review and recommend follow-up fixes. Review the recommendations, apply the ones that are relevant, then rerun the necessary tests, coverage, typecheck, format, and lint checks.
- At the end of the work, after the final file edits, run `npm run format`, then `npm run lint:strict`.
- if `npm run format` changes files, include those formatter changes in the diff

At minimum:
- UI-only changes: `npm run test:client` and `npm run coverage:client`
- server-only changes: `npm run test:server` and `npm run coverage:server`
- shared logic changes: `npm run test:shared` and `npm run coverage:shared`
- Playwright/e2e infrastructure changes: `npm run test:e2e`
- cross-cutting changes: `npm test` and `npm run coverage`
- TypeScript-only or contract-shape changes: run the narrowest relevant `typecheck` command
- docs-only changes: run `npm run format` and `npm run lint:strict`; code tests are not required when behavior is untouched
- after tests, coverage, typecheck, and format, run `npm run lint:strict`

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
