# Repo Map

## Purpose
Capsule Wardrobe App is a full-stack prototype for passwordless sign-in, onboarding, profile flows, localization, and capsule-wardrobe-related backend workflows.

## Main runtime flows

### 1. App startup
- Root workspace scripts coordinate `client` and `server`
- Frontend starts via Vite
- Backend starts from `server/src/index.js`

### 2. Authentication flow
- UI initiates auth from the client
- server entrypoint routes requests
- auth/session logic lives around `authStore.js`
- email delivery logic lives in `email.js`
- auth test mode exists and should remain usable

### 3. Profile / onboarding flow
- screen-level flow lives under `client/src/screens/`
- API integration should live in `client/src/api/`
- persisted server-side behavior likely touches DB-backed modules

### 4. Capsule / wardrobe flow
- server-side domain state likely centers on `capsuleStore.js`
- AI-related generation or enrichment behavior lives under `server/src/ai/`

### 5. Localization flow
- locale resources and helpers live under `client/src/i18n/`
- changes to user-facing copy should preserve EN/RU parity

## Important files

### Root
- `package.json` — workspace definitions and top-level dev/test commands
- `README.md` — setup, env vars, deployment notes

### Client
- `client/package.json`
- `client/vite.config.js`
- `client/render-server.js`
- `client/netlify/functions/`
- `client/src/App.jsx`
- `client/src/main.jsx`
- `client/src/theme.js`

### Client feature areas
- `client/src/api/`
- `client/src/components/`
- `client/src/screens/`
- `client/src/search/`
- `client/src/i18n/`
- `client/src/utils/`

### Server
- `server/package.json`
- `server/src/index.js`
- `server/src/db.js`
- `server/src/email.js`
- `server/src/authStore.js`
- `server/src/capsuleStore.js`
- `server/src/ai/`
- `server/src/templates/`

## Test map

### Client tests
- `client/src/*.test.*`
- `client/src/*.e2e.test.*`

### Server tests
- `server/src/*.test.js`

### Shared tests
Run from root:
- `shared/wardrobeOrder.test.js`
- `shared/accentColors.test.js`
- `shared/colorSwatches.test.js`
- `shared/i18n/helpers.test.js`
- `shared/i18n/localeParity.test.js`

## Invariants
- The repo is a two-workspace monorepo: `client` and `server`
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