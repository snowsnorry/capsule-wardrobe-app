# Repo Map

## Purpose
Capsule Wardrobe App is a full-stack prototype for passwordless sign-in, onboarding, profile flows, localization, and capsule-wardrobe-related backend workflows.

## Main runtime flows

### 1. App startup
- Root workspace scripts coordinate `client` and `server`
- Frontend starts via Vite
- Backend starts from `server/src/index.ts`

### 2. Authentication flow
- UI initiates auth from the client
- server entrypoint routes requests
- auth/session logic lives around `authStore.ts`
- email delivery logic lives in `email.ts`
- auth test mode exists and should remain usable

### 3. Profile / onboarding flow
- screen-level flow lives under `client/src/screens/`
- API integration should live in `client/src/api/`
- persisted server-side behavior likely touches DB-backed modules

### 4. Capsule / wardrobe flow
- server-side domain state likely centers on `capsuleStore.ts`
- AI-related generation or enrichment behavior lives under `server/src/ai/`

### 5. Localization flow
- locale resources and helpers live under `client/src/i18n/`
- changes to user-facing copy should preserve EN/RU parity

## Important files

### Root
- `package.json` — workspace definitions and top-level dev/test commands
- `README.md` — setup, env vars, deployment notes
- `shared/` — TypeScript shared domain models, helpers, and cross-workspace tests

### Client
- `client/package.json`
- `client/tsconfig.json`
- `client/vite.config.ts`
- `client/render-server.js`
- `client/netlify/functions/`
- `client/src/App.tsx`
- `client/src/main.tsx`
- `client/src/theme.ts`

### Client feature areas
- `client/src/api/`
- `client/src/components/`
- `client/src/screens/`
- `client/src/search/`
- `client/src/i18n/`
- `client/src/utils/`

### Server
- `server/package.json`
- `server/tsconfig.json`
- `server/tsconfig.build.json`
- `server/tsconfig.test.json`
- `server/src/index.ts`
- `server/src/db.ts`
- `server/src/email.ts`
- `server/src/authStore.ts`
- `server/src/capsuleStore.ts`
- `server/src/profileStore.ts`
- `server/src/searchStore.ts`
- `server/src/serverUrlSecurity.ts`
- `server/src/ai/`
- `server/src/templates/`

## Test map

### Client tests
- `client/src/*.test.*`
- `client/src/*.e2e.test.*`

### Server tests
- `server/src/*.test.ts`
- `server/src/**/*.test.ts`

### Shared tests
Run from root:
- `shared/wardrobeOrder.test.ts`
- `shared/accentColors.test.ts`
- `shared/colorSwatches.test.ts`
- `shared/i18n/helpers.test.ts`
- `shared/i18n/localeParity.test.ts`

## Invariants
- The repo is a two-workspace monorepo: `client` and `server`
- Shared TypeScript modules live in root `shared/` and are validated from root scripts
- Root scripts are the canonical entrypoint for cross-workspace work
- Localization parity matters
- Auth test mode matters
- DB/env wiring should remain explicit and stable
- Netlify proxy path and Render deployment path are both first-class deployment concerns

## Safe edit strategy
1. Identify the owning workspace
2. Identify the owning module
3. Inspect closest tests
4. Make the smallest viable change
5. Run the narrowest relevant validation
6. Prefer `npm run typecheck` or workspace `typecheck` when changing TS types or module boundaries
