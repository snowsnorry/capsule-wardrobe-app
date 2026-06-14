# Eslint Disable Audit

## Summary

- [x] Checked all `eslint-disable`, `eslint-disable-next-line`, and `eslint-disable-line` occurrences.
- [x] Re-ran ESLint with inline config disabled to see which warnings each directive suppresses.
- [x] Verified there are no obviously unused disable directives in the audited set.
- [x] Classified directives by whether they are justified, removable with small refactors, or signs of larger decomposition debt.

Current suppressed warning count:

- [ ] `max-lines`: 17
- [ ] `max-lines-per-function`: 27
- [ ] `complexity`: 17
- [x] `react-hooks/exhaustive-deps`: 0
- [x] `@typescript-eslint/no-explicit-any`: 0

Most disables are not broad attempts to bypass type or security checks. They mostly suppress size and complexity limits that become blocking under `npm run lint:strict` because strict lint runs ESLint with `--max-warnings=0`.

## Keep As Explicit Exceptions

These disables are acceptable as documented exceptions for now. Removing them would either reduce clarity or touch high-risk code without enough local value.

- [ ] `server/src/ai/capsuleReportSchema.ts` - `max-lines`
  - Single cohesive JSON schema contract. Splitting it would add indirection with little practical benefit.
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
- [ ] `client/src/app/appTypes.ts` - `max-lines`
  - Central app type surface. Splitting it should follow app-state ownership boundaries rather than line-count pressure alone.

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

- [ ] `client/src/screens/outfitScreen/OutfitScreen.tsx` - `max-lines`, `max-lines-per-function`, `complexity`
  - Main candidate for decomposition. Split header, grid, report, dialogs, menus, and action wiring.
- [ ] `client/src/screens/outfitScreen/useOutfitAddItemsDialog.ts` - `max-lines-per-function`
  - Split personal items, catalog search, selection, and mobile filters.
- [ ] `client/src/api/outfits.ts` - `max-lines`
  - Saved-outfit API calls, event streams, PDF download, and media/report helpers share one API surface.
- [ ] `client/src/app/capsuleActions.ts` - `max-lines`
  - Capsule action orchestration still groups generation, sharing, refresh, and mutation flows.
- [ ] `client/src/screens/WardrobeScreen.tsx` - `max-lines-per-function`
  - Screen state, filters, menus, uploads, and detail dialog are combined.
- [ ] `client/src/screens/useWardrobeItems.ts` - `max-lines-per-function`
  - Query, upload, PDF, like/delete, and menu state should be separated.
- [ ] `client/src/screens/WardrobeUploadDialog.tsx` - `max-lines-per-function`
  - Extract selection, validation, drag/drop, cleanup, and render sections.
- [ ] `client/src/app/useAppHandlers.ts` - `max-lines`, `max-lines-per-function`
  - Capsule, outfit, sharing, profile, and session handlers are grouped in one broad module.
- [ ] `client/src/app/useAppNavigation.ts` - `max-lines-per-function`
  - History, popstate, share routing, capsule/outfit routing, and search routing are combined.
- [ ] `client/src/app/AppShellContent.tsx` - `max-lines`, `max-lines-per-function`, `complexity`
  - Shell layout, sidebar search, action menus, and dialogs are mixed.
- [ ] `client/src/components/ClothingCard.tsx` - `max-lines`, `max-lines-per-function`, `complexity`
  - Extract action wiring, long-press/click behavior, and render sections.
- [ ] `client/src/components/ClothingCardParts.tsx` - `max-lines`, `max-lines-per-function`
  - Split image, details, and actions into smaller parts.
- [ ] `client/src/components/AppSidebarNavigation.tsx` - `max-lines-per-function`, `complexity`
  - Extract section list state and handlers.
- [ ] `client/src/components/AppSidebarNavigationCapsuleRows.tsx` - `max-lines`
  - Capsule/outfit row rendering and menu wiring should be split by row type or action surface.
- [ ] `client/src/components/AppSidebarNavigationSections.tsx` - `max-lines`
  - Sidebar section composition, sorting, counts, and pagination controls are still grouped.
- [ ] `client/src/components/ProfileFiltersAnchorSection.tsx` - `max-lines`, `max-lines-per-function`, `complexity`
  - Loading, selection mapping, dialog state, and render flow are combined.
- [ ] `client/src/screens/mainScreen/MainScreenDialogs.tsx` - `max-lines-per-function`
  - Main-screen dialog composition combines settings, upload, filter, and destructive-action dialog wiring.
- [ ] `client/src/screens/mainScreen/MainScreenView.tsx` - `max-lines`, `max-lines-per-function`, `complexity`
  - Report inspector, grid, and selection wiring should be split.
- [ ] `server/src/capsuleStore.ts` - `max-lines-per-function`, `complexity`
  - Store factory mixes CRUD, sharing, import, reports, and snapshots. Typed deps are complete; store-surface decomposition remains.
- [ ] `server/src/outfitStore.ts` - `max-lines-per-function`, `complexity`
  - Similar store-factory debt around lifecycle, reports, and snapshots. Typed deps are complete; store-surface decomposition remains.
- [ ] `server/src/searchStore.ts` - `max-lines-per-function`, `complexity`
  - Options loading, saved search, semantic fallback, and lexical fallback should become a clearer pipeline.
- [ ] `server/src/routes/capsuleMutationRoutes.ts` - `max-lines`, `max-lines-per-function`, `complexity`
  - Split create, filters, report, state, metadata, and selection routes.
- [ ] `server/src/routes/outfitMutationRoutes.ts` - `max-lines-per-function`, `complexity`
  - Create route combines source image copy, validation, and snapshot creation. Extract handler/service flow.
- [x] `server/src/ai/aiGeneration.ts` - `max-lines`, `max-lines-per-function`, `complexity`
  - Disable removed; broader AI generation decomposition can be tracked separately if needed.
- [x] `server/src/ai/capsuleReportService.ts` - `max-lines`
  - Disable removed after typing deps and splitting enough of the report service surface.
- [ ] `server/src/db/core.ts` - `max-lines`
  - Split core types, SQL client creation, and helpers.
- [ ] `server/src/db/profileCapsules.ts` - `max-lines`
  - Split capsule CRUD and shared-capsule persistence.
- [ ] `server/src/appDependencies.ts` - `max-lines`, `max-lines-per-function`
  - Composition root can be split into auth, capsule, wardrobe, outfit, search, and MCP dependency builders.

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
- [ ] Phase 4: split large client screens/hooks.
- [ ] Phase 5: split server stores, mutation routes, and AI generation/report pipelines.
