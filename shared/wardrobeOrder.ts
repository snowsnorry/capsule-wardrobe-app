const CATEGORY_ORDER = [
  "outerwear",
  "midlayer",
  "top",
  "dress",
  "bottom",
  "belt",
  "shoes",
  "bag",
  "swimwear",
];

type WardrobeOrderItem = {
  category?: unknown;
  name?: unknown;
};

function sortWardrobeItems<T extends WardrobeOrderItem>(
  items: readonly T[] = [],
): T[] {
  return [...items].sort((left, right) => {
    const leftCategory =
      typeof left?.category === "string" ? left.category : "";
    const rightCategory =
      typeof right?.category === "string" ? right.category : "";
    const leftIndex = CATEGORY_ORDER.indexOf(leftCategory);
    const rightIndex = CATEGORY_ORDER.indexOf(rightCategory);
    const normalizedLeft = leftIndex === -1 ? CATEGORY_ORDER.length : leftIndex;
    const normalizedRight =
      rightIndex === -1 ? CATEGORY_ORDER.length : rightIndex;

    if (normalizedLeft !== normalizedRight) {
      return normalizedLeft - normalizedRight;
    }

    return String(left?.name || "").localeCompare(String(right?.name || ""));
  });
}

export { CATEGORY_ORDER, sortWardrobeItems };
