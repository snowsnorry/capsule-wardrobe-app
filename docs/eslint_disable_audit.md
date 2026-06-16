# Eslint Disable Audit

## Summary

- [x] Checked all `eslint-disable`, `eslint-disable-next-line`, and `eslint-disable-line` occurrences.
- [x] Re-ran ESLint with inline config disabled to see which warnings each directive suppresses.
- [x] Verified there are no obviously unused disable directives in the audited set.
- [x] Classified directives by whether they are justified, removable with small refactors, or signs of larger decomposition debt.

Current suppressed warning count:

- [x] `max-lines`: 0
- [ ] `max-lines-per-function`: 6
- [ ] `complexity`: 3
- [x] `react-hooks/exhaustive-deps`: 0
- [x] `@typescript-eslint/no-explicit-any`: 0

Most disables are not broad attempts to bypass type or security checks. They mostly suppress size and complexity limits that become blocking under `npm run lint:strict` because strict lint runs ESLint with `--max-warnings=0`.

After raising `max-lines` to 500, removing every `eslint-disable max-lines` from source files still leaves `npm run lint:strict` green. No source file currently needs a `max-lines` inline disable.

## Keep As Explicit Exceptions

These disables are acceptable as documented exceptions for now. Removing them would either reduce clarity or touch high-risk code without enough local value.

- [ ] `server/src/db/searchProductQueries.ts` - `max-lines-per-function`
  - Large SQL CTE/query functions. Mechanical splitting would make the SQL harder to audit.
- [ ] `server/src/db/wardrobeCatalog.ts` - `max-lines-per-function`
  - One atomic insert/upsert SQL flow with a large returned shape.
- [ ] `server/src/mcp/mcpAuth.ts` - `complexity`
  - Auth-sensitive bearer-token validation: issuer, audience, token use, subject, client id, expiry, and scope checks.
- [ ] `server/src/mcp/oauthConfig.ts` - `complexity`
  - OAuth configuration combines env defaults, development allowances, and production safeguards.
- [ ] `server/src/routes/wardrobeUploadStream.ts` - `complexity`
  - Ordered upload flow: metadata analysis, cleanup, progress events, DB update, and failure marking.
- [ ] `client/src/theme/themeComponents.ts` - `max-lines-per-function`
  - Centralized MUI component overrides. Can be split later, but the current form keeps theme behavior in one place.
- [ ] `client/src/components/ClothingCardLongPress.ts` - `max-lines-per-function`
  - Gesture lifecycle with timers, pointer handling, and click suppression. Splitting carelessly would make behavior harder to reason about.

## Cleared By 500-Line Limit

These files no longer need `max-lines` disables under the current 500-line threshold.

- [x] `client/src/app/appTypes.ts` - `max-lines`
- [x] `client/src/components/ClothingCard.tsx` - `max-lines`
- [x] `client/src/components/ClothingCardParts.tsx` - `max-lines`
- [x] `client/src/components/AppSidebarNavigationCapsuleRows.tsx` - `max-lines`
- [x] `client/src/components/AppSidebarNavigationSections.tsx` - `max-lines`
- [x] `client/src/components/ProfileFiltersAnchorSection.tsx` - `max-lines`
- [x] `server/src/ai/capsuleReportSchema.ts` - `max-lines`
- [x] `server/src/db/core.ts` - `max-lines`
- [x] `server/src/db/profileCapsules.ts` - `max-lines`
- [x] `server/src/appDependencies.ts` - `max-lines`

## Remove With Small Refactors

These disables look removable without changing architecture. They should be handled first because they reduce noise quickly.

- [x] `client/src/api/capsules.ts` - `max-lines`
  - File exceeds the limit by 1 line. Move a small helper or export grouping.
- [x] `client/src/app/AppRouteContent.tsx` - `max-lines-per-function`, `max-lines`
  - `MainRoute` exceeds by 3 lines. Extract one branch or prop-building block.
- [x] `client/src/app/AppShellSidebarNavigationBody.tsx` - `max-lines-per-function`
  - Exceeds by 4 lines. Extract navigation props or a small render helper.
- [x] `client/src/app/useAppControllerModel.ts` - `max-lines-per-function`, `max-lines`
  - Hook exceeds function limit by 6 lines. Extract one setup block.
