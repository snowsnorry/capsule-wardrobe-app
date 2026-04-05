export function formatProductLabel(item, fallbackLabel = "") {
  const baseLabel = String(item?.name || "").trim();
  if (!baseLabel) {
    return fallbackLabel;
  }

  return String(item?.audience || "").trim().toLowerCase() === "all"
    ? `${baseLabel} (unisex)`
    : baseLabel;
}
