# Repo Map

## Purpose
Capsule Wardrobe App is a full-stack prototype for passwordless sign-in, passkeys, onboarding, profile and account removal flows, localization, saved wardrobe/capsule/outfit workflows, AI-assisted generation, image upload/storage, product search, statistics, and a read-only MCP connector for external assistant access. The public API contract uses the final camelCase shape; the temporary naming-convention migration has been removed.

## Main runtime flows

### 1. App startup
- Root workspace scripts coordinate `client` and `server`
- Frontend starts via Vite
- Client app composition is split across `client/src/App.tsx` and `client/src/app/`
- Client MUI theme creation, design tokens, CSS variables, palette mapping, typography, and component overrides live under `client/src/theme/`
- User theme settings resolve through `client/src/app/appViewState.ts` and `client/src/app/useAppControllerModel.ts`, then `client/src/app/AppRootView.tsx` applies the generated MUI theme through `ThemeProvider` and `CssBaseline`
- Backend app wiring starts from `server/src/index.ts`, with route groups under `server/src/routes/`
- Runtime config, security middleware, and static serving are split across `server/src/appConfig.ts`, `server/src/appMiddleware.ts`, and `server/src/serverStartup.ts`
- MCP connector and OAuth routes are registered from `server/src/mcp/`
- Development startup mounts Vite middleware from Express; production startup serves `client/dist` and injects shared-capsule metadata into HTML
- Playwright e2e tests start a dedicated Express/Vite server from `server/src/e2e/server.ts`

### 2. Authentication flow
- UI initiates auth from the client
- server auth routes live under `server/src/routes/`
- auth/session logic lives around `authStore.ts` and `server/src/routes/sessionAuthRoutes.ts`
- email delivery logic lives in `email.ts`
- Google and passkey login create the same normal app session as email-code login
- session and CSRF cookies are handled in `server/src/httpCookies.ts`, while trusted-origin and CSRF guards live in `server/src/appMiddleware.ts`
- client state-changing requests should go through `client/src/api/request.ts` so the `X-CSRF-Token` header is populated from the CSRF cookie
- Passkey/WebAuthn browser work lives in `client/src/auth/passkeys.ts` and API calls in `client/src/api/passkeys.ts`
- Passkey credentials and short-lived single-use challenges are persisted via `server/src/db.ts` and `server/src/db/passkeys.ts`
- Passkey display helpers live in `server/src/passkeyHttp.ts` and `server/src/passkeyNames.ts`; deletion is registered from `server/src/routes/passkeyDeleteRoute.ts`
- Passkey RP config uses `PASSKEY_RP_ID` for the visible frontend hostname and `PASSKEY_ORIGIN` for the full visible frontend origin
- MCP OAuth consent reuses the normal app session; unauthenticated authorization requests redirect through the client `oauthReturnTo` bridge and resume only same-origin `/oauth/authorize` paths
- auth test mode exists and should remain usable

### 3. Profile / onboarding flow
- screen-level flow lives under `client/src/screens/`
- app-level profile/session orchestration lives under `client/src/app/`
- API integration should live in `client/src/api/`
- persisted server-side behavior likely touches DB-backed modules and `server/src/routes/profile*Routes.ts`
- settings and account removal UI live in `client/src/components/SettingsDialog*` and `client/src/components/SettingsRemoveAccount*`
- `DELETE /profile/me` removes profile-scoped data, clears transient jobs, deletes MCP OAuth refresh tokens, grants, and unconsumed authorization codes, deletes uploaded wardrobe image objects from R2 when configured, and clears session/passkey challenge cookies

