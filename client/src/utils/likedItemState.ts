type LikedItemLike = {
  url?: string | null;
  isLiked?: boolean | null;
  [key: string]: unknown;
};

function getCanonicalItemUrl(item: unknown): string {
  if (!item || typeof item !== "object") {
    return "";
  }

  return String((item as { url?: unknown }).url || "").trim();
}

function isLikedItem(item: unknown): boolean {
  return Boolean(
    item && typeof item === "object" && (item as LikedItemLike).isLiked,
  );
}

function patchLikedStateByUrl<T>(
  value: T,
  itemUrl: string,
  isLiked: boolean,
): T {
  const normalizedUrl = String(itemUrl || "").trim();
  if (!normalizedUrl) {
    return value;
  }

  return patchValue(value, normalizedUrl, isLiked) as T;
}

function patchValue(
  value: unknown,
  itemUrl: string,
  isLiked: boolean,
): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => patchValue(entry, itemUrl, isLiked));
  }

  if (!isPlainRecord(value)) {
    return value;
  }

  const patchedEntries = Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [
      key,
      patchValue(entryValue, itemUrl, isLiked),
    ]),
  );

  return getCanonicalItemUrl(value) === itemUrl
    ? { ...patchedEntries, isLiked }
    : patchedEntries;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

export { getCanonicalItemUrl, isLikedItem, patchLikedStateByUrl };
export type { LikedItemLike };
