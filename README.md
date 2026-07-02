# Capsule Wardrobe App

Full-stack TypeScript monorepo for a capsule wardrobe application. The project combines passwordless auth, passkeys, profile onboarding and account removal, AI-assisted wardrobe generation, saved capsules and outfits, Personal items uploads, product search, and statistics.

## Stack

- Frontend: React, Vite, MUI, Tailwind CSS, Recharts, Vitest, Playwright
- Backend: Node.js, Express, TypeScript
- Shared domain layer: root `shared/`
- Persistence: Postgres
- Email auth delivery: Resend
- Optional auth providers: Google Sign-In and passkeys/WebAuthn
- Optional external assistant access: read-only MCP connector over Streamable HTTP with OAuth PKCE
- Generated and uploaded image storage: Cloudflare R2 when configured
- Browser e2e: Playwright against a dedicated Express/Vite server with in-memory dependencies
- Deployment path: Render single-service

## What the app does

- passwordless email sign-in with verification codes
- optional Google sign-in and passkey registration/sign-in
- onboarding, profile settings, and account removal with EN/RU localization
- capsule and outfit creation, duplication, rename, save/revert, PDF export, and delete
- AI-assisted wardrobe generation, wardrobe/catalog source modes, and selective regeneration
- outfit-set image generation
- Personal items file and URL uploads, uploaded item metadata editing, catalog saves, liked items, AI report generation, and wardrobe PDF export
- shareable capsule links and shared capsule import
- product search and aggregated statistics views
- read-only MCP tools for authenticated product search, product stats, product fetch, wardrobe item reads, and visual render helpers

## Repository layout

```text
client/   React frontend
server/   Express API and server workflows
shared/   shared TypeScript models, helpers, and tests
tests/    Playwright browser tests
docs/     repository documentation
```

Useful entrypoints:

- `client/src/App.tsx`
- `client/src/api/outfits.ts`
- `client/src/api/likedItems.ts`
- `client/src/app/oauthReturn.ts`
- `client/src/api/request.ts`
- `client/src/main.tsx`
- `client/src/screens/WardrobeScreen.tsx`
- `client/vite.config.ts`
- `playwright.config.ts`
- `server/src/index.ts`
- `server/src/appFactory.ts`
- `server/src/appDependencies.ts`
- `server/src/appRouteContext.ts`
- `server/src/appRoutes.ts`
- `server/src/appConfig.ts`
- `server/src/appMiddleware.ts`
- `server/src/serverStartup.ts`
- `server/src/e2e/server.ts`
- `server/src/db.ts`
- `server/src/db/sql/`
- `server/src/mcp/`
- `server/src/ai/`
- `server/src/authStore.ts`
- `server/src/capsuleStore.ts`
- `server/src/outfitStore.ts`
- `server/src/profileStore.ts`
- `server/src/searchStore.ts`
- `server/src/r2Storage.ts`
- `server/src/routes/personalItemsReportRoutes.ts`
- `server/src/wardrobeUploadImagesRunner.ts`
- `server/src/wardrobeUploadProcessingRunner.ts`
- `server/src/routes/`

## Requirements

- Node.js 24.x LTS
- npm

## Setup

Install dependencies:

```bash
npm install
```

Install Playwright browsers before the first e2e run:

```bash
npm run playwright:install
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
- `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BASE_URL` — Cloudflare R2 storage for generated and uploaded wardrobe images; `R2_PUBLIC_BASE_URL` must be a public bucket URL or custom domain
- `R2_IMAGE_KEY_PREFIX` — optional R2 object key prefix, defaults to `outfit-set-images`
- `PORT` — defaults to `3000`
- `CLIENT_ORIGIN` — defaults to `http://localhost:5173`
- `NODE_ENV` — defaults to `development`
- `AUTH_TEST_MODE` — prints sign-in codes to logs outside production
- `PASSKEY_RP_NAME` — optional WebAuthn relying party display name, defaults to `Capsule Wardrobe`
- `MCP_OAUTH_ENABLED` — enables the MCP connector OAuth surface; defaults to enabled outside production and disabled in production
- `MCP_OAUTH_ISSUER`, `MCP_RESOURCE_URL`, `MCP_JWT_SECRET`, and at least one redirect allowlist entry — required when MCP OAuth is enabled in production
- `MCP_ALLOWED_REDIRECT_URIS`, `MCP_ALLOWED_REDIRECT_ORIGINS` — allowed OAuth redirect destinations for MCP clients such as ChatGPT or Codex
- `MCP_ALLOWED_CLIENT_IDS`, `MCP_ALLOWED_CLIENT_METADATA_HOSTS` — optional MCP client allowlists; dynamic client registration is supported and production still requires redirect allowlists
- `MCP_ACCESS_TOKEN_TTL_SECONDS`, `MCP_AUTH_CODE_TTL_SECONDS`, `MCP_REFRESH_TOKEN_TTL_SECONDS` — optional MCP OAuth connector controls
- `VITE_THUMBNAIL_ASSET_BASE_URL` — thumbnail URL prefix also used by server-generated prompt/MCP thumbnails
- `SESSION_PRUNE_MIN_INTERVAL_MS` — session cleanup throttle
- `WARDROBE_PDF_CHILD_TIMEOUT_MS` — PDF child-process timeout
- `WARDROBE_UPLOAD_CHILD_TIMEOUT_MS` — uploaded wardrobe image normalization child-process timeout
- `WARDROBE_UPLOAD_PROCESSING_CHILD_TIMEOUT_MS`, `WARDROBE_UPLOAD_PROCESSING_CHILD_KILL_GRACE_MS` — uploaded wardrobe metadata/image processing child-process controls
- `SHARP_CONCURRENCY`, `IMAGE_DOWNLOAD_CONCURRENCY`, `IMAGE_WORK_MAX_CONCURRENCY`, `IMAGE_WORK_MAX_PENDING`, `PROMPT_IMAGES_CHILD_TIMEOUT_MS`, `PROMPT_CATEGORY_DOWNLOAD_CONCURRENCY`, `PROMPT_CATEGORY_SHARP_CONCURRENCY`, `PROMPT_IMAGE_REQUEST_WIDTH`, `MAX_SOURCE_IMAGE_PIXELS`, `STORAGE_IMAGES_DIR` — optional tuning knobs for image and prompt-image work