- [x] `client/src/app/useAppControllerOperations.ts` - `max-lines-per-function`
  - Exceeds by 2 lines. Extract grouped assignments.
- [x] `client/src/screens/mainScreen/MainScreenActionDialogs.tsx` - `max-lines-per-function`
  - `NameDialog` exceeds by 1 line. Easy extraction or compaction.
- [x] `client/src/screens/mainScreen/MainScreen.testUtils.tsx` - `max-lines-per-function`
  - Test helper exceeds by 3 lines. Extract default props.
- [x] `client/src/app/AppShellOutfitActionMenu.tsx` - `max-lines-per-function`
  - Extract dialog/menu rendering or handler grouping.
- [x] `client/src/app/capsuleState.ts` - `complexity`
  - Extract filter, wardrobe, and report metadata builders.
- [x] `client/src/screens/WardrobeUrlUploadDialog.tsx` - `max-lines-per-function`
  - Extract URL fields, body, or actions.
- [x] `client/src/screens/mainScreen/MainScreenMenus.tsx` - `max-lines-per-function`
  - Extract header, row, or product menu blocks.
- [x] `server/src/capsuleHttp.ts` - `complexity`
  - Replace repeated `startsWith` checks with prefix/exact path arrays.
- [x] `server/src/serverStartup.ts` - `complexity`
  - Extract dev/prod startup selection into a helper.
- [x] `server/src/test/serverRouteTestWardrobeDependencies.ts` - `max-lines-per-function`
  - Split fixture dependency factory by wardrobe, upload, R2, and metadata groups.
- [x] `server/src/ai/swimwear.ts` - `@typescript-eslint/no-explicit-any`
  - Replace `Record<string, any>` deps bag with an explicit typed deps interface.
- [x] `server/src/ai/outfitReportService.ts` - `@typescript-eslint/no-explicit-any`
  - Replace deps bag with explicit service dependency types.
- [x] `server/src/ai/capsuleReportService.ts` - `@typescript-eslint/no-explicit-any`
  - Replace deps bag with explicit service dependency types. Leave file-size cleanup for a separate task.
- [x] `server/src/ai/outfitImages.ts` - `complexity`
  - Move default dependency resolution into typed helper(s).
- [x] `server/src/ai/regenerateSelectedGenerationDeps.ts` - `complexity`, `@typescript-eslint/no-explicit-any`
  - Type the deps bag and split dependency groups.
- [x] `server/src/capsuleStore.ts` - `@typescript-eslint/no-explicit-any`
  - Replaced the store dependency bag with explicit callback types. Leave store-surface decomposition for a separate task.
- [x] `server/src/outfitStore.ts` - `@typescript-eslint/no-explicit-any`
  - Replaced the store dependency bag with explicit callback types. Leave store-surface decomposition for a separate task.
- [x] `server/src/ai/aiGeneration.ts` - `@typescript-eslint/no-explicit-any`
  - Replaced the AI generation dependency bag with explicit typed dependency callbacks.

## Requires Larger Decomposition

These disables point to real structural debt. They should be planned as focused refactors with tests, not removed mechanically.

- [x] `client/src/screens/outfitScreen/OutfitScreen.tsx` - `max-lines`, `max-lines-per-function`, `complexity`
  - Split the screen into controller, view, scroll/content, report, main content, overlay, preview, confirm, name-dialog, and report-state modules.
- [x] `client/src/screens/outfitScreen/useOutfitAddItemsDialog.ts` - `max-lines-per-function`
  - Split personal items, catalog search, selection, and mobile filters into focused hooks.
- [x] `client/src/api/outfits.ts` - `max-lines`
  - Split saved-outfit URL/query helpers, item-reference normalization, SSE/report stream helpers, and PDF download behavior into focused API support modules while keeping the public `client/src/api/outfits.ts` exports stable.
- [x] `client/src/app/capsuleActions.ts` - `max-lines`
  - Split capsule lifecycle actions, report actions, profile-filter regeneration actions, and capsule search into focused modules while keeping `client/src/app/capsuleActions.ts` as the stable barrel for app callers and tests.
