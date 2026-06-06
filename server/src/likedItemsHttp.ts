function getHttpItemUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

function getWardrobeItemUrl(value: string): string {
  return /^wardrobe:\/\/\S+$/i.test(value) ? value : "";
}

function normalizeLikedItemUrl(value: unknown): string {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  return getHttpItemUrl(normalized) || getWardrobeItemUrl(normalized);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

function annotateValueWithLikedState(
  value: unknown,
  likedUrls: Set<string>,
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => annotateValueWithLikedState(item, likedUrls));
  }

  if (!isRecord(value)) {
    return value;
  }

  const annotated = Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [
      key,
      annotateValueWithLikedState(entryValue, likedUrls),
    ]),
  );
  const itemUrl = normalizeLikedItemUrl(value.url);

  return itemUrl
    ? {
        ...annotated,
        isLiked: likedUrls.has(itemUrl),
      }
    : annotated;
}

function annotateLikedItems<T>(value: T, likedUrlsInput: unknown[] = []): T {
  const likedUrls = new Set(
    likedUrlsInput.map(normalizeLikedItemUrl).filter(Boolean),
  );

  return annotateValueWithLikedState(value, likedUrls) as T;
}

export { annotateLikedItems, normalizeLikedItemUrl };
