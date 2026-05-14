type WardrobeSavedFlags = Record<string, unknown> & {
  isSavedToWardrobe?: unknown;
  is_saved_to_wardrobe?: unknown;
  savedToMyWardrobe?: unknown;
  source?: unknown;
};

function hasExplicitUnsavedWardrobeFlag(item: WardrobeSavedFlags | null) {
  return (
    item?.isSavedToWardrobe === false ||
    item?.is_saved_to_wardrobe === false ||
    item?.savedToMyWardrobe === false
  );
}

function hasSavedWardrobeFlag(item: WardrobeSavedFlags | null) {
  return Boolean(
    item?.isSavedToWardrobe ||
    item?.is_saved_to_wardrobe ||
    item?.savedToMyWardrobe,
  );
}

function isSavedToWardrobe(
  item: WardrobeSavedFlags | null,
  options: { includeWardrobeSource?: boolean } = {},
) {
  if (!item || hasExplicitUnsavedWardrobeFlag(item)) {
    return false;
  }
  return Boolean(
    hasSavedWardrobeFlag(item) ||
    (options.includeWardrobeSource &&
      (item.source === "from_catalog" || item.source === "uploaded")),
  );
}

export { isSavedToWardrobe };
