import { describe, expect, test } from "vitest";
import {
  VIRTUAL_GRID_FOUR_COLUMN_MIN_WIDTH,
  VIRTUAL_GRID_SM_MIN_WIDTH,
  VIRTUAL_GRID_THREE_COLUMN_MIN_WIDTH,
  buildWardrobeGridEntries,
  buildWardrobeGridRows,
  getVirtualWardrobeGridColumnCount,
  getVirtualWardrobeGridGapPx,
  getVirtualWardrobeGridRowEstimate,
  shouldVirtualizeWardrobeGrid,
} from "./MainScreenVirtualGrid";
import type { MainScreenItem } from "./MainScreenTypes";

function createItems(count: number): MainScreenItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index}`,
    url: `https://example.com/item-${index}`,
    name: `Item ${index}`,
  }));
}

describe("MainScreenVirtualGrid", () => {
  test("matches the responsive wardrobe grid column rules", () => {
    expect(
      getVirtualWardrobeGridColumnCount({
        containerWidth: VIRTUAL_GRID_SM_MIN_WIDTH - 1,
        isSmUp: false,
        mobileColumns: 1,
      }),
    ).toBe(1);
    expect(
      getVirtualWardrobeGridColumnCount({
        containerWidth: VIRTUAL_GRID_SM_MIN_WIDTH - 1,
        isSmUp: false,
        mobileColumns: 3,
      }),
    ).toBe(3);
    expect(
      getVirtualWardrobeGridColumnCount({
        containerWidth: VIRTUAL_GRID_SM_MIN_WIDTH - 1,
        isSmUp: true,
        mobileColumns: 3,
      }),
    ).toBe(2);
    expect(
      getVirtualWardrobeGridColumnCount({
        containerWidth: VIRTUAL_GRID_THREE_COLUMN_MIN_WIDTH,
        isSmUp: true,
        mobileColumns: 2,
      }),
    ).toBe(3);
    expect(
      getVirtualWardrobeGridColumnCount({
        containerWidth: VIRTUAL_GRID_FOUR_COLUMN_MIN_WIDTH,
        isSmUp: true,
        mobileColumns: 2,
      }),
    ).toBe(4);
  });

  test("builds rows in display order and keeps the additional placeholder last", () => {
    const entries = buildWardrobeGridEntries({
      visibleItems: createItems(5),
      showAdditionalItemPlaceholder: true,
    });
    const rows = buildWardrobeGridRows(entries, 3);

    expect(rows).toHaveLength(2);
    expect(rows[0].map((entry) => entry.key)).toEqual([
      "https://example.com/item-0",
      "https://example.com/item-1",
      "https://example.com/item-2",
    ]);
    expect(rows[1].map((entry) => entry.key)).toEqual([
      "https://example.com/item-3",
      "https://example.com/item-4",
      "additional-item",
    ]);
    expect(rows[1][2]).toMatchObject({ kind: "additional-placeholder" });
  });

  test("guards virtualization by total rendered entry count", () => {
    expect(shouldVirtualizeWardrobeGrid(60)).toBe(false);
    expect(shouldVirtualizeWardrobeGrid(61)).toBe(true);
  });

  test("estimates row heights from width, columns, gap, and detail height", () => {
    const mobileEstimate = getVirtualWardrobeGridRowEstimate({
      columnCount: 2,
      containerWidth: 390,
      gapPx: getVirtualWardrobeGridGapPx({
        isSmUp: false,
        mobileColumns: 2,
      }),
      isSmUp: false,
      mobileColumns: 2,
    });
    const desktopEstimate = getVirtualWardrobeGridRowEstimate({
      columnCount: 4,
      containerWidth: 1200,
      gapPx: getVirtualWardrobeGridGapPx({
        isSmUp: true,
        mobileColumns: 2,
      }),
      isSmUp: true,
      mobileColumns: 2,
    });

    expect(mobileEstimate).toBeGreaterThan(300);
    expect(desktopEstimate).toBeGreaterThan(mobileEstimate);
  });
});
