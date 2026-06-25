# UI/UX Design Audit

Last updated: 2026-06-24.

## Audit Scope

This audit reviews the current capsule wardrobe application as a product
experience, not just as a visual theme pass. It covers authentication,
post-login routing, the desktop app shell, mobile navigation, Capsule,
Personal items, Explore, Statistics, product detail, Settings, upload, and
empty Outfit states.

Evidence was captured in the current run from the dedicated e2e server at
`http://127.0.0.1:5310`, using in-memory dependencies and test data. Local
screenshots are saved in:

`screenshots/design-audit-2026-06-24/`

Captured steps:

1. `01-sign-in-email.png` - sign-in email step.
2. `02-sign-in-code.png` - sign-in code step.
3. `03-personal-items-empty.png` - post-login Personal items empty state.
4. `04-capsule-desktop.png` - desktop Capsule workspace.
5. `05-explore-default.png` - Explore default/catalog state.
6. `06-statistics-empty.png` - Statistics empty state.
7. `07-product-detail-dialog.png` - product detail dialog.
8. `08-settings-dialog.png` - Settings dialog.
9. `09-mobile-capsule.png` - mobile Capsule workspace.
10. `10-mobile-filters-dialog.png` - mobile Capsule filters.
11. `11-mobile-sidebar-drawer.png` - mobile sidebar drawer.
12. `12-statistics-populated.png` - populated Statistics charts.
13. `13-explore-results.png` - Explore search results and detail pane.
14. `14-personal-items-upload-dialog.png` - Personal items upload dialog.
15. `15-outfit-empty.png` - new Outfit empty state.

Sub-agent review was used for three independent passes:

- Frontend IA and route inventory.
- E2E capture/auth workflow and scenario constraints.
- Theme, component patterns, responsive dialogs, and accessibility risks.

## User Goal And Accessibility Target

The core user goal is to build a wardrobe foundation, generate or refine a
capsule, inspect catalog options, understand wardrobe coverage, and save or
assemble outfits without losing track of where each item lives.

The accessibility target is a keyboard- and screen-reader-usable app shell with
clear focus, named controls, understandable selected states, readable charts,
usable mobile dialogs, and recoverable form/upload flows. This audit does not
claim WCAG compliance; it identifies risks visible from screenshots, DOM
snapshots, e2e tests, and code structure.

## Strengths

1. **The app has a coherent workbench structure.** The persistent sidebar,
   route groups, compact toolbars, and item grids make the app feel like a
   working wardrobe tool rather than a marketing site.
2. **The authenticated route set is broad and reasonably stable.** Direct
   routes exist for Capsule, Outfit, Explore, Statistics, Personal items, and
   shared-capsule import, with e2e coverage around reloads and mobile flows.
3. **Most critical controls have semantic labels.** E2E tests and DOM snapshots
   show named buttons for sign-in, menu actions, filters, product cards,
   settings, upload, and chart segments.
4. **Mobile uses real dialog and drawer patterns.** Filters, navigation, and
   dialogs become explicit surfaces rather than tiny desktop panels squeezed
   into a narrow viewport.
5. **The product detail dialog is strong.** It has a clear image/detail split,
   visible metadata groups, a close action, and a direct product link.
6. **The design system is centralized.** Theme tokens, CSS variables, MUI
   overrides, typography, sidebar shell, cards, dialogs, and charts are all
   controlled from identifiable files:
   `client/src/theme/`, `client/src/components/`,
   `client/src/screens/*`, and `client/src/app/`.

## UX Risks

1. **The post-login home route is not self-explanatory.** First login lands on
   `Personal items`, while the product promise and route hierarchy also point
   strongly toward capsule generation. The Personal items empty state says users
   can save products from a capsule or upload later, but it does not clearly
   explain why this is the starting point or what the next best action is.

2. **The sidebar IA mixes product objects and tools in a way that needs more
   orientation.** `Personal items`, `Outfits`, `Capsules`, and `Catalog` are
   useful buckets, but `Explore` and `Statistics` nested under `Catalog` make
   sense only after the user understands the data model. New users may not know
   whether to start with upload, capsule generation, Explore, or Outfit.

3. **Empty states are uneven.** Personal items has a clear empty message and an
   upload CTA nearby. Statistics has a clear no-data message. The new Outfit
   screen, however, is visually sparse: the primary empty-state message is weak
   relative to the large blank canvas and disabled Analyze action.