See [server/.env.example](server/.env.example) for the baseline template.

### Client env

- `VITE_API_BASE_URL` — defaults to `/api`
- `VITE_THUMBNAIL_ASSET_BASE_URL` — thumbnail URL prefix, defaults to `https://assets.capsule-wardrobe.org/thumbnails`
- `VITE_GOOGLE_CLIENT_ID` — Google Sign-In client ID for the frontend
- `BFF_UPSTREAM_ORIGIN` — upstream backend origin for proxy-based deployments

See [client/.env.example](client/.env.example).

### Tooling env

- `E2E_PORT` — Playwright e2e server port, defaults to `5310`
- `CI` — enables Playwright retries and CI reporter behavior
- `SCREENSHOT_PORT`, `SCREENSHOT_HMR_PORT`, `SCREENSHOT_IMAGE_URL` — screenshot capture helper overrides
- `CODE_QUALITY_MAX_LINES` — large-file strict gate threshold, defaults to `500`

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

Workspace-only helpers:

```bash
npm --workspace server run dev:e2e
npm --workspace client run preview
npm --workspace client run start:render
```

### Playwright e2e server

Playwright starts an isolated Express/Vite server automatically when you run e2e tests:

```bash
npm run test:e2e
```

That server uses in-memory auth, profile, capsule, outfit, search, wardrobe, generation, image, and embedding dependencies. It does not require `DATABASE_URL` or provider API keys and mounts e2e-only control routes such as `POST /__e2e/reset` and `POST /__e2e/login`. E2E login sets the same session and CSRF cookies that normal authenticated routes expect.

### Local URLs

- frontend: `http://localhost:5173`
- backend: `http://localhost:3000`

The app root redirects to `/personal-items` while preserving query parameters such as OAuth return state.

In local development, Vite proxies `/api` to the Express server and strips that prefix, so frontend calls to `/api/auth`, `/api/profile`, `/api/capsules`, `/api/outfits`, `/api/shared-capsules`, `/api/search`, `/api/wardrobe`, and `/api/liked-items` reach the matching backend route groups. Direct `/auth`, `/profile`, `/wardrobe/filters`, `/wardrobe/items`, and `/health` proxy entries are also present for compatibility.

## Build, start, validation

Build everything:

```bash
npm run build
```

Start the production server:

```bash
npm run start
```

Render start helpers:

```bash
npm run start:render
npm run start:client:render
```

Type-check:

```bash
npm run typecheck
npm run typecheck:client
npm run typecheck:server
npm run typecheck:shared
```

Run tests:

```bash
npm test
npm run test:client
npm run test:server
npm run test:shared
npm run test:e2e
```

Playwright helpers:

```bash
npm run test:e2e:headed
npm run test:e2e:ui
npm run test:e2e:debug
```

Check coverage:

```bash
npm run coverage
npm run coverage:client
npm run coverage:server
npm run coverage:shared
```

Quality checks:

```bash
npm run lint
npm run lint:strict
npm run format
npm run format:check
npm run lint:fix
npm run quality:deps
npm run quality:unused
npm run quality:large-files
npm run quality:large-files:strict
npm run quality:gate
npm run quality
npm run security:audit
npm run screenshots
```

After editing files, verify that relevant tests pass, coverage remains acceptable, and ESLint has zero warnings for the changed source files. For cross-cutting changes, prefer `npm run quality:gate`.

