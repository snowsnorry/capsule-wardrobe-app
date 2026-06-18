import type { ThemeMode } from "./themeTypes";
import { appThemeTokens, paletteTokens } from "./themeTokens";

function createChartFacetCssVariables(mode: ThemeMode) {
  const tokens = paletteTokens[mode];

  return Object.fromEntries(
    tokens.chartFacetRamp.flatMap((entry, index) => [
      [`--cw-chart-facet-${index}`, entry.color],
      [`--cw-chart-facet-active-${index}`, entry.activeColor],
    ]),
  );
}

function createChartCssVariables(mode: ThemeMode) {
  const tokens = paletteTokens[mode];

  return {
    "--cw-shadow-chart-tooltip": tokens.chartTooltipShadow,
    "--cw-chart-grid": tokens.chartGrid,
    "--cw-chart-tick": tokens.chartTick,
    "--cw-chart-secondary-tick": tokens.chartSecondaryTick,
    "--cw-chart-selected-tick": tokens.chartSelectedTick,
    "--cw-chart-stroke": tokens.chartStroke,
    "--cw-chart-active-stroke": tokens.chartActiveStroke,
    "--cw-chart-cursor-fill": tokens.chartCursorFill,
    "--cw-chart-tooltip-bg": tokens.chartTooltipBg,
    "--cw-chart-tooltip-border": tokens.chartTooltipBorder,
    "--cw-chart-tooltip-ink": tokens.chartTooltipInk,
    "--cw-chart-focus-glow": tokens.chartFocusGlow,
    "--cw-chart-focus-soft-glow": tokens.chartFocusSoftGlow,
    "--cw-chart-series-primary": tokens.chartSeriesPrimary,
    "--cw-chart-active-dot-stroke": tokens.chartActiveDotStroke,
    "--cw-chart-fallback-swatch": tokens.chartFallbackSwatch,
    ...createChartFacetCssVariables(mode),
  };
}