4. **Statistics is structurally useful but visually low-signal.** The populated
   chart screenshot shows total count and three cards, but chart marks and labels
   are faint relative to card chrome. The chart instruction text repeats on each
   card, which adds reading load while the actual chart signal remains subtle.

5. **Mobile has good surfaces but dense decision points.** The mobile filter
   dialog is solid and readable, yet its fixed footer and many chips compress
   the useful visible area. The mobile drawer exposes many actions at once,
   including search, create, pin, entity rows, route groups, and account entry.

6. **Action discoverability depends heavily on icons and overflow menus.**
   Sidebar row actions, product actions, capsule actions, outfit actions, upload
   split actions, and mobile context actions are compact. This is efficient for
   repeat use, but first-time users may not understand what is available without
   exploring menus.

7. **Authentication copy and locale behavior can feel inconsistent.** In the
   captured sign-in screen, the app text is English while the embedded Google
   button follows browser/provider locale. This creates a mixed-language
   onboarding moment even before the user enters the app.

8. **The passkey prompt appears before the user has oriented in the product.**
   It is useful, but on first post-login entry it can compete with the empty
   Personal items task and make the first action feel less clear.

9. **A profile option mismatch surfaced during capture.** The e2e server
   repeatedly logged a MUI warning that `navy` was selected for a select whose
   available values were `blue`, `green`, `red`, `pink`, `yellow`, `purple`,
   `orange`, and `multiple_accent_colors`. This can make a filter look empty or
   invalid even when the user's saved preference is meaningful.

## Accessibility Risks

1. **Selected filter chips rely strongly on color and filled styling.** Code and
   screenshots show chip-heavy selected states across Capsule, Explore, and
   Statistics. Verify that selected states expose reliable `aria-pressed`,
   `aria-selected`, or equivalent state, and are not color-only.

2. **Interactive cards contain nested controls.** Clothing cards are button-like
   containers with inner menu/like/status controls. E2E tests cover some
   keyboard paths, but the full tab order, focus ring, focus return, and nested
   control announcements should be checked on product grids and mobile cards.

3. **Charts need keyboard and assistive-technology verification.** DOM snapshots
   expose chart segment buttons, but one Browser interaction found a chart
   segment locator that was present but not visibly actionable. Verify keyboard
   focus, visible focus indication, label clarity, and activation behavior for
   every chart segment.

4. **Mobile dialogs need scroll and footer overlap checks.** The Capsule filter
   dialog has readable content and a stable fixed footer, but the footer reduces
   the viewport. Long option lists, Russian strings, zoom, and keyboard focus
   near the bottom need verification.

5. **Icon-only controls need consistent accessible names and tooltips.** The app
   generally names icon buttons, but the density of sidebar, toolbar, card, and
   dialog controls means missing names would be high-impact if any regress.

6. **Focus trap and focus return should be tested across nested overlays.**
   Settings, product detail, upload, sidebar drawer, confirm dialogs, and mobile
   menus all stack over the same app shell. The code appears intentional, but
   screenshot evidence alone cannot verify focus behavior.

## Opportunity Areas

1. **Clarify the first-run path.** If Personal items is the intended home,
   strengthen the empty state around the user's next step: upload an item, open
   the existing capsule, or explore catalog products. If Capsule is the intended
   north-star, route first login there or make the Personal items screen explain
   its role in capsule quality.

2. **Make route groups more task-led.** Consider copy or grouping that maps
   routes to user intent: collect items, build capsules, assemble outfits, find
   catalog items, inspect coverage. The current labels are accurate but assume
   the user already understands the app model.

3. **Raise the salience of empty Outfit.** The new Outfit screen should give the
   empty canvas a clearer starting affordance and explain why Analyze is
   disabled. The visible `Add items` action is correct, but the screen feels
   under-instructed.

4. **Tune Statistics for scanability.** Reduce repeated instructional copy,
   increase chart mark/axis clarity, and make active-filter feedback stronger.
   The current surface reads as a dashboard card set, but the useful signal is
   quieter than the containers.

5. **Use helper text where icon density is highest.** Sidebar row actions,
   upload split actions, and product/card overflow actions may benefit from
   consistent tooltips and, where space allows, short visible labels for the
   highest-value first actions.

6. **Treat mobile filters as a high-priority workflow.** The dialog is solid,
   but it should be checked with long content, changed filters, error/disabled
   states, Russian locale, and 200% zoom because it is one of the densest mobile
   surfaces.

