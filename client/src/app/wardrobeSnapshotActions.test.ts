import { beforeEach, describe, expect, test, vi } from "vitest";
import { applyWardrobeSnapshotToApp } from "./wardrobeSnapshotActions";
import { createTestCapsule, testStatus } from "./testUtils";
import type { CapsuleMeta, WardrobeItem } from "./appTypes";

function createSnapshotContext(overrides = {}) {
  return {
    activeCapsuleId: "capsule-1",
    closeNotificationPrompt: vi.fn(),
    fetchCapsule: vi.fn(async () => ({ capsule: createTestCapsule() })),
    manualWardrobeRegenerationCapsuleIdRef: { current: "" },
    pendingNotificationKindRef: { current: "" },
    pendingRegenerationUrlsRef: { current: [] as string[] },
    refreshCapsuleList: vi.fn(async () => undefined),
    regenerationBaseItemsRef: { current: [] as WardrobeItem[] },
    sendReadyNotification: vi.fn(),
    setActiveCapsuleMeta: vi.fn(),
    setHasPendingAdditionalItems: vi.fn(),
    setIsLoadingItems: vi.fn(),
    setIsPartialRegenerationLoading: vi.fn(),
    setIsWardrobePending: vi.fn(),
    setPartialRegenerationPendingUrls: vi.fn(),
    setPendingImageSetIndexes: vi.fn(),
    setProfileItems: vi.fn(),
    setProfileOutfitSets: vi.fn(),
    setSelectedRegenerationUrls: vi.fn(),
    setStatus: vi.fn(),
    stopCapsuleEventStream: vi.fn(),
    t: vi.fn(
      (key: string) =>
        ({
          "errors.regenerateAllFailed":
            "Failed to regenerate the capsule. Your previous capsule was restored.",
        })[key] || key,
    ),
    ...overrides,
  };
}

