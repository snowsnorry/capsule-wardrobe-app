import { sortWardrobeItems } from "./wardrobeOrder.js";

function normalizeWardrobeItemUrl(item) {
  return String(item?.url || "").trim();
}

function buildDisplayWardrobeItems(items) {
  return sortWardrobeItems(Array.isArray(items) ? items : []);
}

function mergeWardrobeItemsWithMetadata({
  currentItems = [],
  nextItems = [],
  pendingUrls = []
} = {}) {
  const orderedCurrentItems = Array.isArray(currentItems) ? currentItems : [];
  const orderedNextItems = buildDisplayWardrobeItems(nextItems);
  const normalizedPendingUrls = Array.isArray(pendingUrls)
    ? pendingUrls.map((itemUrl) => String(itemUrl || "").trim()).filter(Boolean)
    : [];

  if (orderedCurrentItems.length === 0 || normalizedPendingUrls.length === 0) {
    return {
      items: orderedNextItems,
      replacementMap: new Map()
    };
  }

  const pendingUrlSet = new Set(normalizedPendingUrls);
  const nextItemsByUrl = new Map(
    orderedNextItems
      .map((item) => [normalizeWardrobeItemUrl(item), item])
      .filter(([itemUrl]) => itemUrl)
  );
  const preservedItemUrls = new Set(
    orderedCurrentItems
      .map((item) => normalizeWardrobeItemUrl(item))
      .filter((itemUrl) => itemUrl && !pendingUrlSet.has(itemUrl))
  );
  const replacementCandidates = orderedNextItems.filter((item) => !preservedItemUrls.has(normalizeWardrobeItemUrl(item)));
  const consumedReplacementIndexes = new Set();
  const replacementMap = new Map();

  const takeReplacementItem = (category) => {
    const preferredCategory = String(category || "");
    let replacementIndex = replacementCandidates.findIndex((item, index) => (
      !consumedReplacementIndexes.has(index) && String(item?.category || "") === preferredCategory
    ));
    if (replacementIndex === -1) {
      replacementIndex = replacementCandidates.findIndex((_, index) => !consumedReplacementIndexes.has(index));
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

    const replacementItem = takeReplacementItem(currentItem?.category) || currentItem;
    const currentItemId = String(currentItem?.id || "").trim();
    const replacementItemId = String(replacementItem?.id || "").trim();
    if (currentItemId && replacementItemId) {
      replacementMap.set(currentItemId, replacementItemId);
    }
    return replacementItem;
  });

  const mergedItemUrls = new Set(
    mergedItems
      .map((item) => normalizeWardrobeItemUrl(item))
      .filter(Boolean)
  );
  const appendedItems = orderedNextItems.filter((item) => !mergedItemUrls.has(normalizeWardrobeItemUrl(item)));

  return {
    items: [...mergedItems, ...appendedItems],
    replacementMap
  };
}

function mergeWardrobeItemsIntoExistingOrder(params = {}) {
  return mergeWardrobeItemsWithMetadata(params).items;
}

export {
  buildDisplayWardrobeItems,
  mergeWardrobeItemsIntoExistingOrder,
  mergeWardrobeItemsWithMetadata,
  normalizeWardrobeItemUrl
};