### 4. Capsule / outfit flow
- server-side domain state likely centers on `capsuleStore.ts`
- capsule storage helpers are split across `capsuleStoreContext.ts`, `capsuleStoreDelete.ts`, `capsuleStoreNaming.ts`, and `capsuleStoreSharing.ts`
- capsule read/mutation HTTP behavior lives under `server/src/routes/capsule*Routes.ts`
- client capsule state/actions live under `client/src/app/` and `client/src/screens/mainScreen/`
- saved outfit state centers on `server/src/outfitStore.ts`, `server/src/outfitHttp.ts`, `server/src/routes/outfitRoutes.ts`, and DB helpers under `server/src/db/profileOutfits.ts`
- client outfit routing, state, sidebar actions, and API calls live under `client/src/app/`, `client/src/screens/outfitScreen/`, and `client/src/api/outfits.ts`
- outfit URLs use `/outfit` and `/outfit/:id` in the client, while backend CRUD/save/revert/search/PDF endpoints live under `/outfits/*`
- outfit PDF export reuses the wardrobe PDF pipeline
- AI-related generation, regeneration, event streaming, and outfit-set image behavior lives under `server/src/ai/`; SSE route helpers live in `server/src/capsuleEventHttp.ts`
- public sharing and import behavior is exposed through `/shared-capsules/*` and implemented in the capsule read/store modules
- shared-capsule OG metadata helpers live in `server/src/sharedCapsuleMeta.ts`

### 5. Personal items flow
- client Personal items screen composition lives in `client/src/screens/WardrobeScreen.tsx` and related `Wardrobe*` files
- Personal items API calls live in `client/src/api/personalItems.ts`
- liked-item API calls live in `client/src/api/likedItems.ts`
- uploaded/catalog item actions are orchestrated through `client/src/app/wardrobeActions.ts`, `client/src/app/wardrobeItemActions.ts`, `client/src/app/wardrobeImageActions.ts`, `client/src/app/likedItemActions.ts`, and related wardrobe action modules
- server HTTP behavior lives in `server/src/routes/wardrobeRoutes.ts`, `server/src/routes/wardrobeFileUploadRoute.ts`, `server/src/routes/wardrobeUrlUploadRoute.ts`, `server/src/routes/wardrobeUploadStream.ts`, and `server/src/routes/wardrobeUploadedItemUpdateRoute.ts`
- upload normalization, image URL import, image analysis, embeddings, metadata updates, cleanup, PDF export, and child-process helpers live in root `server/src/wardrobe*.ts` modules
- uploaded/generated image persistence uses `server/src/r2Storage.ts` and `server/src/r2Delete.ts` when R2 is configured
- uploaded wardrobe item API payloads and fixtures use camelCase image fields

### 6. Search / statistics flow
- search UI state and filters live under `client/src/search/`
- search screen composition lives under `client/src/screens/searchScreen/`
- statistics screen composition lives under `client/src/screens/statisticsScreen/`
- product detail dialogs live under `client/src/components/productDetail/`
- chart wrappers live under `client/src/components/tremor/`
- liked-item state is shared across product search, capsule, outfit, and Personal items views through `client/src/api/likedItems.ts` and `server/src/routes/likedItemsRoutes.ts`
- search API routes live in `server/src/routes/searchRoutes.ts`
- search persistence is split across `searchStore.ts`, `searchTypes.ts`, and `server/src/db/search*`
- semantic search helpers live in `server/src/searchSemantic.ts`

### 7. MCP connector flow
- `/mcp` is a Streamable HTTP MCP endpoint implemented in `server/src/mcp/mcpRoutes.ts`
- MCP access requires a bearer access token validated by `server/src/mcp/mcpAuth.ts`; token issuer, audience, expiry, token use, and supported read scopes must match the `MCP_*` config
- OAuth discovery, dynamic client registration, PKCE authorization, consent HTML, access tokens, refresh tokens, and refresh-token rotation live in `server/src/mcp/oauthRoutes.ts`
- MCP OAuth config is built by `server/src/mcp/oauthConfig.ts` from `server/src/appConfig.ts`; it is enabled by default outside production and disabled by default in production
- MCP OAuth state persists through `server/src/db/mcpOAuth.ts`, `server/src/db/mcpOAuthRefreshTokens.ts`, and SQL schema assets `080` through `087` under `server/src/db/sql/schema/`
- MCP product tools live in `server/src/mcp/productTools.ts`, `server/src/mcp/productStatsTool.ts`, `server/src/mcp/productSearch.ts`, `server/src/mcp/productSearchSchemaOptions.ts`, `server/src/mcp/productRenderTools.ts`, `server/src/mcp/productToolCards.ts`, `server/src/mcp/productToolOutput.ts`, and `server/src/mcp/productToolSchemas.ts`
- MCP widget resources live in `server/src/mcp/productGridWidget.ts` and `server/src/mcp/productGridWidgetDefinitions.ts`
- MCP wardrobe tools live in `server/src/mcp/wardrobeTools.ts` and `server/src/mcp/wardrobeToolSchemas.ts`
- Exposed tools are read-only: `ping`, `get_search_options`, `search`, `render_product_grid`, `stats`, `fetch`, `render_product_detail`, `wardrobe_items`, and `render_wardrobe_grid`
- Product and wardrobe MCP results are sanitized before returning to clients; internal embeddings, ownership fields, and private timestamps should stay out of tool output
- The client sign-in success path calls `client/src/app/oauthReturn.ts` to resume safe same-origin OAuth authorization requests after normal email, Google, or passkey login