describe("wardrobeSnapshotActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("pending snapshot restores pending wardrobe state without triggering regeneration", async () => {
    const context = createSnapshotContext();

    await applyWardrobeSnapshotToApp(
      context,
      {
        status: "pending",
        hasPendingAdditionalItems: false,
        pendingRegenerationUrls: [],
        items: [],
      },
      "capsule-1",
    );

    expect(context.setIsWardrobePending).toHaveBeenCalledWith(true);
    expect(context.setIsLoadingItems).toHaveBeenCalledWith(true);
    expect(context.setIsPartialRegenerationLoading).toHaveBeenCalledWith(false);
  });

  test("failed snapshot keeps visible items and sets the regeneration error", async () => {
    const existingItems = [
      { id: "top-1", url: "https://example.com/top-1", category: "top" },
    ];
    const context = createSnapshotContext();

    await applyWardrobeSnapshotToApp(
      context,
      {
        status: "failed",
        items: existingItems,
      },
      "capsule-1",
    );

    expect(context.setProfileItems).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ url: "https://example.com/top-1" }),
      ]),
    );
    expect(context.setIsWardrobePending).toHaveBeenCalledWith(false);
    expect(context.setStatus).toHaveBeenCalledWith(expect.any(Function));
    const statusUpdater = context.setStatus.mock.calls[0][0] as (
      current: typeof testStatus,
    ) => typeof testStatus;
    expect(statusUpdater(testStatus).error).toBe(
      "Failed to regenerate the capsule. Your previous capsule was restored.",
    );
  });

  test("ready snapshot refreshes capsule metadata and sends pending ready notification", async () => {
    const context = createSnapshotContext({
      pendingNotificationKindRef: { current: "full" },
      fetchCapsule: vi.fn(async () => ({
        capsule: createTestCapsule({ status: "saved" }) as CapsuleMeta,
      })),
    });

    await applyWardrobeSnapshotToApp(
      context,
      {
        status: "ready",
        items: [{ id: "top-1", url: "https://example.com/top-1" }],
      },
      "capsule-1",
    );

    expect(context.sendReadyNotification).toHaveBeenCalledWith("full");
    expect(context.setActiveCapsuleMeta).toHaveBeenCalledWith(
      expect.objectContaining({ status: "saved" }),
    );
    expect(context.refreshCapsuleList).toHaveBeenCalled();
    expect(context.stopCapsuleEventStream).toHaveBeenCalled();
  });

  test("ready snapshot can skip capsule metadata refresh", async () => {
    const context = createSnapshotContext();

    await applyWardrobeSnapshotToApp(
      context,
      {
        status: "ready",
        items: [{ id: "top-1", url: "https://example.com/top-1" }],
      },
      "capsule-1",
      { refreshReadyCapsule: false },
    );

    expect(context.fetchCapsule).not.toHaveBeenCalled();
    expect(context.refreshCapsuleList).not.toHaveBeenCalled();
    const setProfileItems = context.setProfileItems.mock.calls[0][0] as (
      items: WardrobeItem[],
    ) => WardrobeItem[];
    expect(setProfileItems([])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: "https://example.com/top-1" }),
      ]),
    );
    expect(context.setIsWardrobePending).toHaveBeenCalledWith(false);
    expect(context.stopCapsuleEventStream).toHaveBeenCalled();
  });

  test("partial regeneration keeps regenerated items in the original placeholder slots", async () => {
    const baseItems = [
      {
        id: "outerwear-1",
        url: "https://example.com/outerwear-1",
        category: "outerwear",
      },
      { id: "top-1", url: "https://example.com/top-1", category: "top" },
      {
        id: "bottom-1",
        url: "https://example.com/bottom-1",
        category: "bottom",
      },
    ];
    const context = createSnapshotContext({
      pendingRegenerationUrlsRef: { current: ["https://example.com/top-1"] },
      regenerationBaseItemsRef: { current: baseItems },
    });

    await applyWardrobeSnapshotToApp(
      context,
      {
        status: "ready",
        items: [
          {
            id: "bottom-1",
            url: "https://example.com/bottom-1",
            category: "bottom",
          },
          { id: "top-2", url: "https://example.com/top-2", category: "top" },
          {
            id: "outerwear-1",
            url: "https://example.com/outerwear-1",
            category: "outerwear",
          },
        ],
      },
      "capsule-1",
    );

    const setProfileItems = context.setProfileItems.mock.calls[0][0] as (
      items: WardrobeItem[],
    ) => WardrobeItem[];
    expect(setProfileItems([]).map((item) => item.url)).toEqual([
      "https://example.com/outerwear-1",
      "https://example.com/top-2",
      "https://example.com/bottom-1",
    ]);
  });

  test("partial regeneration ready snapshot collapses bikini parts into one swimsuit", async () => {
    const baseItems = [
      { id: "top-1", url: "https://example.com/top-1", category: "top" },
      {
        id: "swim-top-1",
        url: "https://example.com/swim-top-1",
        category: "swimwear",
      },
      {
        id: "swim-bottom-1",
        url: "https://example.com/swim-bottom-1",
        category: "swimwear",
      },
    ];
    const context = createSnapshotContext({
      pendingRegenerationUrlsRef: {
        current: [
          "https://example.com/swim-top-1",
          "https://example.com/swim-bottom-1",
        ],
      },
      regenerationBaseItemsRef: { current: baseItems },
    });

    await applyWardrobeSnapshotToApp(
      context,
      {
        status: "ready",
        items: [
          { id: "top-1", url: "https://example.com/top-1", category: "top" },
          {
            id: "swimsuit-2",
            url: "https://example.com/swimsuit-2",
            category: "swimwear",
          },
        ],
      },
      "capsule-1",
    );

    const setProfileItems = context.setProfileItems.mock.calls[0][0] as (
      items: WardrobeItem[],
    ) => WardrobeItem[];
    expect(setProfileItems([]).map((item) => item.url)).toEqual([
      "https://example.com/top-1",
      "https://example.com/swimsuit-2",
    ]);
  });
});
