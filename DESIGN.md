---
name: "Capsule Wardrobe App"
description: "A warm, restrained product UI for generating and refining capsule wardrobes."
colors:
  wardrobe-teal: "#1c7c7c"
  wardrobe-teal-hover: "#155f5f"
  wardrobe-teal-dark-mode: "#438f8f"
  wardrobe-teal-dark-mode-selected: "#65b2af"
  wardrobe-gold: "#b68416"
  wardrobe-gold-dark-mode: "#f0b429"
  signature-olive-gold: "#8f6f45"
  canvas-cream: "#f7f4ef"
  warm-paper: "#fffdf9"
  primary-contrast: "#fbfffd"
  ink-slate: "#1f2933"
  secondary-slate: "#52606d"
  divider-teal-wash: "rgba(20, 60, 60, 0.055)"
  dark-canvas: "#101817"
  dark-paper: "#15201f"
  dark-ink: "#eef5f3"
  dark-secondary: "#aab8b4"
  category-mint: "#dcefeb"
  category-teal: "#15766f"
  success-green: "#2f8f58"
  danger-red: "#d24343"
  image-wash: "#f7f5f1"
typography:
  display:
    fontFamily: "\"Onest Variable\", \"Onest\", \"Helvetica Neue\", \"Arial\", sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: 0
  headline:
    fontFamily: "\"Onest Variable\", \"Onest\", \"Helvetica Neue\", \"Arial\", sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.16
    letterSpacing: 0
  title:
    fontFamily: "\"Onest Variable\", \"Onest\", \"Helvetica Neue\", \"Arial\", sans-serif"
    fontSize: "1.125rem"
    fontWeight: 650
    lineHeight: 1.28
    letterSpacing: 0
  body:
    fontFamily: "\"Onest Variable\", \"Onest\", \"Helvetica Neue\", \"Arial\", sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: 0
  label:
    fontFamily: "\"Onest Variable\", \"Onest\", \"Helvetica Neue\", \"Arial\", sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0
  wordmark:
    fontFamily: "\"Leckerli One\", cursive"
    fontSize: "1.4rem"
    fontWeight: 400
    lineHeight: 1.1
rounded:
  xs: "4px"
  sm: "6px"
  card: "8px"
  panel: "10px"
  dialog: "14px"
  detail: "16px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.wardrobe-teal}"
    textColor: "{colors.primary-contrast}"
    typography: "{typography.label}"
    rounded: "{rounded.dialog}"
    padding: "6px 16px"
  button-secondary:
    backgroundColor: "{colors.warm-paper}"
    textColor: "{colors.ink-slate}"
    typography: "{typography.label}"
    rounded: "{rounded.dialog}"
    padding: "5px 15px"
  chip-selected:
    backgroundColor: "subtle teal action wash"
    textColor: "{colors.wardrobe-teal-hover} in light mode; {colors.wardrobe-teal-dark-mode-selected} in dark mode"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    height: "32px"
  wardrobe-card:
    backgroundColor: "{colors.warm-paper}"
    textColor: "{colors.ink-slate}"
    rounded: "{rounded.card}"
    width: "100%"
  sidebar-panel:
    backgroundColor: "{colors.warm-paper}"
    textColor: "{colors.ink-slate}"
    rounded: "{rounded.panel}"
---

# Design System: Capsule Wardrobe App

## 1. Overview

**Creative North Star: "The Wardrobe Worktable"**

This product should feel like a clean worktable for planning outfits: warm surface, clear tools, visible materials, and no theatrical AI wrapper. The strongest visual asset is always the clothing itself. Panels, filters, charts, and actions exist to help the user shape a capsule wardrobe, not to compete with the garments.

The visual system is restrained product UI with a personal styling temperature. Cream canvas and warm paper panels keep the workspace soft; muted teal identifies primary action and selected state; muted ochre-gold appears as a brand accent and chart support, never as decoration. The app may include dense filters and statistics, but it must not become a generic SaaS dashboard or a generic AI slop app.

**Key Characteristics:**
- Warm neutral workspace with strict accent discipline.
- Product images and capsule content as the dominant visual signal.
- Familiar MUI controls tuned for wardrobe planning density.
- Sidebar-led navigation with collapsible desktop behavior and full-screen mobile drawers.
- Compact charts and filters that support decisions without analytics theater.

