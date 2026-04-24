# Capsule Wardrobe App

Full-stack TypeScript monorepo for a capsule wardrobe application. The project combines passwordless auth, profile onboarding, AI-assisted wardrobe generation, saved capsules, product search, and statistics.

## Stack

- Frontend: React, Vite, MUI, Vitest
- Backend: Node.js, Express, TypeScript
- Shared domain layer: root `shared/`
- Persistence: Postgres
- Email auth delivery: Resend
- Optional auth provider: Google Sign-In
- Deployment paths: Render single-service, Netlify static client + BFF proxy

## What the app does

- passwordless email sign-in with verification codes
- optional Google sign-in
- onboarding and profile settings with EN/RU localization
- capsule creation, duplication, rename, save/revert, and delete
- AI-assisted wardrobe generation and selective regeneration
- outfit-set image generation and PDF export
- product search and aggregated statistics views

## Repository layout

```text
client/   React frontend
server/   Express API and server workflows
shared/   shared TypeScript models, helpers, and tests
docs/     repository documentation
```

Useful entrypoints:

- `client/src/App.tsx`
- `client/src/main.tsx`
- `client/vite.config.ts`
- `server/src/index.ts`
- `server/src/db.ts`
- `server/src/authStore.ts`
- `server/src/capsuleStore.ts`
- `server/src/profileStore.ts`
- `server/src/searchStore.ts`

## Requirements

- Node.js 18+
- npm

## Setup

Install dependencies:

```bash
npm install
```

Create env files from examples:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

## Environment variables

### Server env

Required for a normal backend setup:

- `DATABASE_URL` — Postgres connection string
- `AUTH_CODE_SECRET` — secret for verification code hashing
- `RESEND_API_KEY` — Resend API key
- `RESEND_FROM_EMAIL` — verified sender address
- `PASSKEY_RP_ID` — WebAuthn relying party hostname users see in the browser, for example `app.example.com`
- `PASSKEY_ORIGIN` — full WebAuthn browser origin, for example `https://app.example.com`

Common optional values:

- `GOOGLE_CLIENT_ID` — enables Google Sign-In verification
- `OPENAI_API_KEY` — OpenAI-backed wardrobe generation and selection flows
- `VOYAGE_API_KEY` — embeddings and prompt-related wardrobe flows
- `DEEPINFRA_API_KEY` — DeepInfra-backed generation flows
- `GEMINI_API_KEY` — Gemini-backed text and image generation flows
- `ANTHROPIC_API_KEY` — Claude-backed generation flows
- `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BASE_URL` — Cloudflare R2 storage for generated outfit set images; `R2_PUBLIC_BASE_URL` must be a public bucket URL or custom domain
- `R2_IMAGE_KEY_PREFIX` — optional R2 object key prefix, defaults to `outfit-set-images`
- `MIGRATE_CAPSULE_IMAGES_TO_R2` — optional startup migration flag for legacy base64 capsule images; set to `true` only when intentionally migrating existing data
- `PORT` — defaults to `3000`
- `CLIENT_ORIGIN` — defaults to `http://localhost:5173`
- `NODE_ENV` — defaults to `development`
- `AUTH_TEST_MODE` — prints sign-in codes to logs outside production
- `SESSION_PRUNE_MIN_INTERVAL_MS` — session cleanup throttle
- `WARDROBE_PDF_CHILD_TIMEOUT_MS` — PDF child-process timeout
- `SHARP_CONCURRENCY` and related image/prompt concurrency envs — optional tuning knobs for image work

See [server/.env.example](server/.env.example) for the baseline template.

### Client env

- `VITE_API_BASE_URL` — defaults to `/api`
- `VITE_GOOGLE_CLIENT_ID` — Google Sign-In client ID for the frontend
- `BFF_UPSTREAM_ORIGIN` — upstream backend origin for proxy-based deployments
- `BFF_STRIP_PREFIXES` — path prefixes stripped by the BFF, default `/api`

See [client/.env.example](client/.env.example).

## Local development

### Option 1: root scripts

Run both apps:

```bash
npm run dev:all
```

Or run one workspace:

```bash
npm run dev:client
npm run dev:server
```

Auth test mode:

```bash
npm run dev:server:test-auth
```

### Option 2: direct workspace scripts

Run the backend:

```bash
npm --workspace server run dev
```

Run the frontend in another terminal:

```bash
npm --workspace client run dev
```

Server auth test mode:

```bash
npm --workspace server run dev:test-auth
```

### Local URLs

- frontend: `http://localhost:5173`
- backend: `http://localhost:3000`

In local development, Vite proxies `/api`, `/auth`, `/profile`, `/wardrobe`, and `/health` to the Express server.

## Build, start, validation

Build everything:

```bash
npm run build
```

Start the production server:

```bash
npm run start
```

Type-check:

```bash
npm run typecheck
npm run client:typecheck
npm run server:typecheck
```

Run tests:

```bash
npm test
npm run test:client
npm run test:server
npm run test:shared
```

## Health checks

Backend health endpoint:

```bash
curl http://localhost:3000/health
```

There is also `GET /healthall` for a broader backend health check.

## API surface summary

Main backend route groups:

- `/auth/*` — email auth, Google auth, logout, current session
- `/profile/*` — onboarding, profile data, locale, delete profile
- `/capsules/*` — bootstrap, recent, search, CRUD, save/revert, regenerate, PDF, SSE events
- `/search/*` — search options, saved filters, run search, stats
- `/wardrobe/*` — profile-derived wardrobe filters
- `/health`, `/healthall`

The API is implemented in [server/src/index.ts](server/src/index.ts).

## Deployment

### Render single-service deploy

This repo supports a single Render web service that builds the client and serves it from the Express backend.

- build command: `npm install --include=dev && npm run build`
- start command: `npm run start`
- health check path: `/health`

Related files:

- [render.yaml](render.yaml)
- [server/src/index.ts](server/src/index.ts)

Minimum env for this path:

- `NODE_ENV=production`
- `CLIENT_ORIGIN=https://<your-service>.onrender.com` or your custom domain
- `PASSKEY_RP_ID=<your-service>.onrender.com` or your custom domain hostname
- `PASSKEY_ORIGIN=https://<your-service>.onrender.com` or your custom domain origin
- `DATABASE_URL`
- `AUTH_CODE_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

Optional:

- `GOOGLE_CLIENT_ID`
- AI provider keys you actually use

### Netlify static client + BFF proxy

The frontend can also be deployed as a static app on Netlify with API requests routed through `client/netlify/functions/bff.js`.

Related files:

- [client/netlify.toml](client/netlify.toml)
- [client/netlify/functions/bff.js](netlify/functions/bff.js)

Important env:

- `BFF_UPSTREAM_ORIGIN=https://your-backend.example.com`
- `BFF_STRIP_PREFIXES=/api`

### Render client-only proxy server

There is also a small Express server for serving the built client with `/api` proxying:

- [client/render-server.js](client/render-server.js)

This path requires:

- `PORT`
- `BFF_UPSTREAM_ORIGIN`

## Notes

- The server entry source is TypeScript: `server/src/index.ts`.
- Production start runs compiled output from `server/dist`.
- Shared business logic and locale helpers live in `shared/`.
- Auth test mode should remain non-production only.
