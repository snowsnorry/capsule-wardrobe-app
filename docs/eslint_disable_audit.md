# Eslint Disable Audit

Last checked: 2026-06-16.

## Summary

- [x] Checked all source-code `eslint-disable`, `eslint-disable-next-line`, and `eslint-disable-line` occurrences.
- [x] Included `eslint-disable-next-line` directives in the audit.
- [x] Re-ran ESLint with inline config disabled to see the warnings each directive suppresses.
- [x] Re-ran ESLint with unused-disable reporting elevated to errors.
- [x] Removed two source directives from `server/src/db/searchProductQueries.ts` by moving large SQL bodies into documented SQL files.

Current source directive count:

- `eslint-disable-next-line`: 4
- block-level `eslint-disable`: 2
- `eslint-disable-line`: 0

Current suppressed warning count:

- `max-lines-per-function`: 3
- `complexity`: 3
- `max-lines`: 0
- `react-hooks/exhaustive-deps`: 0
- `@typescript-eslint/no-explicit-any`: 0

Validation commands used for this audit:

```sh
rg -n "eslint-disable|eslint-enable" -g '!node_modules' -g '!dist' -g '!coverage' .
npx eslint client/src/theme/themeComponents.ts client/src/components/ClothingCardLongPress.ts server/src/routes/wardrobeUploadStream.ts server/src/mcp/mcpAuth.ts server/src/mcp/oauthConfig.ts server/src/db/wardrobeCatalog.ts --no-inline-config
npx eslint client/src/theme/themeComponents.ts client/src/components/ClothingCardLongPress.ts server/src/routes/wardrobeUploadStream.ts server/src/mcp/mcpAuth.ts server/src/mcp/oauthConfig.ts server/src/db/wardrobeCatalog.ts --report-unused-disable-directives-severity error
```

## Current Directives

These are the only source-code ESLint suppressions currently present.

- [ ] `client/src/theme/themeComponents.ts` - `eslint-disable-next-line max-lines-per-function`
  - Still needed. `createComponentOverrides` reports 216 lines with inline config disabled.
  - Keep for now because the file centralizes MUI component overrides; splitting should be a deliberate theme-organization refactor.
- [ ] `client/src/components/ClothingCardLongPress.ts` - `eslint-disable-next-line max-lines-per-function`
  - Still needed. `useMobileLongPressMenu` reports 162 lines with inline config disabled.
  - Keep for now because the hook owns one gesture lifecycle: timers, pointer capture, movement cancellation, menu opening, and click suppression.
- [ ] `server/src/db/wardrobeCatalog.ts` - `eslint-disable-next-line max-lines-per-function`
  - Still needed. `saveWardrobeItemFromCatalogByUrl` reports 133 lines with inline config disabled.
  - Keep for now because it is one atomic insert/upsert SQL flow with a large returned shape.
- [ ] `server/src/routes/wardrobeUploadStream.ts` - `eslint-disable-next-line complexity`
  - Still needed. `processUploadedWardrobeItemMetadata` reports complexity 27 with inline config disabled.
  - Keep for now because upload metadata, image cleanup, progress events, DB update, and failure marking are intentionally ordered in one flow.
- [ ] `server/src/mcp/mcpAuth.ts` - block-level `eslint-disable complexity`
  - Still needed. `requireMcpBearerToken` reports complexity 17 with inline config disabled.
  - Keep for now because this is auth-sensitive bearer-token validation covering signature, issuer, audience, token use, subject, client id, expiry, and scope checks.
- [ ] `server/src/mcp/oauthConfig.ts` - block-level `eslint-disable complexity`
  - Still needed. `createMcpOAuthConfig` reports complexity 23 with inline config disabled.
  - Keep for now because the function combines OAuth env defaults, development allowances, override precedence, and production safeguards.

## Cleanup Status

The two `server/src/db/searchProductQueries.ts` directives were removed by extracting SQL into `server/src/db/sql/search_product_count.sql` and `server/src/db/sql/search_product_items.sql`. The unused-disable check passed without errors, and every remaining source directive maps to a concrete ESLint warning when inline config is disabled.

Future cleanup should be scoped by ownership area rather than done mechanically:

- theme override decomposition in `client/src/theme/themeComponents.ts`
- gesture hook decomposition in `client/src/components/ClothingCardLongPress.ts`
- SQL query readability work in `server/src/db/wardrobeCatalog.ts`
- security-sensitive MCP/OAuth validation decomposition in `server/src/mcp/`
- upload-stream workflow decomposition in `server/src/routes/wardrobeUploadStream.ts`
