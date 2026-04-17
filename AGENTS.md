# AGENTS.md

## Repository purpose
This repository is a full-stack capsule wardrobe application.

High-level responsibilities:
- `client/` contains the React frontend
- `server/` contains the Express API and server-side workflows
- shared cross-workspace tests are run from the repository root

## Architecture
- Monorepo using npm workspaces
- Frontend: React + Vite + MUI
- Backend: Node.js + Express
- Persistence: Postgres
- Email auth delivery: Resend
- Netlify deployment path exists for the client with a BFF proxy
- Render single-service deployment is supported

## Directory map
- `client/` — frontend app
- `server/` — backend app
- `client/src/api/` — HTTP client calls and API-facing logic
- `client/src/components/` — reusable UI pieces
- `client/src/i18n/` — localization resources and helpers
- `client/src/screens/` — page/screen-level UI flows
- `client/src/search/` — search-related UI or logic
- `client/src/utils/` — client utilities
- `server/src/ai/` — AI-related integrations and orchestration
- `server/src/templates/` — server-side templates
- `server/src/index.js` — server entrypoint
- `server/src/db.js` — database integration
- `server/src/email.js` — email delivery/auth messaging
- `server/src/authStore.js` — auth/session-related storage logic
- `server/src/capsuleStore.js` — capsule/domain storage logic

## Commands
Run from repository root unless stated otherwise.

Install:
- `npm install`

Development:
- `npm run dev:all`
- `npm run dev:client`
- `npm run dev:server`
- `npm run dev:server:test-auth`

Build:
- `npm run build`

Start:
- `npm run start`

Tests:
- `npm test`
- `npm run test:client`
- `npm run test:server`
- `npm run test:shared`

## Working rules
- Prefer minimal diffs.
- Do not refactor unrelated files during task-focused work.
- Preserve current workspace boundaries unless the task explicitly requires cross-cutting changes.
- Read the nearest tests before editing implementation.
- When changing API contracts, inspect both `server/` and the corresponding `client/src/api/` usage.
- When changing localization-visible text, update locale resources and keep EN/RU parity.
- When changing auth, session, DB, email, or deployment behavior, be conservative and avoid incidental rewrites.
- Prefer extending existing patterns over introducing new abstractions.

## Change heuristics
For frontend tasks:
- first inspect `client/src/App.jsx`, `client/src/screens/`, `client/src/components/`, and `client/src/api/`

For backend tasks:
- first inspect `server/src/index.js` and the closest domain module (`db.js`, `email.js`, `authStore.js`, `capsuleStore.js`, or `ai/`)

For deployment/config tasks:
- inspect root `package.json`, `client/netlify.toml`, `client/render-server.js`, `client/vite.config.js`, and README first

## Validation expectations
After edits, prefer the narrowest relevant validation first:
- workspace-local tests for the changed area
- then broader repo tests if the change crosses boundaries

At minimum:
- UI-only changes: `npm run test:client`
- server-only changes: `npm run test:server`
- shared logic changes: `npm run test:shared`
- cross-cutting changes: `npm test`

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