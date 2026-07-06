# Client working guide

## Scope
This directory contains the React frontend.

Primary areas:
- `app/` — app shell, route content, state/actions, session bootstrap, navigation, and dialogs
- `app/appRouting.ts` — route mapping for capsule, outfit, Personal items, explore, statistics, and share URLs
- `app/oauthReturn.ts` — safe same-origin OAuth authorization return bridge used after sign-in for the MCP connector
- `app/useActiveSidebarJobs.ts` — active job discovery, tracking, and UI wait orchestration
- `api/` — API-facing client logic
- `api/jobs.ts` — queued job snapshots, SSE subscription, and wait helpers
- `api/request.ts` — shared fetch wrapper, JSON/error handling, short-lived GET cache, and CSRF header injection
- `auth/` — browser auth helpers such as passkey/WebAuthn registration and login
- `components/` — reusable UI
- `components/SettingsDialog*` and `components/SettingsRemoveAccount*` — settings, passkeys, and account removal UI
- `hooks/` — reusable frontend hooks
- `screens/` — page/screen composition
- `screens/PersonalItemsReport*` and `screens/usePersonalItemsReport.ts` — Personal items report UI, state, and actions
- `screens/mainScreen/` — main capsule/wardrobe screen composition
- `screens/outfitScreen/` — saved outfit screen composition, report UI, item pickers, and media controls
- `screens/searchScreen/` — search screen composition
- `screens/statisticsScreen/` — statistics screen composition
- `i18n/` — locale resources and helpers
- `search/` — search-related behavior
- `test/` — client-side test helpers
- `theme/` — centralized MUI theme factory, palette and radius tokens, CSS variables, component overrides, and typography
- `utils/` — utility helpers

## Rules
- Keep presentational changes local when possible.
- Prefer editing screen components before introducing new global abstractions.
- Reuse existing components and theme tokens before adding new ones.
- For broad pre-edit exploration or large multi-file code changes, follow the root AGENTS.md sub-agent exploration and post-change review workflow.
- When changing copy, update locale resources and preserve EN/RU parity.
- When changing API usage, inspect the matching backend route/behavior.
- Keep request/response payloads, local state, and test fixtures on the final camelCase API contract.
- State-changing API calls should use `api/request.ts` so the CSRF header is populated from the CSRF cookie.
- When changing sign-in success/session actions, preserve `oauthReturnTo` handling so MCP OAuth authorization resumes only for safe same-origin `/oauth/authorize` paths.
- When changing passkey UI or helpers, keep API contracts in `api/passkeys.ts` aligned with server `/auth/passkeys/*` routes and normalize browser cancellation separately from verification failures.
- When changing account removal UI, preserve the localized confirmation-word flow and keep `app/profileActions.ts` aligned with `DELETE /profile/me`.
- Capsule reports, outfit reports/media jobs, Personal items uploads, Personal items reports, and queued job status use `@microsoft/fetch-event-source`; keep stream event names and payload shapes aligned with server routes.
- When changing queued job handling, keep `api/jobs.ts`, `app/useActiveSidebarJobs.ts`, and server `/jobs/*` route semantics aligned.
- Do not hardcode backend origins when an existing proxy/config pattern exists.
- Use Browser/Chrome DevTools/browser-use tools only when the user explicitly asks for browser-based validation or interaction in the current turn.
- If visual validation is explicitly requested, prefer headless Playwright against the repository's dedicated e2e server with in-memory dependencies. Do not open interactive browsers or Browser plugin sessions unless explicitly requested.
- Avoid large UI rewrites unless explicitly requested.

## Validation
- Documentation-only changes do not require validation commands when behavior and executable/config files are untouched.
- `npm run coverage:client`
- `npm run typecheck:client`
- At the end of client code or executable/config work, after the final file edits, run `npm run format`.
- If `npm run format` changes files, include those formatter changes in the diff.
- `npm run coverage:client` runs the client Vitest suite with coverage instrumentation, so do not also run `npm run test:client` unless debugging a coverage-specific issue, chasing a flaky failure, or doing a fast pre-coverage smoke run.
- After editing client code, verify coverage-backed test pass status and ESLint before handing off.
- After coverage, typecheck, and format, run `npm run quality:unused`, then `npm run lint:strict`.

## First files to inspect
- `App.tsx`
- `app/`
- `screens/`
- `components/`
- `hooks/`
- `api/`
- `i18n/`
- `theme/`

## Final response
- After changing files, include a recommended git commit message for the changes in the final response.
