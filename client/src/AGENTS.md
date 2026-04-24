# Client working guide

## Scope
This directory contains the React frontend.

Primary areas:
- `api/` — API-facing client logic
- `auth/` — browser auth helpers such as passkey/WebAuthn registration and login
- `components/` — reusable UI
- `screens/` — page/screen composition
- `i18n/` — locale resources and helpers
- `search/` — search-related behavior
- `utils/` — utility helpers

## Rules
- Keep presentational changes local when possible.
- Prefer editing screen components before introducing new global abstractions.
- Reuse existing components and theme tokens before adding new ones.
- When changing copy, update locale resources and preserve EN/RU parity.
- When changing API usage, inspect the matching backend route/behavior.
- When changing passkey UI or helpers, keep API contracts in `api/passkeys.ts` aligned with server `/auth/passkeys/*` routes and normalize browser cancellation separately from verification failures.
- Do not hardcode backend origins when an existing proxy/config pattern exists.
- Avoid large UI rewrites unless explicitly requested.

## Validation
- `npm run test:client`
- `npm run client:typecheck`

## First files to inspect
- `App.tsx`
- `screens/`
- `components/`
- `api/`
- `i18n/`
- `theme.ts`
