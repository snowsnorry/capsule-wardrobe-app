import { sortWardrobeItems } from "./wardrobeOrder.js";

type WardrobeItem = {
  id?: unknown;
  url?: unknown;
  category?: unknown;
  [key: string]: unknown;
};

function normalizeWardrobeItemUrl(
  item: WardrobeItem | null | undefined,
): string {
  return String(item?.url || "").trim();
}

function buildDisplayWardrobeItems(items: unknown): WardrobeItem[] {
  return sortWardrobeItems(
    Array.isArray(items) ? (items as WardrobeItem[]) : [],
  );
}

function mergeWardrobeItemsWithMetadata({
  currentItems = [],
  nextItems = [],
  pendingUrls = [],
}: {
  currentItems?: unknown;
  nextItems?: unknown;
  pendingUrls?: unknown;
} = {}) {
  const orderedCurrentItems = Array.isArray(currentItems)
    ? (currentItems as WardrobeItem[])
    : [];
  const orderedNextItems = buildDisplayWardrobeItems(nextItems);
  const normalizedPendingUrls = Array.isArray(pendingUrls)
    ? pendingUrls.map((itemUrl) => String(itemUrl || "").trim()).filter(Boolean)
    : [];

  if (orderedCurrentItems.length === 0 || normalizedPendingUrls.length === 0) {
    return {
      items: orderedNextItems,
      replacementMap: new Map(),
    };
  }

  const pendingUrlSet = new Set(normalizedPendingUrls);
  const nextItemsByUrl = new Map(
    orderedNextItems
      .map((item) => [normalizeWardrobeItemUrl(item), item] as const)
      .filter((entry): entry is readonly [string, WardrobeItem] =>
        Boolean(entry[0]),
      ),
  );
  const preservedItemUrls = new Set(
    orderedCurrentItems
      .map((item) => normalizeWardrobeItemUrl(item))
      .filter((itemUrl) => itemUrl && !pendingUrlSet.has(itemUrl)),
  );
  const replacementCandidates = orderedNextItems.filter(
    (item) => !preservedItemUrls.has(normalizeWardrobeItemUrl(item)),
  );
  const consumedReplacementIndexes = new Set();
  const replacementMap = new Map();

  const takeReplacementItem = (category: unknown): WardrobeItem | null => {
    const preferredCategory = String(category || "");
    let replacementIndex = replacementCandidates.findIndex(
      (item, index) =>
        !consumedReplacementIndexes.has(index) &&
        String(item?.category || "") === preferredCategory,
    );
    if (replacementIndex === -1) {
      replacementIndex = replacementCandidates.findIndex(
        (_, index) => !consumedReplacementIndexes.has(index),
      );
    }
    if (replacementIndex === -1) {
      return null;
    }

    consumedReplacementIndexes.add(replacementIndex);
    return replacementCandidates[replacementIndex];
  };

  const mergedItems = orderedCurrentItems.map((currentItem) => {
    const currentItemUrl = normalizeWardrobeItemUrl(currentItem);
    if (!pendingUrlSet.has(currentItemUrl)) {
      return nextItemsByUrl.get(currentItemUrl) || currentItem;
    }

    const replacementItem =
      takeReplacementItem(currentItem?.category) || currentItem;
    const currentItemId = String(currentItem?.id || "").trim();
    const replacementItemId = String(replacementItem?.id || "").trim();
    if (currentItemId && replacementItemId) {
      replacementMap.set(currentItemId, replacementItemId);
    }
    return replacementItem;
  });

  const mergedItemUrls = new Set(
    mergedItems.map((item) => normalizeWardrobeItemUrl(item)).filter(Boolean),
  );
  const appendedItems = orderedNextItems.filter(
    (item) => !mergedItemUrls.has(normalizeWardrobeItemUrl(item)),
  );

  return {
    items: [...mergedItems, ...appendedItems],
    replacementMap,
  };
}

function mergeWardrobeItemsIntoExistingOrder(
  params: {
    currentItems?: unknown;
    nextItems?: unknown;
    pendingUrls?: unknown;
  } = {},
) {
  return mergeWardrobeItemsWithMetadata(params).items;
}

export {
  buildDisplayWardrobeItems,
  mergeWardrobeItemsIntoExistingOrder,
  mergeWardrobeItemsWithMetadata,
  normalizeWardrobeItemUrl,
};
