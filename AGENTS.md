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
- Frontend: React + Vite + MUI + TypeScript
- Backend: Node.js + Express + TypeScript
- Persistence: Postgres
- Email auth delivery: Resend
- Passkey/WebAuthn auth: SimpleWebAuthn with DB-backed short-lived challenges
- Browser e2e: Playwright against a dedicated Express/Vite e2e server with in-memory mocks
- Render single-service deployment is supported

## Directory map
- `client/` — frontend app
- `server/` — backend app
- `shared/` — shared TypeScript domain models, helpers, and tests
- `tests/e2e/` — Playwright fixtures, auth setup, and browser smoke tests
- `playwright.config.ts` — Playwright projects, web server command, and auth setup wiring
- `client/src/api/` — HTTP client calls and API-facing logic
- `client/src/app/` — app shell, route content, state/actions, session bootstrap, navigation, and dialogs
- `client/src/auth/` — browser auth helpers such as passkey/WebAuthn flows
- `client/src/components/` — reusable UI pieces
- `client/src/i18n/` — localization resources and helpers
- `client/src/screens/` — page/screen-level UI flows
- `client/src/screens/mainScreen/` — main capsule/wardrobe screen composition
- `client/src/screens/searchScreen/` — search screen composition
- `client/src/screens/statisticsScreen/` — statistics screen composition
- `client/src/search/` — search-related UI or logic
- `client/src/test/` — client-side test helpers
- `client/src/utils/` — client utilities
- `server/src/ai/` — AI-related integrations and orchestration
- `server/src/db/` — split DB modules for auth, passkeys, profiles, capsule data, search, schema, and product options
- `server/src/e2e/` — isolated e2e server, in-memory dependencies, fixtures, and e2e-only routes
- `server/src/routes/` — grouped Express route modules
- `server/src/test/` — server-side test helpers
- `server/src/templates/` — server-side templates
- `server/src/index.ts` — server entrypoint
- `server/src/db.ts` — database integration
- `server/src/email.ts` — email delivery/auth messaging
- `server/src/authStore.ts` — auth/session-related storage logic
- `server/src/capsuleStore.ts` — capsule/domain storage logic

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

Coverage:
- `npm run coverage`
- `npm run coverage:client`
- `npm run coverage:server`
- `npm run coverage:shared`

Lint and quality:
- `npm run lint`
- `npm run lint:strict`
- `npm run format`
- `npm run format:check`
- `npm run quality:gate`
- `npm run quality`

## Working rules
- Prefer minimal diffs.
- Do not refactor unrelated files during task-focused work.
- Preserve current workspace boundaries unless the task explicitly requires cross-cutting changes.
- Read the nearest tests before editing implementation.
- When changing API contracts, inspect both `server/` and the corresponding `client/src/api/` usage.
- When changing localization-visible text, update locale resources and keep EN/RU parity.
- When changing auth, session, DB, email, or deployment behavior, be conservative and avoid incidental rewrites.
- When changing passkeys/WebAuthn, preserve DB-backed challenge single-use semantics, do not return stored public keys to the client, and keep `PASSKEY_RP_ID`/`PASSKEY_ORIGIN` aligned with the visible frontend origin.
- Keep Playwright e2e-only endpoints and env vars isolated from normal dev, production, and Render startup paths.
- Default Playwright e2e runs should not require real DB, email, LLM, embedding, or remote image services.
- Prefer extending existing patterns over introducing new abstractions.

## Change heuristics
For frontend tasks:
- first inspect `client/src/App.tsx`, `client/src/app/`, `client/src/screens/`, `client/src/components/`, and `client/src/api/`

For backend tasks:
- first inspect `server/src/index.ts`, the closest route module in `server/src/routes/`, and the closest domain module (`db.ts`, `db/`, `email.ts`, `authStore.ts`, `capsuleStore.ts`, `profileStore.ts`, `searchStore.ts`, or `ai/`)
- for passkey/WebAuthn work, inspect `server/src/index.ts`, `server/src/routes/passkeyRoutes.ts`, `server/src/db.ts`, `server/src/db/passkeys.ts`, `client/src/api/passkeys.ts`, and `client/src/auth/passkeys.ts`

For deployment/config tasks:
- inspect root `package.json`, `client/render-server.js`, `client/vite.config.ts`, and README first

For Playwright/e2e infrastructure tasks:
- inspect `playwright.config.ts`, `tests/e2e/`, `server/src/e2e/`, `server/src/index.ts`, and `server/package.json`

## Validation expectations
After editing files, check test coverage, ESLint, and test pass status before handing off. Prefer the narrowest relevant validation first:
- workspace-local tests for the changed area
- then broader repo tests if the change crosses boundaries
- coverage for the changed area, or full coverage for cross-cutting changes
- At the end of the work, after the final file edits, run `npm run format`, then `npm run lint:strict`.
- if `npm run format` changes files, include those formatter changes in the diff

At minimum:
- UI-only changes: `npm run test:client` and `npm run coverage:client`
- server-only changes: `npm run test:server` and `npm run coverage:server`
- shared logic changes: `npm run test:shared` and `npm run coverage:shared`
- Playwright/e2e infrastructure changes: `npm run test:e2e`
- cross-cutting changes: `npm test` and `npm run coverage`
- TypeScript-only or contract-shape changes: run the narrowest relevant `typecheck` command
- after tests, coverage, and typecheck, run ESLint on the changed source files with zero warnings, for example `npx eslint --max-warnings=0 <changed files>`

## Avoid
- Do not invent new architecture not already present in the repo.
- Do not silently change env var names.
- Do not break auth-test mode.
- Do not change i18n behavior in only one locale.
- Do not move files across workspaces unless explicitly requested.

## When uncertain
- Consult `docs/repo_map.md`
- inspect nearest tests
- choose the smallest safe implementation

## Final response
- After changing files, include a recommended git commit message for the changes in the final response.