## 2. Theme Source of Truth

Runtime theme values live under `client/src/theme/`.

- `themeTokens.ts`: canonical radii, wordmark and dense-label weights, palette tokens for light and dark mode, product-surface exceptions, status colors, launcher treatments, and shadows.
- `themePalette.ts`: maps palette tokens into MUI `palette` values.
- `themeCssVariables.ts`: exposes the shared `--cw-*` CSS variables used by cards, dialogs, navigation, product imagery, placeholder shimmers, media controls, and launcher surfaces.
- `themeTypography.ts`: defines the fixed MUI typography scale with Onest Variable, 0 letter spacing, and compact product UI weights.
- `themeComponents.ts`: centralizes MUI component defaults and overrides, including `CssBaseline`, buttons, chips, paper, dividers, dialogs, tabs, sliders, and outlined inputs.
- `theme.ts`: builds the app theme with `createAppTheme(mode)`, a global MUI shape radius of `14`, and the component overrides.

The app resolves `light`, `dark`, or `system` profile settings in `client/src/app/appViewState.ts` and `client/src/app/useAppControllerModel.ts`. `client/src/app/AppRootView.tsx` applies the resulting theme through MUI `ThemeProvider` and `CssBaseline`.

## 3. Colors

The palette is warm, muted, and utility-first: cream and warm paper carry the surfaces, teal marks action and selection, and ochre-gold gives the app its wardrobe-planner signature.

### Primary
- **Wardrobe Teal**: The primary action and selection color. Use for contained buttons, active navigation labels, sliders, pagination, major selected states, and subtle selected-row washes. Repeated secondary selections such as filter chips should use quieter teal washes rather than solid teal fills.
- **Wardrobe Teal Hover**: The light-mode hover and pressed primary color. Do not use it as a separate accent.
- **Dark-Mode Wardrobe Teal**: The dark-mode primary color. Use only when the app is in dark mode so teal stays legible against the dark canvas.

### Secondary
- **Wardrobe Gold**: The support accent for charts, launcher treatment, and rare highlight moments. The light-mode runtime value is muted ochre; the brighter gold is reserved for dark mode and gold wash surfaces. Gold should not replace teal for primary actions.
- **Signature Olive Gold**: The wordmark and product-title link color. It carries the personal styling character without turning the UI into fashion editorial.

### Tertiary
- **Category Mint**: The garment category badge background on wardrobe cards.
- **Category Teal**: The garment category badge text color.
- **Success Green**: Unsaved-change dots and positive status markers.
- **Danger Red**: Destructive or rejection states, including selected partial-regeneration rejection controls.

### Neutral
- **Canvas Cream**: The default light app background. It keeps the workspace warmer than a pure SaaS gray.
- **Warm Paper**: The default light-mode paper, product card, and sidebar surface. It is intentionally off-white rather than pure white.
- **Primary Contrast**: The near-white text color used on primary teal and image-action controls.
- **Ink Slate**: Primary light-mode text.
- **Secondary Slate**: Secondary copy, captions, hints, and inactive icon labels.
- **Divider Teal Wash**: Light-mode dividers and paper borders.
- **Dark Canvas**: Dark-mode app background.
- **Dark Paper**: Dark-mode panels and sidebar surfaces.
- **Dark Ink**: Primary dark-mode text.
- **Dark Secondary**: Secondary dark-mode text.
- **Image Wash**: Placeholder and image-frame background for wardrobe cards.

### Named Rules

**The Wardrobe Leads Rule.** Do not use color as decoration around clothing grids. Color may identify state, category, or action; garments must remain visually dominant.

**The Teal Means Action Rule.** Teal is reserved for primary actions, active navigation, selected filters, sliders, pagination, and selected result washes. If teal appears where nothing can be acted on or selected, remove it.

**The No AI Glow Rule.** Do not introduce purple-blue gradients, neon glows, or magical AI color language. The product generates wardrobes, but the interface behaves like a dependable planning tool.

## 4. Typography

**Display Font:** Onest Variable with Onest, Helvetica Neue, Arial, and sans-serif fallbacks.
**Body Font:** Onest Variable with Onest, Helvetica Neue, Arial, and sans-serif fallbacks.
**Label/Mono Font:** Onest Variable for labels; no mono system is currently established.

