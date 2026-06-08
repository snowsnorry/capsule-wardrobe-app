# UI Design Audit

## Scope And Verification

Audit rechecked against `DESIGN.md`, impeccable product-register guidance, the
current theme tokens in `client/src/theme/`, and the live app at
`http://localhost:5173/` through the in-app Browser.

Reviewed surfaces:

- Capsule
- Personal items
- Catalog Explore/Search
- Catalog Statistics
- product detail and settings dialogs
- mobile Statistics filter dialog in light and dark themes

Notes:

- Mobile filter dialogs are solid full-screen surfaces in their settled state.
  They do not use glass, blur, or transparency. Any screenshot taken mid-open can
  misleadingly show the previous page underneath; that should not be treated as
  a design finding.
- Product detail dialogs are also opaque. Background content is visible only
  outside the dialog through the backdrop, not through the dialog surface.

## Light Theme Audit

### 1. Top Visual Issues

1. **Surface hierarchy is slightly too busy for a light wardrobe workspace.**
   Sidebar, capsule settings, product cards, filter panels, chart cards, and
   dialogs all have visible borders or shadows. Nothing is broken, but too many
   surfaces ask for attention at once.
2. **Teal is overused across selected states.** Navigation, selected chips,
   sliders, tabs, buttons, category labels, and chart elements all lean on teal.
   This weakens the intended rule that teal should clearly mean action or
   selection.
3. **Statistics feels more like an analytics dashboard than a supporting
   wardrobe view.** The chart cards are technically clean, but the dense filter
   panel plus many saturated chart colors make Statistics visually louder than
   Capsule and Personal items.
4. **Global control radius is softer than the product-register tone needs.**
   The app theme uses a global MUI radius of `18px`; combined with pill chips
   and rounded inputs, filters and dialogs feel slightly plush compared with the
   crisp `8px` wardrobe cards.
5. **Light borders and shadows make product grids feel boxed-in.** Product cards
   are attractive, but the card shadow, border, and image-frame separation create
   a repeated tile rhythm that can feel heavier than a worktable.
6. **Dense labels have too much equal emphasis.** Card names, filter section
   labels, chip labels, nav labels, and button labels often sit in the
   `600-700` weight range, so hierarchy depends more on containers than on type.
7. **Mobile filter dialogs are solid but visually flat.** Header, content, and
   footer use the same theme surface family with minimal separation. This is a
   polish issue, not a transparency or bleed-through issue.

### 2. Theme-Only Fixes

These can be solved through tokens or MUI overrides, without layout or component
rewrites:

- Reduce light `MuiPaper` border visibility.
- Lower `wardrobeCardShadow` and chart-card shadow strength.
- Calm `primaryMain`, selected chip, slider, tab, and action-wash usage so teal
  appears less loud when repeated.
- Tighten global `shape.borderRadius` and align `dialog` / `detail` radii with
  the product-card vocabulary.
- Reduce dense label weights for `button`, `chip`, `subtitle2`, and compact
  section labels.
- Tune `MuiChip`, `MuiButton`, `MuiOutlinedInput`, `MuiPaper`, `MuiDivider`,
  `MuiTabs`, and `MuiDialog` defaults for quieter repeated surfaces.
- Slightly reduce chart-card border/shadow contrast while keeping chart
  readability.

### 3. Component-Level Changes To Exclude For Now

These may be worth considering later, but they are not token-only and should be
out of scope for the current pass:

- Reworking Statistics chart layout, chart types, legends, or card composition.
- Changing the amount of filter content shown in desktop sidebars or mobile
  dialogs.
- Changing wardrobe grid structure, card information architecture, or mobile
  card label placement.
- Reworking product detail dialog structure or image/detail split.
- Changing mobile navigation or drawer behavior.
- Introducing new filter, empty-state, search-result, chart, or dialog
  components.

### 4. Recommended Token Categories

- **Palette:** keep warm cream/paper, but reduce repeated teal intensity in
  selected states and isolate chart colors from app chrome.
- **Typography:** lower dense label and control weights slightly; keep DM Sans,
  fixed scale, and `letterSpacing: 0`.
- **Border colors:** reduce paper, divider, product-card, dense mobile, and
  chart-card border opacity.
- **Border radii:** tighten global MUI shape, dialog, detail, chip, input, and
  button radii; do not increase softness.
- **Shadows:** reduce wardrobe-card rest shadow and chart-card shadow; keep
  overlay depth only for true dialogs.
- **Spacing:** only token-level MUI padding adjustments; do not solve density by
  changing page layouts.
- **MUI component overrides:** prioritize `MuiPaper`, `MuiButton`, `MuiChip`,
  `MuiOutlinedInput`, `MuiDialog`, `MuiTabs`, `MuiDivider`, and chart tooltip
  tokens.

### 5. Do Not Do

