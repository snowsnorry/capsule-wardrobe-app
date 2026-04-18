const CATEGORY_ORDER = ["outerwear", "midlayer", "top", "dress", "bottom", "belt", "shoes", "bag", "swimwear"];

function sortWardrobeItems(items = []) {
  return [...items].sort((left, right) => {
    const leftIndex = CATEGORY_ORDER.indexOf(left?.category || "");
    const rightIndex = CATEGORY_ORDER.indexOf(right?.category || "");
    const normalizedLeft = leftIndex === -1 ? CATEGORY_ORDER.length : leftIndex;
    const normalizedRight = rightIndex === -1 ? CATEGORY_ORDER.length : rightIndex;

    if (normalizedLeft !== normalizedRight) {
      return normalizedLeft - normalizedRight;
    }

    return String(left?.name || "").localeCompare(String(right?.name || ""));
  });
}

export { CATEGORY_ORDER, sortWardrobeItems };
