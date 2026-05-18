import type { SearchResultItem } from "./searchTypes";

function isSavedResultMatch(
  result: SearchResultItem,
  savedUrl: string,
  savedId: SearchResultItem["id"],
) {
  return (
    (savedUrl && String(result?.url || "").trim() === savedUrl) ||
    String(result?.id) === String(savedId)
  );
}

export function markSearchResultSavedToWardrobe(
  results: SearchResultItem[],
  item: SearchResultItem,
) {
  const savedUrl = String(item?.url || "").trim();
  const savedId = item?.id;
  return results.map((result) =>
    isSavedResultMatch(result, savedUrl, savedId)
      ? {
          ...result,
          isSavedToWardrobe: true,
          savedToMyWardrobe: true,
        }
      : result,
  );
}

export function markSearchResultRemovedFromWardrobe(
  results: SearchResultItem[],
  item: SearchResultItem,
) {
  const savedUrl = String(item?.url || "").trim();
  const savedId = item?.id;
  return results.map((result) =>
    isSavedResultMatch(result, savedUrl, savedId)
      ? {
          ...result,
          isSavedToWardrobe: false,
          savedToMyWardrobe: false,
        }
      : result,
  );
}
