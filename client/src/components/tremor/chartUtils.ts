import type { CSSProperties } from "react";
import { chartFacetRamp } from "../../theme/themeTokens";

const chartTheme = {
  gridColor: "var(--cw-chart-grid)",
  tickColor: "var(--cw-chart-tick)",
  secondaryTickColor: "var(--cw-chart-secondary-tick)",
  selectedTickColor: "var(--cw-chart-selected-tick)",
  strokeColor: "var(--cw-chart-stroke)",
  activeStrokeColor: "var(--cw-chart-active-stroke)",
  cursorFill: "var(--cw-chart-cursor-fill)",
  tooltipBg: "var(--cw-chart-tooltip-bg)",
  tooltipBorder: "var(--cw-chart-tooltip-border)",
  tooltipInk: "var(--cw-chart-tooltip-ink)",
  tooltipShadow: "var(--cw-shadow-chart-tooltip)",
  focusGlow: "var(--cw-chart-focus-glow)",
  focusSoftGlow: "var(--cw-chart-focus-soft-glow)",
  seriesPrimary: "var(--cw-chart-series-primary)",
  activeDotStroke: "var(--cw-chart-active-dot-stroke)",
} as const;

const chartFacetCssRamp = chartFacetRamp.map((_entry, index) => ({
  color: `var(--cw-chart-facet-${index})`,
  activeColor: `var(--cw-chart-facet-active-${index})`,
}));

function getChartTheme(_isDarkMode = false) {
  return chartTheme;
}

function getChartFacetRamp() {
  return chartFacetCssRamp;
}

function getChartFallbackSwatch() {
  return "var(--cw-chart-fallback-swatch)";
}

function getChartFocusFilter({
  blur,
  glow = chartTheme.focusGlow,
  brightness,
}: {
  blur: number;
  glow?: string;
  brightness: number;
}) {
  return `drop-shadow(0 0 ${blur}px ${glow}) brightness(${brightness})`;
}

function getTooltipStyle(isDarkMode = false): CSSProperties {
  const tokens = getChartTheme(isDarkMode);

  return {
    borderRadius: "var(--cw-radius-dialog)",
    border: `1px solid ${tokens.tooltipBorder}`,
    background: tokens.tooltipBg,
    boxShadow: tokens.tooltipShadow,
    color: tokens.tooltipInk,
    fontVariantNumeric: "tabular-nums",
  };
}

function getTooltipTextStyle(isDarkMode = false): CSSProperties {
  const tokens = getChartTheme(isDarkMode);

  return {
    color: tokens.tooltipInk,
    fontVariantNumeric: "tabular-nums",
  };
}

function getGradientStops(backgroundValue?: string | null): string[] {
  if (typeof backgroundValue !== "string") {
    return [];
  }
  return backgroundValue.match(/#(?:[0-9a-fA-F]{3,8})/g) || [];
}

function sanitizeSvgId(value?: string | null): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export {
  getChartFallbackSwatch,
  getChartFacetRamp,
  getChartFocusFilter,
  getChartTheme,
  getTooltipStyle,
  getTooltipTextStyle,
  getGradientStops,
  sanitizeSvgId,
};