- [x] `client/src/screens/WardrobeScreen.tsx` - `max-lines-per-function`
  - Split filters, action menu, dialogs, upload success, and product-detail state from the main screen composition.
- [x] `client/src/screens/useWardrobeItems.ts` - `max-lines-per-function`
  - Split query, upload, PDF, like/delete, update, and menu state into focused action hooks.
- [x] `client/src/screens/WardrobeUploadDialog.tsx` - `max-lines-per-function`
  - Extracted upload selection, validation, drag/drop, cleanup, content, title, and actions.
- [x] `client/src/app/useAppHandlers.ts` - `max-lines`, `max-lines-per-function`
  - Split capsule, outfit, wardrobe, profile/session, sidebar registration, and shared-import handler wiring.
- [x] `client/src/app/useAppNavigation.ts` - `max-lines-per-function`
  - Split route state, app navigation, path navigation, and capsule/outfit navigation callbacks.
- [x] `client/src/app/AppShellContent.tsx` - `max-lines`, `max-lines-per-function`, `complexity`
  - Split sidebar panel state, body, action menus, search dialogs, and shell/card layout.
- [x] `client/src/components/ClothingCard.tsx` - `max-lines-per-function`, `complexity`
  - Extract action wiring, long-press/click behavior, and render sections.
- [x] `client/src/components/ClothingCardParts.tsx` - `max-lines-per-function`
  - Split image, details, and actions into smaller parts.
- [x] `client/src/components/AppSidebarNavigation.tsx` - `max-lines-per-function`, `complexity`
  - Extract section list state and handlers.
- [x] `client/src/components/ProfileFiltersAnchorSection.tsx` - `max-lines-per-function`, `complexity`
  - Loading, selection mapping, dialog state, and render flow are combined.
- [x] `client/src/screens/mainScreen/MainScreenDialogs.tsx` - `max-lines-per-function`
  - Extracted product-detail dialog state and handlers from the main dialog composition.
- [x] `client/src/screens/mainScreen/MainScreenView.tsx` - `max-lines`, `max-lines-per-function`, `complexity`
  - Split report highlighting, report slots, wardrobe panel, and capsule panel layout.
- [x] `server/src/capsuleStore.ts` - `max-lines-per-function`, `complexity`
  - Split the store factory into focused capsule store operations while preserving the public singleton exports and dependency injection behavior.
- [x] `server/src/outfitStore.ts` - `max-lines-per-function`, `complexity`
  - Split typed outfit dependencies and store operations from the singleton export surface.
- [x] `server/src/searchStore.ts` - `max-lines-per-function`, `complexity`
  - Split dependency resolution and the saved-search execution pipeline, including lexical and relaxed semantic fallback steps.
- [x] `server/src/routes/capsuleMutationRoutes.ts` - `max-lines`, `max-lines-per-function`, `complexity`
  - Split lifecycle response helpers and create/filter handlers while preserving middleware order and response shapes.
- [x] `server/src/routes/outfitMutationRoutes.ts` - `max-lines-per-function`, `complexity`
  - Extracted source image copy resolution, create draft construction, and item-update handlers from route registration.
- [x] `server/src/ai/aiGeneration.ts` - `max-lines`, `max-lines-per-function`, `complexity`
  - Disable removed; broader AI generation decomposition can be tracked separately if needed.
- [x] `server/src/ai/capsuleReportService.ts` - `max-lines`
  - Disable removed after typing deps and splitting enough of the report service surface.
- [ ] `server/src/appDependencies.ts` - `max-lines-per-function`
  - Composition root can be split into auth, capsule, wardrobe, outfit, search, and MCP dependency builders.

### Remaining Larger Decomposition Analysis

These files remained unchecked after the completed phases because the previous phases were scoped to different ownership surfaces:

- Phases 1-3 removed trivial line-count issues, typed dependency bags, and hook dependency disables.
- Phase 4 split large client screens and hooks, but did not cover client API modules, app action orchestrators, or reusable component internals.
- Phase 5 split server stores, mutation routes, and AI/report pipelines, but did not cover DB core modules or the server composition root.

