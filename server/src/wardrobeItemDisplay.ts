const WARDROBE_ITEM_PRIVATE_FIELDS = new Set([
  "createdAt",
  "email",
  "embedding",
  "productId",
  "profileEmail",
  "updatedAt",
]);
const WARDROBE_LIST_ITEM_PRIVATE_FIELDS = new Set([
  ...WARDROBE_ITEM_PRIVATE_FIELDS,
  "rawImageUrl",
]);

function filterWardrobeItemFields(item: unknown, privateFields: Set<string>) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return item;
  }

  return Object.fromEntries(
    Object.entries(item).filter(([key]) => !privateFields.has(key)),
  );
}

function filterWardrobeItemForDisplay(item: unknown) {
  return filterWardrobeItemFields(item, WARDROBE_ITEM_PRIVATE_FIELDS);
}

function filterWardrobeListItemForDisplay(item: unknown) {
  return filterWardrobeItemFields(item, WARDROBE_LIST_ITEM_PRIVATE_FIELDS);
}

export { filterWardrobeItemForDisplay, filterWardrobeListItemForDisplay };