### 8. Localization flow
- locale resources and helpers live under `client/src/i18n/`
- shared locale option resources live under `shared/i18n/`
- changes to user-facing copy should preserve EN/RU parity

### 9. Playwright e2e flow
- root Playwright config lives in `playwright.config.ts`
- browser tests live under `tests/e2e/`
- authenticated tests reuse `tests/e2e/.auth/user.json`
- the e2e server uses in-memory dependencies for auth, profile, capsule, outfit, search, wardrobe, generation, images, and embeddings
- e2e control routes under `/__e2e/*` are mounted only by the dedicated e2e server
- e2e auth control routes set the same session and CSRF cookies expected by normal authenticated routes
- browser-side request guards block unexpected non-local origins by default

## Important files

### Root
- `package.json` — workspace definitions and top-level dev/test commands
- `playwright.config.ts` — browser e2e projects, web server command, and auth setup wiring
- `README.md` — setup, env vars, deployment notes
- `scripts/` — utility scripts for screenshots and repository quality checks
- `shared/` — TypeScript shared domain models, helpers, and cross-workspace tests
- `tests/e2e/` — Playwright fixtures, auth setup, and browser smoke tests

### Client
- `client/package.json`
- `client/tsconfig.json`
- `client/vite.config.ts`
- `client/render-server.js`
- `client/src/App.tsx`
- `client/src/app/` — app shell, route content, state/actions, session bootstrap, navigation, and dialogs
- `client/src/api/request.ts` — shared fetch wrapper, JSON/error handling, short-lived GET cache, and CSRF header injection
- `client/src/api/outfits.ts` — saved outfit API calls
- `client/src/api/likedItems.ts` — product like/unlike API calls
- `client/src/main.tsx`
- `client/src/app/oauthReturn.ts` — safe OAuth authorization return bridge used by MCP connector login handoff
- `client/src/theme/` — centralized MUI theme factory, palette and radius tokens, CSS variables, component overrides, and typography
- `client/src/auth/passkeys.ts`
- `client/src/test/` — client-side test helpers

### Client feature areas
- `client/src/api/`
- `client/src/components/`
- `client/src/components/productDetail/`
- `client/src/components/tremor/`
- `client/src/screens/`
- `client/src/screens/mainScreen/`
- `client/src/screens/outfitScreen/`
- `client/src/screens/searchScreen/`
- `client/src/screens/statisticsScreen/`
- `client/src/search/`
- `client/src/i18n/`
- `client/src/theme/`
- `client/src/utils/`