A narrow ESLint run with inline config disabled on source directories still reports 17 warnings across the unchecked files: 11 `max-lines-per-function` and 6 `complexity` warnings. There are 0 remaining `max-lines` warnings. The remaining warnings should not be handled in one phase because they span separate validation surfaces and refactor risks: card UI behavior, sidebar/filter UI behavior, SQL query readability, OAuth/MCP safeguards, upload processing, and app dependency wiring.

## React Hook Disables

- [x] `client/src/app/useOutfitRouteSync.ts`
  - Destructured the option fields so ESLint can verify the exact effect dependency list without depending on the unstable options object.
- [x] `client/src/screens/outfitScreen/useOutfitAddItemsDialog.ts`
  - Stabilized catalog search callbacks with explicit dependencies and removed the hooks disable.

## No Explicit Any

- [x] Replace all remaining `Record<string, any>` dependency bags with explicit types.
- [x] Prioritize small AI modules first: `swimwear.ts`, `outfitReportService.ts`, `capsuleReportService.ts`.
- [x] Handle `capsuleStore.ts`, `outfitStore.ts`, and `aiGeneration.ts` dependency bags.

## Recommended Order

- [x] Phase 1: remove trivial line-count disables and the simple `complexity` case in `server/src/capsuleHttp.ts`.
- [x] Phase 2: type remaining AI/store dependency bags and remove the corresponding `no-explicit-any` disables.
- [x] Phase 3: fix both `react-hooks/exhaustive-deps` disables.
- [x] Phase 4: split large client screens/hooks.
- [x] Phase 5: split server stores, mutation routes, and AI generation/report pipelines.
- [x] Phase 6: split client outfit and capsule orchestration surfaces.
  - Fixed `client/src/api/outfits.ts` by moving outfit URL/query helpers, item-reference normalization, SSE subscription/report streaming helpers, and PDF download helpers into focused API support modules while keeping the exported public API names stable for `client/src/api/outfits.test.ts` and app callers.
  - Fixed `client/src/app/capsuleActions.ts` by moving capsule lifecycle actions, report actions, profile-filter regeneration actions, and capsule search into focused action modules while preserving the barrel exports used by `useAppHandlers`, route sync, and tests.
  - Validated with `npm run coverage:client`, `npm run typecheck:client`, `npm run format`, and `npm run lint:strict`.
- [x] Phase 7: split clothing card behavior and view parts.
  - Fix `client/src/components/ClothingCard.tsx` by extracting action-state derivation, click/long-press wiring, and product-menu key behavior from the component body without changing selectable, liked, wardrobe-source, or mobile behavior.
  - Fix `client/src/components/ClothingCardParts.tsx` by splitting image rendering, detail rendering, action rendering, keyboard handling, and style helpers into smaller component/utility modules.
  - Validate with `npm run coverage:client`, `npm run typecheck:client`, `npm run format`, and `npm run lint:strict`.
- [x] Phase 8: split sidebar navigation and profile filter UI composition.
  - Fix `client/src/components/AppSidebarNavigation.tsx` by extracting expanded-section state, load-more handlers, and the list composition into focused helpers/components.
  - Fix `client/src/components/ProfileFiltersAnchorSection.tsx` by extracting anchor snapshot normalization, selection state transitions, dialog/render content, and selected-row rendering.
  - Added a focused selected-anchor rows test to keep extracted UI composition above coverage thresholds.
  - Validated with `npm run coverage:client`, `npm run typecheck:client`, `npm run format`, and `npm run lint:strict`.
- [x] Phase 9: clear stale server DB `max-lines` suppressions after the 500-line threshold change.
  - `server/src/db/core.ts` and `server/src/db/profileCapsules.ts` no longer require inline `max-lines` disables.
- [ ] Phase 10: split the server composition root.
  - Fix `server/src/appDependencies.ts` by extracting auth/session, profile/options, capsule/outfit, wardrobe/media, search/MCP, passkey/OAuth, and account-cleanup dependency builders enough to remove the remaining `max-lines-per-function` disable. Keep `createAppDependencies(options)` as the public entrypoint and preserve option override precedence, especially auth-test mode and injected test dependencies.
  - Validate with `npm run coverage:server`, `npm run typecheck:server`, `npm run format`, and `npm run lint:strict`.
