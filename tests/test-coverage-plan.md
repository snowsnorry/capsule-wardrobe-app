# Test Coverage Plan

## Current Coverage Snapshot

- Server baseline exists and was verified with `npm --workspace server run test`: `124/124` passing.
- Server already has meaningful `unit` and targeted `integration` coverage for capsule rules, prompt/image preparation, vector math, profile/search normalization, and PDF generation.
- Client now has `vitest` + `jsdom` test infrastructure and an updated test baseline: `68/68` passing in `npm --workspace client run test`.
- Shared modules are partially covered indirectly via server tests, but most shared behavior is not represented as a dedicated test layer.
- Highest-risk uncovered areas are `client/src/App.jsx`, `client/src/screens/SearchScreen.jsx`, `client/src/screens/MainScreen.jsx`, `client/src/screens/SignInScreen.jsx`, `client/src/screens/ProfileScreen.jsx`, and the client API layer.

## Server

- [x] `server/src/ai/categories.js` - `unit` - validate capsule composition rules by audience and season - covered by `server/src/categories.test.js`
- [x] `server/src/ai/openai.js` - `unit` - validate JSON schema generation, multimodal payload shaping, and image buffer release - covered by `server/src/openai.test.js`
- [x] `server/src/ai/promptImages.js` - `unit/integration` - validate grouping, downloading, normalization, child-process IPC, and debug artifacts - covered by `server/src/promptImages.test.js`
- [x] `server/src/ai/imagePipeline.js` - `unit` - validate serialization of image-heavy work - covered by `server/src/imagePipeline.test.js`
- [x] `server/src/ai/swimwear.js` - `unit` - validate swimwear selection and backfill rules - covered by `server/src/swimwear.test.js`
- [x] `server/src/ai/vectorMath.js` - `unit` - validate embedding normalization and rejected-vector shifting - covered by `server/src/vectorMath.test.js`
- [x] `server/src/profileStore.js` - `unit` - validate profile normalization, option lists, and rejected-reset logic - covered by `server/src/profileStore.test.js`, `server/src/profileRejected.test.js`
- [x] `server/src/searchStore.js` - `unit` - validate search payload normalization, persisted search mapping, threshold rules, and embedding reuse - covered by `server/src/searchStore.test.js`
- [x] `server/src/wardrobePdf.js` - `integration` - validate pending flow, job reuse, local cache, PDF build, and locale-specific labels - covered by `server/src/wardrobePdf.test.js`
- [x] `server/src/db.js` - `unit` - validate `hasAffectedRows` helper behavior - covered by `server/src/db.test.js`
- [x] `shared/stylePreferences.js` - `unit` - validate style partitioning, legacy inference, dedupe, and enabled-option filtering - effectively covered by `server/src/stylePreferences.test.js`
- [x] `shared/productDetail.js` - `unit/integration` - validate locale-sensitive product detail formatting - effectively covered by `server/src/wardrobePdf.test.js`
- [x] `server/src/index.js` - `integration` - cover HTTP endpoints, auth middleware, CSRF and origin checks, response codes, and validation branches - covered by `server/src/index.test.js`
- [x] `server/src/authStore.js` - `unit/integration` - cover resend cooldown, hourly rate limit, max verify attempts, session lifecycle, and expired-session cleanup - covered by `server/src/authStore.test.js`
- [x] `server/src/ai/ai.js` - `integration` - cover wardrobe generation orchestration, stored payload reuse, pending polling, swimwear addition, and error branches - covered by `server/src/ai/ai.test.js`
- [x] `server/src/ai/regenerateSelected.js` - `integration` - cover partial regeneration, selected-id validation, rejected-item updates, pending job reuse, and merge-back into stored wardrobe - covered by `server/src/ai/regenerateSelected.test.js`
- [x] `server/src/email.js` - `unit` - cover login email HTML rendering, locale template selection, escaping, and missing env handling - covered by `server/src/email.test.js`
- [x] `server/src/db.js` - `integration` - cover profile, search, session, and login-code persistence queries at the SQL boundary, not only helpers - covered by `server/src/db.integration.test.js`, `server/src/db.test.js`
- [x] `server/src/ai/voyageai.js`, `server/src/ai/deepinfra.js`, `server/src/ai/ollama.js` - `unit` - cover provider request shaping, env/config failures, and response normalization - covered by `server/src/voyageai.test.js`, `server/src/deepinfra.test.js`, `server/src/ollama.test.js`
- [x] `server/src/ai/sharpConfig.js` - `unit` - cover env-driven sharp cache and concurrency configuration - covered by `server/src/sharpConfig.test.js`
- [x] `server/src/ai/promptImages.child.js`, `server/src/wardrobePdf.child.js` - `integration` - cover child-process message contract, success payloads, and exit/error handling - covered by `server/src/promptImages.child.test.js`, `server/src/wardrobePdf.child.test.js`

## Client