### Server
- `server/package.json`
- `server/tsconfig.json`
- `server/tsconfig.build.json`
- `server/tsconfig.test.json`
- `server/tsconfig.src.json`
- `server/src/index.ts`
- `server/src/appConfig.ts` — env-backed runtime constants and client dist/root resolution
- `server/src/appMiddleware.ts` — Helmet/CSP, CORS, rate limiters, trusted-origin guard, auth guard, and CSRF guard
- `server/src/serverStartup.ts` — DB bootstrap, dev Vite middleware, production static serving, and shared-capsule HTML metadata injection
- `server/src/e2e/` — isolated e2e server, in-memory dependencies, fixtures, and test-control routes
- `server/src/test/` — server-side test helpers
- `server/src/db.ts` — database integration, including passkey credential and challenge persistence
- `server/src/db/` — split DB modules for auth, schema bootstrap wiring, passkeys, profiles, capsule data, wardrobe, search, product options, and MCP OAuth persistence
- `server/src/db/sql/` — canonical SQL assets used by DB schema bootstrap; one schema SQL file should contain one executable statement
- `server/src/httpCookies.ts` — session, CSRF, and passkey challenge cookie helpers
- `server/src/logger.ts` — test-aware server logging helpers
- `server/src/routes/` — grouped Express route modules for auth/session, passkeys, profile, capsule, wardrobe, search, health, and images
- `server/src/mcp/` — Streamable HTTP MCP server, bearer auth, OAuth discovery/PKCE/token routes, product tools, wardrobe tools, and MCP tool schemas
- `server/src/db/mcpOAuth.ts` and `server/src/db/mcpOAuthRefreshTokens.ts` — MCP authorization code, grant, dynamic client registration, and refresh-token persistence
- `server/src/email.ts`
- `server/src/authStore.ts`
- `server/src/likedItemsHttp.ts`
- `server/src/capsuleStore.ts`
- `server/src/capsuleStoreContext.ts`, `server/src/capsuleStoreDelete.ts`, `server/src/capsuleStoreNaming.ts`, and `server/src/capsuleStoreSharing.ts`
- `server/src/capsuleStoreModel.ts`
- `server/src/capsuleEventHttp.ts`
- `server/src/outfitStore.ts`
- `server/src/outfitStoreModel.ts`
- `server/src/outfitStoreNaming.ts`
- `server/src/outfitHttp.ts`
- `server/src/profileStore.ts`
- `server/src/profileHttp.ts`
- `server/src/passkeyHttp.ts`
- `server/src/passkeyNames.ts`
- `server/src/searchStore.ts`
- `server/src/searchSemantic.ts`
- `server/src/searchTypes.ts`
- `server/src/searchValidation.ts`
- `server/src/serverUrlSecurity.ts`
- `server/src/sharedCapsuleMeta.ts`
- `server/src/r2Storage.ts`
- `server/src/r2Delete.ts`
- `server/src/wardrobeItemDisplay.ts`
- `server/src/wardrobeImageAnalysis.ts`
- `server/src/wardrobeImageCleanup.ts`
- `server/src/wardrobeImageUrlImport.ts`
- `server/src/wardrobeSemanticEmbedding.ts`
- `server/src/wardrobeUploadImages*.ts`
- `server/src/wardrobeUploadProcessing*.ts`
- `server/src/wardrobeUploadedItemUpdate.ts`
- `server/src/wardrobePdf*.ts`
- `server/src/ai/`
- `server/src/ai/sql/` — canonical SQL assets used by AI wardrobe selection queries
- `server/src/templates/`

## Test map

### Client tests
- `client/src/**/*.test.*`
- `client/src/**/*.e2e.test.*`
- `client/src/main.test.tsx` includes the theme export and CSS-variable contract smoke test

### Server tests
- `server/src/*.test.ts`
- `server/src/**/*.test.ts`
- `server/src/routes/outfitRoutes.test.ts` covers saved outfit CRUD, save/revert, search, delete, and PDF behavior
- `server/src/mcp/oauthRoutes.test.ts`, `server/src/mcp/oauthConfig.test.ts`, and `server/src/mcp/productSearch.test.ts` cover MCP OAuth discovery/token behavior, read-only tool metadata/output, and product search semantics
- `server/src/mcp/productRenderTools.test.ts`, `server/src/mcp/productToolCards.test.ts`, and `server/src/mcp/productToolOutput.test.ts` cover MCP render helpers and sanitized product output
- `server/src/db/mcpOAuth.test.ts` covers MCP OAuth persistence helpers

