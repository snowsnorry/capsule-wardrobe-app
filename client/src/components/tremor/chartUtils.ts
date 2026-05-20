import type { CSSProperties } from "react";

function getTooltipStyle(isDarkMode = false): CSSProperties {
  if (isDarkMode) {
    return {
      borderRadius: 14,
      border: "1px solid rgba(238, 245, 243, 0.18)",
      background: "rgba(8, 17, 17, 0.96)",
      boxShadow: "0 16px 40px rgba(8, 17, 17, 0.4)",
      color: "#eef5f3",
      fontVariantNumeric: "tabular-nums",
    };
  }

  return {
    borderRadius: 14,
    border: "1px solid rgba(148, 163, 184, 0.24)",
    background: "rgba(255, 253, 249, 0.98)",
    boxShadow: "0 16px 40px rgba(15, 23, 42, 0.12)",
    color: "#1f2933",
    fontVariantNumeric: "tabular-nums",
  };
}

function getTooltipTextStyle(isDarkMode = false): CSSProperties {
  return {
    color: isDarkMode ? "#eef5f3" : "#1f2933",
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
  getTooltipStyle,
  getTooltipTextStyle,
  getGradientStops,
  sanitizeSvgId,
};