- [x] `client/src/App.jsx` - `component/integration` - cover session bootstrap, auth flow, onboarding/profile transitions, route switch, wardrobe polling, regenerate-selected flow, and error recovery - covered by `client/src/App.test.jsx`
- [x] `client/src/api/request.js` - `unit` - cover JSON parsing, non-JSON fallback, CSRF header injection, cache and in-flight dedupe, and cache reset - covered by `client/src/api/request.test.js`
- [x] `client/src/api/auth.js` - `unit` - cover request contracts for auth and profile endpoints - covered by `client/src/api/auth.test.js`
- [x] `client/src/api/wardrobe.js` - `unit` - cover pending polling for wardrobe, PDF, and regeneration flows, download trigger, and error propagation - covered by `client/src/api/wardrobe.test.js`
- [x] `client/src/api/search.js` - `unit` - cover saved-search/options caching and `runSearch` request shaping - covered by `client/src/api/search.test.js`
- [x] `client/src/screens/SearchScreen.jsx` - `component` - cover initial hydration, filter draft serialization, page reset, mobile dialogs, result selection, detail panel, and search submit/reset - covered by `client/src/screens/SearchScreen.test.jsx`
- [x] `client/src/screens/SignInScreen.jsx` - `component` - cover email/code steps, disabled states, resend/reset actions, and Google script loading success/failure - covered by `client/src/screens/SignInScreen.test.jsx`
- [x] `client/src/screens/MainScreen.jsx` - `component` - cover placeholder vs grid rendering, shared sorting, mobile filters, regeneration selection, and action button states - `client/src/screens/MainScreen.test.jsx`
- [x] `client/src/screens/ProfileScreen.jsx` - `component` - cover save/delete/back flow, required selections, confirmation dialog, and locale-sensitive labels - covered by `client/src/screens/ProfileScreen.test.jsx`
- [x] `client/src/screens/OnboardingScreen.jsx` - `component` - cover step gating, next/back/start actions, and required selection logic - covered by `client/src/screens/OnboardingScreen.test.jsx`
- [x] `client/src/components/ClothingCard.jsx` - `component` - cover selection toggle, mobile vs desktop behavior, and outbound link rendering - covered by `client/src/components/ClothingCard.test.jsx`
- [x] `client/src/components/ProfileFiltersSidebar.jsx` - `component` - cover filter interactions and apply/reset callbacks - covered by `client/src/components/ProfileFiltersSidebar.test.jsx`
- [x] `client/src/components/StylePreferenceSelector.jsx` - `component` - cover core vs aesthetic selection rules and nullable behavior - covered by `client/src/components/StylePreferenceSelector.test.jsx`
- [x] `client/src/components/AccentColorChips.jsx` - `component` - cover single-select accent color behavior - covered by `client/src/components/AccentColorChips.test.jsx`
- [x] `client/src/components/AppLauncher.jsx` and `client/src/components/LocaleSwitcher.jsx` - `component` - cover app navigation and locale switching callbacks - covered by `client/src/components/AppLauncher.test.jsx`, `client/src/components/LocaleSwitcher.test.jsx`
- [x] `client/src/i18n/LocaleProvider.jsx` and `client/src/i18n/useI18n.js` - `unit/component` - cover locale state persistence and hook contract - covered by `client/src/i18n/LocaleProvider.test.jsx`, `client/src/i18n/useI18n.test.jsx`
- [x] `shared/wardrobeOrder.js` - `unit` - cover ordering stability and unknown-category fallback behavior - covered by `shared/wardrobeOrder.test.js`
- [x] `client/src/main.jsx`, `client/src/theme.js`, and presentational placeholders - `smoke/component` - cover render sanity checks only - covered by `client/src/main.test.jsx`, `client/src/components/ClothingGridPlaceholder.test.jsx`

## Shared And Smoke

- [x] `shared/i18n/helpers.js` - `unit` - cover locale normalization, translation fallback, interpolation, and unsupported locale handling - covered by `shared/i18n/helpers.test.js`
- [x] `shared/accentColors.js` - `unit` - cover exported accent color option contract sanity - covered by `shared/accentColors.test.js`
- [x] `shared/i18n/en.js` and `shared/i18n/ru.js` - `smoke` - cover critical key parity between locale dictionaries - covered by `shared/i18n/localeParity.test.js`
- [x] `e2e` auth happy path - cover sign-in, onboarding/profile initialization, wardrobe fetch, search navigation, and sign-out - covered by `client/src/App.e2e.test.jsx`
- [x] `e2e` search happy path - cover saved-filter hydration, query submit, pagination, and product detail open - covered by `client/src/screens/SearchScreen.e2e.test.jsx`
- [x] `e2e` capsule flow - cover wardrobe refresh, item selection, regenerate-selected flow, and PDF download trigger - covered by `client/src/screens/MainScreen.e2e.test.jsx`

## Test Cases And Acceptance

- Server coverage must include success paths and key error paths for every public HTTP endpoint.
- Client coverage must include critical user journeys and all polling/state-transition flows.
- Shared coverage must include pure transformations and locale-sensitive formatting behavior.
- AI and PDF flows must keep a separate `smoke` section because mocks alone are not enough to trust production behavior.
- This plan stays consolidated in a single file at `docs/test-coverage-plan.md`.
- `[x]` is used only for areas with explicit existing tests or strong factual coverage via current test files; all remaining gaps stay `[ ]`.
