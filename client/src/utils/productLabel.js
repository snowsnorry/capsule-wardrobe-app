function getProductLabelParts(item, fallbackLabel = "") {
  const baseLabel = String(item?.name || "").trim();
  if (!baseLabel) {
    return {
      baseLabel: fallbackLabel,
      suffixLabel: "",
      accessibilityLabel: fallbackLabel
    };
  }

  const isUnisex = String(item?.audience || "").trim().toLowerCase() === "all";
  return {
    baseLabel,
    suffixLabel: isUnisex ? "unisex" : "",
    accessibilityLabel: isUnisex ? `${baseLabel} unisex` : baseLabel
  };
}

function formatProductLabel(item, fallbackLabel = "") {
  return getProductLabelParts(item, fallbackLabel).accessibilityLabel;
}

export { formatProductLabel, getProductLabelParts };