function createThemeCssVariables(mode: ThemeMode) {
  const tokens = paletteTokens[mode];

  return {
    "--cw-radius-xs": appThemeTokens.radii.xs,
    "--cw-radius-sm": appThemeTokens.radii.sm,
    "--cw-radius-card": appThemeTokens.radii.card,
    "--cw-radius-panel": appThemeTokens.radii.panel,
    "--cw-radius-dialog": appThemeTokens.radii.dialog,
    "--cw-radius-detail": appThemeTokens.radii.detail,
    "--cw-radius-pill": appThemeTokens.radii.pill,
    "--cw-radius-circle": appThemeTokens.radii.circle,
    "--cw-radius-control": appThemeTokens.controls.actionRadius,
    "--cw-control-action-height": `${appThemeTokens.controls.actionHeight}px`,
    "--cw-font-family-wordmark": appThemeTokens.typography.wordmarkFamily,
    "--cw-font-family-confirmation-code":
      appThemeTokens.typography.confirmationCodeFamily,
    "--cw-font-size-wordmark-sidebar":
      appThemeTokens.typography.wordmarkSidebarSize,
    "--cw-font-size-wordmark-sign-in":
      appThemeTokens.typography.wordmarkSignInSize,
    "--cw-font-weight-product-badge":
      appThemeTokens.typography.productBadgeWeight,
    "--cw-color-primary": tokens.primaryMain,
    "--cw-color-action-wash":
      mode === "dark" ? "oklch(27% 0.018 190)" : "oklch(96% 0.014 190)",
    "--cw-color-action-hover":
      mode === "dark" ? "oklch(30% 0.024 190)" : "oklch(94% 0.018 190)",
    "--cw-color-gold-wash":
      mode === "dark" ? "oklch(30% 0.045 80)" : "oklch(94% 0.055 82)",
    "--cw-color-user-avatar-bg": tokens.userAvatarBg,
    "--cw-color-user-avatar-ink": tokens.userAvatarInk,
    "--cw-color-surface-warm":
      mode === "dark" ? "oklch(18% 0.014 180)" : "oklch(98% 0.008 72)",
    "--cw-color-product-card-bg": tokens.productCardBg,
    "--cw-color-product-card-ink": tokens.productCardInk,
    "--cw-color-product-card-muted": tokens.productCardMuted,
    "--cw-color-product-image-wash": tokens.productImageWash,
    "--cw-color-product-detail-wash": tokens.productDetailWash,
    "--cw-color-product-detail-strong-wash": tokens.productDetailStrongWash,
    "--cw-color-product-border": tokens.productBorder,
    "--cw-color-product-dense-border": tokens.productDenseBorder,
    "--cw-color-product-detail-divider": tokens.productDetailDivider,
    "--cw-color-product-placeholder-text": tokens.productPlaceholderText,
    "--cw-color-product-placeholder-marker": tokens.productPlaceholderMarker,
    "--cw-color-product-placeholder-muted": tokens.productPlaceholderMuted,
    "--cw-color-product-saved-indicator": tokens.productSavedIndicator,
    "--cw-color-liked-indicator": tokens.productLikedIndicator,
    "--cw-color-liked-indicator-bg": tokens.productLikedIndicatorBg,
    "--cw-color-liked-indicator-border": tokens.productLikedIndicatorBorder,
    "--cw-color-product-selection-scrim": tokens.productSelectionScrim,
    "--cw-gradient-placeholder-image": tokens.placeholderImageGradient,
    "--cw-gradient-placeholder-text": tokens.placeholderTextGradient,
    "--cw-color-on-image-action-bg": tokens.onImageActionBg,
    "--cw-color-on-image-action-bg-hover": tokens.onImageActionBgHover,
    "--cw-color-on-image-action-bg-selected": tokens.onImageActionBgSelected,
    "--cw-color-on-image-action-bg-selected-hover":
      tokens.onImageActionBgSelectedHover,
    "--cw-color-on-image-action-ink": tokens.onImageActionInk,
    "--cw-color-mobile-image-action-bg": tokens.mobileImageActionBg,
    "--cw-color-mobile-image-action-bg-hover": tokens.mobileImageActionBgHover,
    "--cw-color-mobile-image-action-border": tokens.mobileImageActionBorder,
    "--cw-color-mobile-image-action-ink": tokens.mobileImageActionInk,
    "--cw-color-mobile-image-action-ink-hover":
      tokens.mobileImageActionInkHover,
    "--cw-shadow-mobile-image-action": tokens.mobileImageActionShadow,
    "--cw-color-category-badge-bg": tokens.categoryBadgeBg,
    "--cw-color-category-badge-ink": tokens.categoryBadgeInk,
    "--cw-color-failed-badge-bg": tokens.failedBadgeBg,
    "--cw-color-failed-badge-ink": tokens.failedBadgeInk,
    "--cw-color-needs-review-badge-bg": tokens.needsReviewBadgeBg,
    "--cw-color-needs-review-badge-ink": tokens.needsReviewBadgeInk,
    "--cw-color-unsaved-indicator": tokens.successMain,
    "--cw-color-media-control-bg": tokens.mediaControlBg,
    "--cw-color-media-control-bg-hover": tokens.mediaControlBgHover,
    "--cw-color-media-control-ink": tokens.mediaControlInk,
    "--cw-color-passkey-hover-bg": tokens.passkeyHoverBg,
    "--cw-color-notification-icon": tokens.notificationIcon,
    "--cw-color-notification-action-hover": tokens.notificationActionHover,
    "--cw-gradient-marketing-image-fade":
      "radial-gradient(circle at 50% 50%, rgba(252, 251, 249, 0) 62%, rgba(252, 251, 249, 0.07) 84%, rgba(252, 251, 249, 0.14) 100%), linear-gradient(to top, rgba(252, 251, 249, 0.08), rgba(252, 251, 249, 0)), linear-gradient(to bottom, rgba(252, 251, 249, 0.07), rgba(252, 251, 249, 0)), linear-gradient(to right, rgba(252, 251, 249, 0.07), rgba(252, 251, 249, 0)), linear-gradient(to left, rgba(252, 251, 249, 0.07), rgba(252, 251, 249, 0))",
    "--cw-shadow-wardrobe-card": tokens.wardrobeCardShadow,
    "--cw-shadow-image-toggle": tokens.imageToggleShadow,
    "--cw-shadow-image-action": tokens.imageActionShadow,
    "--cw-shadow-overlay-panel": tokens.overlayPanelShadow,
    ...createChartCssVariables(mode),
  } as const;
}

export { createThemeCssVariables };
