# Client working guide

## Scope
This directory contains the React frontend.

Primary areas:
- `app/` — app shell, route content, state/actions, session bootstrap, navigation, and dialogs
- `app/appRouting.ts` — route mapping for capsule, My Wardrobe, explore, statistics, and share URLs
- `api/` — API-facing client logic
- `api/request.ts` — shared fetch wrapper, JSON/error handling, short-lived GET cache, and CSRF header injection
- `auth/` — browser auth helpers such as passkey/WebAuthn registration and login
- `components/` — reusable UI
- `components/SettingsDialog*` and `components/SettingsRemoveAccount*` — settings, passkeys, and account removal UI
- `screens/` — page/screen composition
- `screens/mainScreen/` — main capsule/wardrobe screen composition
- `screens/searchScreen/` — search screen composition
- `screens/statisticsScreen/` — statistics screen composition
- `i18n/` — locale resources and helpers
- `search/` — search-related behavior
- `test/` — client-side test helpers
- `utils/` — utility helpers

## Rules
- Keep presentational changes local when possible.
- Prefer editing screen components before introducing new global abstractions.
- Reuse existing components and theme tokens before adding new ones.
- When changing copy, update locale resources and preserve EN/RU parity.
- When changing API usage, inspect the matching backend route/behavior.
- Keep request/response payloads, local state, and test fixtures on the final camelCase API contract.
- State-changing API calls should use `api/request.ts` so the CSRF header is populated from the CSRF cookie.
- When changing passkey UI or helpers, keep API contracts in `api/passkeys.ts` aligned with server `/auth/passkeys/*` routes and normalize browser cancellation separately from verification failures.
- When changing account removal UI, preserve the localized confirmation-word flow and keep `app/profileActions.ts` aligned with `DELETE /profile/me`.
- My Wardrobe upload and capsule event subscriptions use `@microsoft/fetch-event-source`; keep stream event names and payload shapes aligned with server routes.
- Do not hardcode backend origins when an existing proxy/config pattern exists.
- Avoid large UI rewrites unless explicitly requested.

## Validation
- `npm run test:client`
- `npm run coverage:client`
- `npm run typecheck:client`
- At the end of the work, after the final file edits, run `npm run format`.
- If `npm run format` changes files, include those formatter changes in the diff.
- After editing files, verify test coverage, test pass status, and ESLint before handing off.
- After tests, coverage, typecheck, and format, run `npm run lint:strict`.

## First files to inspect
- `App.tsx`
- `app/`
- `screens/`
- `components/`
- `api/`
- `i18n/`
- `theme.ts`

## Final response
- After changing files, include a recommended git commit message for the changes in the final response.