- Do not add gradients, AI glow, decorative blur, or glassmorphism.
- Do not make Statistics visual language drive the rest of the product.
- Do not make every selected/default chip teal and prominent.
- Do not increase shadows to create polish.
- Do not make the UI colder gray or generic SaaS-blue.
- Do not use larger typography to solve dense hierarchy.
- Do not round everything more; the app needs restraint, not extra softness.

## Dark Theme Audit

### 1. Top Visual Issues

1. **Light product cards dominate the dark shell.** Keeping product imagery on
   light surfaces is correct for catalog photos, but in dark mode the white card
   fields pull more attention than the garments and capsule controls.
2. **Dark borders are too strong and too uniform.** The dark tokens use visible
   divider and paper borders across sidebar boundaries, panels, inputs, cards,
   dialogs, and charts. The result feels etched rather than light.
3. **Teal becomes too frequent in dark mode.** The brighter dark-mode teal helps
   contrast, but repeated selected chips, nav states, sliders, tabs, and buttons
   create a busy rhythm.
4. **Product detail is opaque but visually heavy.** The dialog surface is solid,
   not glassy. The issue is that the dark detail panel, inner detail groups,
   strong borders, and light image pane create a high-contrast split that feels
   heavier than the rest of the app.
5. **Statistics becomes the loudest surface in dark mode.** Dark backgrounds make
   chart cards, chart colors, and filter chips feel more dashboard-like. This
   conflicts with the product principle that data should support styling rather
   than become the identity.
6. **Disabled and secondary controls look a little sunken.** Upload, inactive
   source chips, disabled apply/reset actions, and low-priority buttons lose
   polish because disabled opacity, dark borders, and dark fills are close in
   value.
7. **Mobile filter dialogs are solid but dense.** In settled state they are not
   transparent. The real issue is compact vertical rhythm: many chips, strong
   teal selected states, and a fixed footer make the surface feel crowded.

### 2. Theme-Only Fixes

These can be solved through tokens or MUI overrides, without layout or component
rewrites:

- Lower dark `divider`, `MuiPaper` border, `productBorder`, and
  `productDenseBorder` opacity.
- Tune `background.default` and `background.paper` so dark panels separate by
  tone rather than by hard outlines.
- Reduce selected-chip teal intensity, or use a darker selected surface with
  teal text/border for non-primary filters.
- Tune `primaryMain`, `primaryDark`, `primaryLight`, action-wash, hover, and
  disabled-state tokens specifically for dark mode.
- Reduce inner product-detail border contrast and detail-group wash opacity.
- Keep product image surfaces light, but soften their border/shadow transition
  against the dark shell.
- Normalize dark `MuiPaper`, `MuiDialog`, `MuiChip`, `MuiOutlinedInput`,
  `MuiButton`, `MuiDivider`, `MuiTabs`, and chart tooltip/card tokens.

### 3. Component-Level Changes To Exclude For Now

These may be worth considering later, but they are not token-only and should be
out of scope for the current pass:

- Changing the product-card light-surface exception.
- Reworking product detail image/detail layout or dialog composition.
- Changing Statistics chart composition, chart type, legend placement, or chart
  card layout.
- Changing mobile filter dialog content structure, grouping, or sticky footer
  behavior.
- Changing wardrobe/capsule grid structure or product label placement.
- Introducing dark-mode-only components or separate dark-mode flows.

### 4. Recommended Token Categories

- **Palette:** keep the warm green-tinted dark mode, but reduce the contrast jump
  between shell, panels, borders, and light product cards.
- **Typography:** keep the fixed scale; slightly reduce dense label/chip/button
  weight where bright text and teal already provide emphasis.
- **Border colors:** lower opacity for dark paper borders, product borders,
  dense mobile borders, dividers, inputs, and chart-card borders.
- **Border radii:** tighten dialog/detail/global control radii; do not make dark
  mode softer.
- **Shadows:** use less shadow in dark mode. Prefer clearer opaque surfaces and
  lower border contrast.
- **Spacing:** avoid layout spacing changes in a token-only pass; only adjust
  MUI component padding where the theme already owns it.
- **MUI component overrides:** prioritize `MuiDialog`, `MuiPaper`, `MuiChip`,
  `MuiOutlinedInput`, `MuiButton` disabled states, `MuiDivider`, `MuiTabs`, and
  chart tooltip/card tokens.

### 5. Do Not Do

- Do not make dark mode blacker; the issue is hierarchy, not darkness.
- Do not add glow around selected states, charts, or product cards.
- Do not make product imagery surfaces dark by default.
- Do not increase shadows to separate dark surfaces.
- Do not make teal brighter or more saturated.
- Do not let chart colors become the app's dark-mode identity.
- Do not describe or treat the settled dialogs as glass/transparent; they are
  solid surfaces.
- Do not solve mobile filters with a layout rewrite in a token-only pass.