## Health checks

Backend health endpoint:

```bash
curl http://localhost:3000/health
```

There is also `GET /healthall` for a broader backend health check.

## API surface summary

Main backend route groups:

- `/auth/*` — email auth, Google auth, logout, current session
- `/auth/passkeys/*` — passkey list, register, authenticate, and delete flows
- `/profile/*` — onboarding, profile data, locale, and account removal
- `/capsules/*` — bootstrap, recent, search, CRUD, save/revert, regenerate, share, import support, PDF, SSE events, outfit-set image jobs
- `/outfits/*` — bootstrap, recent, search, CRUD, save/revert, duplicate, select, report SSE, image jobs/events, and PDF export for saved outfit sets
- `/shared-capsules/*` — public shared capsule read and authenticated import
- `/liked-items` — authenticated product like/unlike mutations
- `/search/*` — search options, saved filters, run search, product-detail lookup, and stats
- `/wardrobe/*` — profile-derived filters, Personal items uploaded/catalog items, file and URL upload event streams, AI report generation at `/wardrobe/items/report`, item metadata updates, and wardrobe PDF export
- `/mcp` — authenticated Streamable HTTP MCP endpoint with read-only tools: `ping`, `get_search_options`, `search`, `render_product_grid`, `stats`, `fetch`, `render_product_detail`, `wardrobe_items`, and `render_wardrobe_grid`
- `/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server`, `/.well-known/openid-configuration`, `/oauth/register`, `/oauth/authorize`, `/oauth/token` — MCP OAuth discovery, dynamic client registration, PKCE consent, token exchange, and refresh-token rotation
- `/health`, `/healthall`

The API uses camelCase request and response fields at the client/server boundary. State-changing authenticated routes expect trusted-origin checks and a CSRF token; `client/src/api/request.ts` adds `X-CSRF-Token` from the CSRF cookie.

The e2e server also mounts `/__e2e/*` test-control and fixture endpoints. Those endpoints are only available when the dedicated e2e server entrypoint is used.

The app is created by [server/src/appFactory.ts](server/src/appFactory.ts), with route registration in [server/src/appRoutes.ts](server/src/appRoutes.ts) and startup in [server/src/index.ts](server/src/index.ts).

## MCP connector

The optional MCP connector is implemented entirely on the server in [server/src/mcp](server/src/mcp). When `MCP_OAUTH_ENABLED=true`, `/mcp` requires bearer tokens issued by the local OAuth PKCE flow and validates issuer, audience, expiry, token use, mandatory `mcp:read` transport access, and supported read scopes. Product catalog tools require `catalog:read`; personal item tools require `personal-items:read`.

MCP consent reuses the normal app session. If an external client starts authorization before the user is signed in, the server redirects to `/?oauthReturnTo=...`; after email, Google, or passkey sign-in, [client/src/app/oauthReturn.ts](client/src/app/oauthReturn.ts) resumes only safe same-origin `/oauth/authorize` paths.

MCP OAuth state is persisted in Postgres through `mcp_oauth_authorization_codes`, `mcp_oauth_grants`, `mcp_oauth_registered_clients`, and `mcp_oauth_refresh_tokens`. Authorization codes and refresh tokens are hashed before storage and consumed once.

## Deployment

### Render single-service deploy

This repo supports a single Render web service that builds the client and serves it from the Express backend.

- build command: `npm install --include=dev && npm run build`
- start command: `npm run start`
- health check path: `/health`

Related files:

- [render.yaml](render.yaml)
- [server/src/index.ts](server/src/index.ts)
- [server/src/serverStartup.ts](server/src/serverStartup.ts)
- [server/src/appMiddleware.ts](server/src/appMiddleware.ts)

Minimum env for this path:

- `NODE_VERSION=24.18.0`
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
- `MCP_OAUTH_ENABLED=true`, `MCP_OAUTH_ISSUER=https://<your-service>.onrender.com`, `MCP_RESOURCE_URL=https://<your-service>.onrender.com/mcp`, `MCP_JWT_SECRET`, and `MCP_ALLOWED_REDIRECT_URIS` or `MCP_ALLOWED_REDIRECT_ORIGINS` when enabling the MCP connector OAuth surface
- AI provider keys you actually use

### Render client-only proxy server

There is also a small Express server for serving the built client with `/api` proxying:

- [client/render-server.js](client/render-server.js)

This path requires:

- `PORT`
- `BFF_UPSTREAM_ORIGIN`

## Notes

- The server entry source is TypeScript: `server/src/index.ts`.
- Production start runs compiled output from `server/dist`.
- DB schema bootstrap uses canonical SQL assets under `server/src/db/sql/`; there is no active standalone naming-convention migration script.
- Shared business logic and locale helpers live in `shared/`.
- Auth test mode should remain non-production only.
