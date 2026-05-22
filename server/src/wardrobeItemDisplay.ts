const WARDROBE_ITEM_PRIVATE_FIELDS = new Set([
  "createdAt",
  "email",
  "embedding",
  "productId",
  "profileEmail",
  "updatedAt",
]);

function filterWardrobeItemForDisplay(item: unknown) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return item;
  }

  return Object.fromEntries(
    Object.entries(item).filter(
      ([key]) => !WARDROBE_ITEM_PRIVATE_FIELDS.has(key),
    ),
  );
}

export { filterWardrobeItemForDisplay };
