import { sortWardrobeItems } from "./wardrobeOrder.js";

type WardrobeItem = {
  id?: unknown;
  url?: unknown;
  category?: unknown;
  [key: string]: unknown;
};

type MergeState = {
  consumedReplacementIndexes: Set<number>;
  nextItemsByUrl: Map<string, WardrobeItem>;
  pendingUrlSet: Set<string>;
  replacementCandidates: WardrobeItem[];
  replacementMap: Map<string, string | null>;
};

function normalizeWardrobeItemCategory(item: WardrobeItem | null | undefined) {
  return String(item?.category || "")
    .trim()
    .toLowerCase();
}

function isWardrobeItem(item: WardrobeItem | null): item is WardrobeItem {
  return Boolean(item);
}

function normalizeWardrobeItemUrl(
  item: WardrobeItem | null | undefined,
): string {
  return String(item?.url || "").trim();
}

function isUploadedWardrobeUrl(value: unknown): boolean {
  return /^wardrobe:\/\/.+/i.test(String(value || "").trim());
}

function normalizeDisplayWardrobeItem(item: WardrobeItem): WardrobeItem {
  if (item?.source || !isUploadedWardrobeUrl(item?.url)) {
    return item;
  }

  return { ...item, source: "uploaded" };
}

function buildDisplayWardrobeItems(items: unknown): WardrobeItem[] {
  return sortWardrobeItems(
    Array.isArray(items)
      ? (items as WardrobeItem[]).map(normalizeDisplayWardrobeItem)
      : [],
  );
}

function normalizePendingUrls(pendingUrls: unknown) {
  return Array.isArray(pendingUrls)
    ? pendingUrls.map((itemUrl) => String(itemUrl || "").trim()).filter(Boolean)
    : [];
}

function buildNextItemsByUrl(items: WardrobeItem[]) {
  return new Map(
    items
      .map((item) => [normalizeWardrobeItemUrl(item), item] as const)
      .filter((entry): entry is readonly [string, WardrobeItem] =>
        Boolean(entry[0]),
      ),
  );
}

function buildPreservedItemUrls(
  currentItems: WardrobeItem[],
  pendingUrlSet: Set<string>,
) {
  return new Set(
    currentItems
      .map((item) => normalizeWardrobeItemUrl(item))
      .filter((itemUrl) => itemUrl && !pendingUrlSet.has(itemUrl)),
  );
}

function takeReplacementItem(
  category: unknown,
  state: MergeState,
): WardrobeItem | null {
  const preferredCategory = String(category || "");
  let replacementIndex = state.replacementCandidates.findIndex(
    (item, index) =>
      !state.consumedReplacementIndexes.has(index) &&
      String(item?.category || "") === preferredCategory,
  );
  if (replacementIndex === -1) {
    replacementIndex = state.replacementCandidates.findIndex(
      (_, index) => !state.consumedReplacementIndexes.has(index),
    );
  }
  if (replacementIndex === -1) {
    return null;
  }

  state.consumedReplacementIndexes.add(replacementIndex);
  return state.replacementCandidates[replacementIndex];
}

function getConsumedSwimwearReplacement(state: MergeState) {
  for (const index of state.consumedReplacementIndexes) {
    const item = state.replacementCandidates[index];
    if (normalizeWardrobeItemCategory(item) === "swimwear") {
      return item;
    }
  }

  return null;
}

function getCollapsedSwimwearReplacement(
  currentItem: WardrobeItem,
  state: MergeState,
) {
  if (normalizeWardrobeItemCategory(currentItem) !== "swimwear") {
    return null;
  }

  return getConsumedSwimwearReplacement(state);
}

function mergePendingWardrobeItem(
  currentItem: WardrobeItem,
  state: MergeState,
) {
  const replacementItem = takeReplacementItem(currentItem?.category, state);
  const collapsedSwimwearReplacement =
    replacementItem || getCollapsedSwimwearReplacement(currentItem, state);
  const mergedItem =
    replacementItem || (collapsedSwimwearReplacement ? null : currentItem);
  const currentItemId = String(currentItem?.id || "").trim();
  const replacementItemId = String(
    (collapsedSwimwearReplacement || currentItem)?.id || "",
  ).trim();

  if (currentItemId) {
    state.replacementMap.set(currentItemId, replacementItemId || null);
  }
  return mergedItem;
}

function mergeCurrentWardrobeItem(
  currentItem: WardrobeItem,
  state: MergeState,
) {
  const currentItemUrl = normalizeWardrobeItemUrl(currentItem);
  if (!state.pendingUrlSet.has(currentItemUrl)) {
    return state.nextItemsByUrl.get(currentItemUrl) || currentItem;
  }

  return mergePendingWardrobeItem(currentItem, state);
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
  const normalizedPendingUrls = normalizePendingUrls(pendingUrls);

  if (orderedCurrentItems.length === 0 || normalizedPendingUrls.length === 0) {
    return {
      items: orderedNextItems,
      replacementMap: new Map(),
    };
  }

  const pendingUrlSet = new Set(normalizedPendingUrls);
  const preservedItemUrls = buildPreservedItemUrls(
    orderedCurrentItems,
    pendingUrlSet,
  );
  const replacementCandidates = orderedNextItems.filter(
    (item) => !preservedItemUrls.has(normalizeWardrobeItemUrl(item)),
  );
  const state: MergeState = {
    consumedReplacementIndexes: new Set(),
    nextItemsByUrl: buildNextItemsByUrl(orderedNextItems),
    pendingUrlSet,
    replacementCandidates,
    replacementMap: new Map(),
  };
  const mergedItems = orderedCurrentItems.map((currentItem) =>
    mergeCurrentWardrobeItem(currentItem, state),
  );

  const mergedItemUrls = new Set(
    mergedItems.map((item) => normalizeWardrobeItemUrl(item)).filter(Boolean),
  );
  const appendedItems = orderedNextItems.filter(
    (item) => !mergedItemUrls.has(normalizeWardrobeItemUrl(item)),
  );

  return {
    items: [...mergedItems.filter(isWardrobeItem), ...appendedItems],
    replacementMap: state.replacementMap,
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
  normalizeDisplayWardrobeItem,
  normalizeWardrobeItemUrl,
};