### Shared tests
Run from root:
- `shared/wardrobeOrder.test.ts`
- `shared/accentColors.test.ts`
- `shared/capsuleCategories.test.ts`
- `shared/capsuleShareItems.test.ts`
- `shared/colorSwatches.test.ts`
- `shared/patternOptions.test.ts`
- `shared/productDetail.test.ts`
- `shared/profileSettings.test.ts`
- `shared/stylePreferences.test.ts`
- `shared/urlSecurity.test.ts`
- `shared/wardrobeMerge.test.ts`
- `shared/i18n/helpers.test.ts`
- `shared/i18n/localeParity.test.ts`

### Playwright tests
Run from root:
- `tests/e2e/*.spec.ts`
- `tests/e2e/auth.setup.ts`

The Playwright auth state is generated at `tests/e2e/.auth/user.json` and is intentionally ignored by git.

## Quality commands
- `npm run lint` — ESLint across the repository
- `npm run lint:strict` — ESLint across the repository with zero warnings allowed
- `npm run format` — Prettier write pass for client, server, and shared source files
- `npm run format:check` — Prettier check for client, server, and shared source files
- `npm run playwright:install` — install Playwright browser binaries
- `npm run test:e2e` — run Playwright browser tests against the isolated e2e server
- `npm run coverage` — coverage for client, server, and shared tests
- `npm run coverage:client` — client coverage via Vitest
- `npm run coverage:server` — server coverage via Vitest
- `npm run coverage:shared` — shared coverage via Vitest
- `npm run quality:deps` — dependency boundary checks
- `npm run quality:cycles` — circular dependency checks
- `npm run quality:unused` — unused file/dependency/export checks
- `npm run quality:large-files` — list largest source files
- `npm run quality:large-files:strict` — fail on files over configured size thresholds
- `npm run quality:gate` — strict lint, typecheck, tests, dependency checks, large-file strict check, and coverage
- `npm run quality` — full quality gate plus the large-file report
- `npm run security:audit` — npm audit with high severity threshold
- `npm run screenshots` — capture desktop and mobile screenshots against the isolated e2e server

## Invariants
- The repo is a two-workspace monorepo: `client` and `server`
- Shared TypeScript modules live in root `shared/` and are validated from root scripts
- Root scripts are the canonical entrypoint for cross-workspace work
- Saved capsule and outfit workflows are separate backend surfaces and share item/PDF hydration helpers where appropriate
- Localization parity matters
- Auth test mode matters
- State-changing authenticated routes should preserve trusted-origin and CSRF protections
- Public API payloads, client state, and e2e fixtures use the final camelCase contract
- Playwright e2e mode must stay isolated from normal dev, production, and Render startup paths
- Default e2e runs should not require a real database, email provider, LLM provider, embedding provider, or remote image host
- Passkey challenges are single-use and stored separately from normal app sessions
- Passkey API responses must never expose stored credential public keys
- MCP connector access is read-only and must require valid bearer tokens with `mcp:read`, matching issuer/audience, unexpired access-token claims, and supported read scopes
- MCP OAuth production enablement must keep explicit issuer, resource URL, JWT secret, and redirect allowlist configuration
- MCP OAuth authorization codes and refresh tokens are hashed before persistence and must remain single-use
- Account removal must clear profile-scoped DB records, active sessions, MCP OAuth refresh tokens/grants/unconsumed authorization codes, transient generation/image/PDF jobs, passkey challenge cookies, and uploaded image objects from R2 when configured
- Uploaded wardrobe item API responses must not expose private owner, embedding, or internal timestamp fields
- DB/env wiring should remain explicit and stable
- DB schema bootstrap uses SQL assets under `server/src/db/sql/`; there is no active standalone naming-convention migration script
- Render deployment path is a first-class deployment concern

## Safe edit strategy
1. Identify the owning workspace
2. Identify the owning module
3. Inspect closest tests
4. Make the smallest viable change
5. Run the narrowest relevant tests
6. Check coverage for the changed area, or run `npm run coverage` for cross-cutting changes
7. Prefer `npm run typecheck` or workspace `typecheck` when changing TS types or module boundaries
8. At the end of the work, after the final file edits, run `npm run format`.
9. If `npm run format` changes files, include those formatter changes in the diff
10. At the end, after tests, coverage, typecheck, and format, run `npm run lint:strict`
11. In the final response after changing files, recommend a clear git commit message for the change