**Character:** The interface uses one practical sans family for almost everything. Onest Variable keeps dense filters, cards, dialogs, and statistics modern, readable, and warm while preserving Cyrillic coverage. The exception is the Leckerli One wordmark, which adds personal wardrobe character and must stay confined to app identity moments.

Runtime typography comes from `client/src/theme/themeTypography.ts`. The scale is fixed, not fluid, and every MUI variant uses `letterSpacing: 0`.

### Hierarchy

- **Display / h1** (2.25rem, 700, 1.12 line-height): Rare page-level emphasis and large empty/loading states. Do not use display scale inside panels or controls.
- **Headline / h2-h4** (1.875rem to 1.375rem, 700, 1.16-1.22 line-height): Main screen headings and major dialog titles.
- **Title / h5-h6** (1.25rem to 1.125rem, 700 or 650, 1.25-1.28 line-height): Sidebar titles, filter titles, statistics card titles, and compact section headers.
- **Body** (1rem or 0.875rem, 400, 1.5-1.55 line-height): Product descriptions, helper text, screen copy, result rows, and readable prose. Keep prose blocks under roughly 75 characters per line.
- **Label / Button / Subtitle** (0.875rem to 1rem, 600, 1.35-1.4 line-height): Chip labels, button labels, form labels, dense section labels, and filter captions.
- **Caption / Overline** (0.75rem, 500-650, 1.45 line-height): Metadata, small helper labels, and compact uppercase labels.
- **Wordmark** (Leckerli One, 1.4rem desktop sidebar and 1.85rem sign-in/onboarding): The app name only. Do not use this font for headings, buttons, labels, product names, or data.

### Named Rules

**The One Script Rule.** Leckerli One is only for the app name. Any other script usage weakens the product UI and risks fashion-brand parody.

**The Dense Tool Rule.** Filters, product rows, and statistics use compact type with weight contrast, not oversized headings. This is a working surface.

## 5. Elevation

The system is mostly flat and layered through tone, borders, and image framing. Shadows exist, but they are shallow and contextual: wardrobe cards get a faint resting shadow, dialogs and overlays get moderate depth, and chart/tooltips may lift above dense data. Default panels should use borders before shadows.

### Shadow Vocabulary

- **Wardrobe Card Rest** (`0 1px 6px rgba(17, 36, 34, 0.055)`): Default desktop clothing cards and placeholders.
- **Image Action Float** (`0 8px 20px rgba(17, 36, 34, 0.14)`): Floating image action buttons on outfit set imagery.
- **Overlay Panel** (`0 14px 32px rgba(31, 41, 51, 0.12)`): Dialog-style floating panels in light mode.
- **Overlay Panel Dark** (`0 14px 36px rgba(0, 0, 0, 0.3)`): Dialog-style floating panels in dark mode.
- **Chart Tooltip** (`0 14px 32px rgba(15, 23, 42, 0.1)`): Tooltips above charts and dense visualizations.

### Named Rules

**The Border Before Shadow Rule.** Panels, sidebars, filters, and chart cards use borders and tonal surfaces first. Add shadow only when a surface is floating above content or an image action needs separation.

**The No Decorative Glass Rule.** Backdrop blur may exist only on surfaces that need data separation, such as statistics cards. Do not use glassmorphism as a page style.

## 6. Components

### Buttons

- **Shape:** MUI default rounded controls inherit the app radius (14px). Contextual pill actions may use full rounding (999px).
- **Primary:** Muted teal background with near-white text, 600-weight label, no elevation. Used for apply, next, start, save, and generation actions.
- **Hover / Focus:** Use MUI state overlays and visible focus rings. Motion should be 150-240ms and limited to color, opacity, transform, or width where the existing sidebar behavior requires it.
- **Secondary / Ghost / Tertiary:** Outlined and text buttons stay neutral unless they are selected, destructive, or directly tied to a primary workflow. Reset and sign-out actions use outlined treatment.

### Chips

