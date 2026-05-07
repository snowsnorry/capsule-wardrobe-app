# Repo Map

## Purpose
Capsule Wardrobe App is a full-stack prototype for passwordless sign-in, onboarding, profile flows, localization, and capsule-wardrobe-related backend workflows.

## Main runtime flows

### 1. App startup
- Root workspace scripts coordinate `client` and `server`
- Frontend starts via Vite
- Client app composition is split across `client/src/App.tsx` and `client/src/app/`
- Backend starts from `server/src/index.ts`, with route groups under `server/src/routes/`

### 2. Authentication flow
- UI initiates auth from the client
- server auth routes live under `server/src/routes/`
- auth/session logic lives around `authStore.ts` and `server/src/routes/sessionAuthRoutes.ts`
- email delivery logic lives in `email.ts`
- Google and passkey login create the same normal app session as email-code login
- Passkey/WebAuthn browser work lives in `client/src/auth/passkeys.ts` and API calls in `client/src/api/passkeys.ts`
- Passkey credentials and short-lived single-use challenges are persisted via `server/src/db.ts` and `server/src/db/passkeys.ts`
- Passkey RP config uses `PASSKEY_RP_ID` for the visible frontend hostname and `PASSKEY_ORIGIN` for the full visible frontend origin
- auth test mode exists and should remain usable

### 3. Profile / onboarding flow
- screen-level flow lives under `client/src/screens/`
- app-level profile/session orchestration lives under `client/src/app/`
- API integration should live in `client/src/api/`
- persisted server-side behavior likely touches DB-backed modules and `server/src/routes/profile*Routes.ts`

### 4. Capsule / wardrobe flow
- server-side domain state likely centers on `capsuleStore.ts`
- capsule read/mutation HTTP behavior lives under `server/src/routes/capsule*Routes.ts`
- client capsule state/actions live under `client/src/app/` and `client/src/screens/mainScreen/`
- AI-related generation or enrichment behavior lives under `server/src/ai/`

### 5. Search / statistics flow
- search UI state and filters live under `client/src/search/`
- search screen composition lives under `client/src/screens/searchScreen/`
- statistics screen composition lives under `client/src/screens/statisticsScreen/`
- search API routes live in `server/src/routes/searchRoutes.ts`
- search persistence is split across `searchStore.ts`, `searchTypes.ts`, and `server/src/db/search*`

### 6. Localization flow
- locale resources and helpers live under `client/src/i18n/`
- shared locale option resources live under `shared/i18n/`
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
- `client/src/App.tsx`
- `client/src/app/` — app shell, route content, state/actions, session bootstrap, navigation, and dialogs
- `client/src/main.tsx`
- `client/src/theme.ts`
- `client/src/auth/passkeys.ts`

### Client feature areas
- `client/src/api/`
- `client/src/components/`
- `client/src/screens/`
- `client/src/screens/mainScreen/`
- `client/src/screens/searchScreen/`
- `client/src/screens/statisticsScreen/`
- `client/src/search/`
- `client/src/i18n/`
- `client/src/utils/`

### Server
- `server/package.json`
- `server/tsconfig.json`
- `server/tsconfig.build.json`
- `server/tsconfig.test.json`
- `server/tsconfig.src.json`
- `server/src/index.ts`
- `server/src/db.ts` — database integration, including passkey credential and challenge persistence
- `server/src/db/` — split DB modules for auth, schema, passkeys, profiles, capsule data, search, and product options
- `server/src/routes/` — grouped Express route modules for auth/session, passkeys, profile, capsule, search, health, and images
- `server/src/email.ts`
- `server/src/authStore.ts`
- `server/src/capsuleStore.ts`
- `server/src/capsuleStoreModel.ts`
- `server/src/profileStore.ts`
- `server/src/profileHttp.ts`
- `server/src/searchStore.ts`
- `server/src/searchTypes.ts`
- `server/src/searchValidation.ts`
- `server/src/serverUrlSecurity.ts`
- `server/src/wardrobePdf*.ts`
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
- `shared/stylePreferences.test.ts`
- `shared/i18n/helpers.test.ts`
- `shared/i18n/localeParity.test.ts`

## Quality commands
- `npm run lint` — ESLint across the repository
- `npm run lint:strict` — ESLint across the repository with zero warnings allowed
- `npm run coverage` — coverage for client, server, and shared tests
- `npm run coverage:client` — client coverage via Vitest
- `npm run coverage:server` — server coverage via Vitest
- `npm run coverage:shared` — shared coverage via Vitest
- `npm run quality:deps` — dependency boundary checks
- `npm run quality:large-files` — list largest source files
- `npm run quality:large-files:strict` — fail on files over configured size thresholds
- `npm run quality:gate` — strict lint, typecheck, tests, dependency checks, large-file strict check, and coverage

## Invariants
- The repo is a two-workspace monorepo: `client` and `server`
- Shared TypeScript modules live in root `shared/` and are validated from root scripts
- Root scripts are the canonical entrypoint for cross-workspace work
- Localization parity matters
- Auth test mode matters
- Passkey challenges are single-use and stored separately from normal app sessions
- Passkey API responses must never expose stored credential public keys
- DB/env wiring should remain explicit and stable
- Render deployment path is a first-class deployment concern

## Safe edit strategy
1. Identify the owning workspace
2. Identify the owning module
3. Inspect closest tests
4. Make the smallest viable change
5. Run the narrowest relevant tests
6. Check coverage for the changed area, or run `npm run coverage` for cross-cutting changes
7. Prefer `npm run typecheck` or workspace `typecheck` when changing TS types or module boundaries
8. At the end, after tests, coverage, and typecheck, run ESLint on the changed source files with zero warnings, for example `npx eslint --max-warnings=0 <changed files>`
