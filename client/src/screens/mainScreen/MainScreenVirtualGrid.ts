import type { MainScreenItem, MobileCardColumns } from "./MainScreenTypes";

type WardrobeGridEntry =
  | { kind: "item"; item: MainScreenItem; key: string }
  | { kind: "additional-placeholder"; key: string };

const VIRTUAL_WARDROBE_GRID_ITEM_THRESHOLD = 60;
const VIRTUAL_GRID_SM_MIN_WIDTH = 600;
const VIRTUAL_GRID_THREE_COLUMN_MIN_WIDTH = 760;
const VIRTUAL_GRID_FOUR_COLUMN_MIN_WIDTH = 1160;
const CARD_IMAGE_ASPECT_RATIO_HEIGHT = 4 / 3;
const DESKTOP_CARD_DETAIL_HEIGHT = 64;

const mobileCardDetailHeightByColumns: Record<MobileCardColumns, number> = {
  1: 64,
  2: 50,
  3: 42,
};

function shouldVirtualizeWardrobeGrid(entryCount: number) {
  return entryCount > VIRTUAL_WARDROBE_GRID_ITEM_THRESHOLD;
}

function getVirtualWardrobeGridColumnCount({
  containerWidth,
  isSmUp,
  mobileColumns,
}: {
  containerWidth: number;
  isSmUp: boolean;
  mobileColumns: MobileCardColumns;
}) {
  if (containerWidth >= VIRTUAL_GRID_FOUR_COLUMN_MIN_WIDTH) {
    return 4;
  }

  if (containerWidth >= VIRTUAL_GRID_THREE_COLUMN_MIN_WIDTH) {
    return 3;
  }

  if (isSmUp) {
    return 2;
  }

  return mobileColumns;
}

function getVirtualWardrobeGridGapPx({
  isSmUp,
  mobileColumns,
}: {
  isSmUp: boolean;
  mobileColumns: MobileCardColumns;
}) {
  if (isSmUp) {
    return 20;
  }

  return mobileColumns === 1 ? 10 : 0;
}

function getVirtualWardrobeGridRowEstimate({
  columnCount,
  containerWidth,
  gapPx,
  isSmUp,
  mobileColumns,
}: {
  columnCount: number;
  containerWidth: number;
  gapPx: number;
  isSmUp: boolean;
  mobileColumns: MobileCardColumns;
}) {
  const availableWidth = Math.max(
    containerWidth - gapPx * Math.max(columnCount - 1, 0),
    0,
  );
  const cardWidth = columnCount > 0 ? availableWidth / columnCount : 0;
  const detailHeight = isSmUp
    ? DESKTOP_CARD_DETAIL_HEIGHT
    : mobileCardDetailHeightByColumns[mobileColumns];

  return Math.max(
    Math.ceil(
      cardWidth * CARD_IMAGE_ASPECT_RATIO_HEIGHT + detailHeight + gapPx,
    ),
    detailHeight + gapPx,
  );
}

function buildWardrobeGridEntries({
  showAdditionalItemPlaceholder,
  visibleItems,
}: {
  showAdditionalItemPlaceholder: boolean;
  visibleItems: MainScreenItem[];
}): WardrobeGridEntry[] {
  const entries: WardrobeGridEntry[] = visibleItems.map((item) => ({
    kind: "item" as const,
    item,
    key: getWardrobeItemKey(item),
  }));

  if (showAdditionalItemPlaceholder) {
    entries.push({ kind: "additional-placeholder", key: "additional-item" });
  }

  return entries;
}

function buildWardrobeGridRows(
  entries: WardrobeGridEntry[],
  columnCount: number,
) {
  const safeColumnCount = Math.max(1, columnCount);
  const rows: WardrobeGridEntry[][] = [];
  for (let index = 0; index < entries.length; index += safeColumnCount) {
    rows.push(entries.slice(index, index + safeColumnCount));
  }
  return rows;
}

function getWardrobeItemKey(item: MainScreenItem) {
  return String(item?.url || item?.id || "").trim();
}

export {
  VIRTUAL_GRID_FOUR_COLUMN_MIN_WIDTH,
  VIRTUAL_GRID_SM_MIN_WIDTH,
  VIRTUAL_GRID_THREE_COLUMN_MIN_WIDTH,
  VIRTUAL_WARDROBE_GRID_ITEM_THRESHOLD,
  buildWardrobeGridEntries,
  buildWardrobeGridRows,
  getVirtualWardrobeGridColumnCount,
  getVirtualWardrobeGridGapPx,
  getVirtualWardrobeGridRowEstimate,
  getWardrobeItemKey,
  shouldVirtualizeWardrobeGrid,
};
export type { WardrobeGridEntry };