- **Style:** Filter chips are rounded MUI chips. Selected secondary chips use a subtle teal wash with teal text and border; unselected chips remain default neutral. Reserve solid teal for primary actions and major selected states.
- **State:** Chips represent active wardrobe preferences and search/statistics filters. Accent color chips include a 12px circular swatch with a neutral stroke so color remains inspectable.
- **Category Badge:** Wardrobe card category chips are compact, uppercase, mint-backed, and strongly weighted. They are labels, not controls.

### Cards / Containers

- **Corner Style:** Wardrobe item cards use a compact 8px radius on normal grids and square edges on dense mobile multi-column grids. Search and statistics panels use 10px; detail groups use 16px.
- **Background:** Warm paper panels on cream canvas in light mode; dark paper on dark canvas in dark mode.
- **Shadow Strategy:** Wardrobe cards may use the faint resting shadow; panels and filters use borders.
- **Border:** Use the teal-wash divider for light-mode paper borders. Dense mobile cards use stronger 0.5-1px borders for image separation.
- **Internal Padding:** Filter panels and search panels use 24px; wardrobe card details use 20px horizontal padding on desktop and tighter responsive padding on mobile.

### Inputs / Fields

- **Style:** Standard MUI text fields with rounded app shape, neutral border, warm paper input background, and Onest input text.
- **Focus:** MUI focus treatment should resolve to primary teal. Do not introduce custom glowing fields.
- **Error / Disabled:** Use MUI error and disabled states. Error copy appears in body2 text with error color below the relevant action area.

### Navigation

- **Style:** Persistent desktop sidebar, collapsible rail on wide screens, overlay drawer on smaller screens. The sidebar uses warm paper in light mode and dark paper in dark mode, with a single divider line and compact top-level buttons.
- **Active State:** Active top-level navigation uses teal icon and label color. Child capsule rows use pill selection and reveal actions on hover or focus.
- **Motion:** Sidebar collapse and child-list expansion use 180-240ms transitions, with reduced-motion fallback already present for navigation expansion.
- **Mobile Treatment:** Filters and details open as full-screen dialogs where space is constrained. Full-screen dialog paper must keep square viewport corners (`border-radius: 0`), even though non-fullscreen dialogs use the app dialog radius. Avoid modal-first behavior on desktop when inline panels work.

### Wardrobe Card

Wardrobe cards are the signature component. The image occupies a 3:4 frame and must remain the main content. Details are quiet: product label, optional category prefix on mobile, and small contextual action buttons that reveal only when useful. Selection mode dims the image with a dark overlay and changes the regeneration/rejection action state.

**Product Surface Exception:** Wardrobe card image frames and product card
detail surfaces intentionally stay light in every theme. Many catalog images
ship on white or near-white backgrounds, so forcing these surfaces dark makes
the product imagery look broken instead of themed. Keep the app shell and
supporting panels theme-aware, but do not force product image surfaces dark.

### Statistics Cards

Statistics cards are dense, compact, and chart-led. Use the existing chart palette for distinct categorical data, but avoid importing that saturation into the rest of the app shell. The statistics screen supports product understanding; it should not become the product's visual identity.

## 7. Do's and Don'ts

### Do:

- **Do** keep wardrobe imagery, preference chips, and product details ahead of decorative layout.
- **Do** use Wardrobe Teal for primary action, active navigation, selected filters, sliders, and selected rows.
- **Do** use Canvas Cream and Warm Paper as the main workspace layers in light mode.
- **Do** keep Leckerli One restricted to the app name.
- **Do** use MUI's familiar controls and states before inventing custom affordances.
- **Do** keep search and statistics dense enough for repeated product exploration.
- **Do** keep color swatches visible inside accent-color chips and product-detail rows.

### Don't:

- **Don't** make the app feel like a generic SaaS dashboard.
- **Don't** make the app feel like a generic AI slop app.
- **Don't** use purple-blue AI gradients, neon glows, generic magic sparkles, or prompt-tool styling.
- **Don't** turn statistics cards into the visual language for the whole product.
- **Don't** use gradient text.
- **Don't** use side-stripe borders greater than 1px as decorative accents on cards, list items, callouts, or alerts.
- **Don't** use decorative glassmorphism as a default page style.
- **Don't** use the Leckerli One wordmark font in labels, buttons, data, or product names.
- **Don't** let selected or inactive states rely on color alone.
