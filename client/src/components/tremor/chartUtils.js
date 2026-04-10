function getTooltipStyle(isDarkMode = false) {
  if (isDarkMode) {
    return {
      borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.18)",
      background: "rgba(0,0,0,0.96)",
      boxShadow: "0 16px 40px rgba(0,0,0,0.4)",
      color: "#ffffff"
    };
  }

  return {
    borderRadius: 14,
    border: "1px solid rgba(148, 163, 184, 0.24)",
    background: "rgba(255,255,255,0.98)",
    boxShadow: "0 16px 40px rgba(15, 23, 42, 0.12)",
    color: "#111111"
  };
}

function getTooltipTextStyle(isDarkMode = false) {
  return {
    color: isDarkMode ? "#ffffff" : "#111111"
  };
}

function getGradientStops(backgroundValue) {
  if (typeof backgroundValue !== "string") {
    return [];
  }
  return backgroundValue.match(/#(?:[0-9a-fA-F]{3,8})/g) || [];
}

function sanitizeSvgId(value) {
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
  sanitizeSvgId
};