7. **Make passkey enrollment less interruptive.** Keep the prompt, but consider
   delaying it until the user has completed the first meaningful in-app action,
   or make the copy clearly secondary to the current empty-state action.

## Recommended Fix Order

1. **High impact: first-run orientation.** Decide whether Personal items or
   Capsule is the intended first screen and update the empty state/routing copy
   accordingly.
2. **High impact: Outfit empty state.** Add a stronger empty-state block with a
   clear `Add items` path and explanation for disabled Analyze.
3. **High impact: selected-state accessibility.** Audit chip, segmented control,
   card, and chart selected states for semantic state, keyboard focus, and
   non-color cues.
4. **Medium impact: Statistics chart clarity.** Tune chart contrast, repeated
   instructions, and active-filter feedback.
5. **Medium impact: mobile drawer and filters.** Verify focus order, footer
   overlap, long strings, and zoom behavior.
6. **Medium impact: action discoverability.** Add or verify tooltips and
   accessible names for compact icon-only controls.
7. **Polish: sign-in locale consistency.** Align provider button locale with app
   locale where possible, or account for provider-driven locale differences in
   the sign-in layout.
8. **Polish: profile option normalization.** Align saved accent-color values,
   e2e fixtures, option resources, and select values so `navy` does not produce
   an out-of-range selected state.

## Evidence Limits And Verification Gaps

- `npm run screenshots` could not be used as the primary capture path in this
  run. Bundled headless Chromium failed to launch under the local macOS sandbox,
  and the screenshot script also appears to contain an older upload dialog label.
  The audit therefore used the in-app Browser against the dedicated e2e server.
- Screenshots are light-theme only. Dark-theme findings from the previous audit
  remain useful as a token/theme pass, but this combined UX audit did not recapture
  dark mode.
- Visual screenshots cannot prove full accessibility behavior. Keyboard order,
  screen-reader output, focus trapping, focus return, zoom, reduced motion, and
  color contrast need dedicated checks.
- E2E data is deterministic and useful for structure, but it is sparse. Real
  wardrobes, long product names, many saved capsules/outfits, many personal
  items, failed uploads, and report-generation states can create additional
  density not visible here.
- Chart segment activation is covered by e2e tests, but the current Browser
  interaction could not reliably click a chart segment from the captured state.
  Treat chart interactivity as needing a separate keyboard/mouse QA pass.

## Related Code Surfaces

- Routing and app shell: `client/src/app/appRouting.ts`,
  `client/src/app/useAppNavigation.ts`, `client/src/app/AppRouteContent.tsx`,
  `client/src/app/AppShellContent.tsx`.
- Sidebar: `client/src/components/AppSidebarShell.tsx`,
  `client/src/components/AppSidebarNavigationSections.tsx`,
  `client/src/components/AppSidebarNavigationCapsuleRowStyles.ts`.
- Capsule: `client/src/screens/mainScreen/MainScreenView.tsx`,
  `client/src/screens/mainScreen/MainScreenMediaDialogs.tsx`.
- Personal items: `client/src/screens/WardrobeScreen.tsx`,
  `client/src/screens/WardrobeToolbar.tsx`,
  `client/src/screens/WardrobeUploadDialog.tsx`.
- Outfit: `client/src/screens/outfitScreen/OutfitScreenController.tsx`,
  `client/src/screens/outfitScreen/OutfitAddItemsDialog.tsx`.
- Explore: `client/src/screens/searchScreen/SearchScreenLayout.tsx`,
  `client/src/screens/searchScreen/SearchBar.tsx`.
- Statistics: `client/src/screens/statisticsScreen/StatisticsLayout.tsx`,
  `client/src/screens/statisticsScreen/StatisticsCharts.tsx`,
  `client/src/screens/statisticsScreen/StatisticsFiltersDialog.tsx`.
- Cards and detail dialogs: `client/src/components/ClothingCardRoot.tsx`,
  `client/src/components/ClothingCardParts.tsx`,
  `client/src/components/productDetail/ProductDetailDialog.tsx`.
- Settings: `client/src/components/SettingsDialog.tsx`,
  `client/src/components/SettingsDialogSections.tsx`,
  `client/src/components/SettingsDialogMobile.tsx`.
- Theme: `client/src/theme/themeTokens.ts`,
  `client/src/theme/themeCssVariables.ts`,
  `client/src/theme/themeComponents.ts`,
  `client/src/theme/themeTypography.ts`.
