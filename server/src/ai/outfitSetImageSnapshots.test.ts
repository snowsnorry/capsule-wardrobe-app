import { test, expect, vi } from "vitest";
import {
  areOutfitSetItemIdsEqual,
  buildOutfitSetSnapshotUpdate,
  getOutfitSetsFromSnapshot,
  resolveTargetSetItems,
  updateOutfitSetImageSnapshot,
} from "./outfitSetImageSnapshots.js";

const effectiveSnapshot = {
  filters: { formalityLevel: "casual" },
  data: {
    wardrobe: {
      items: [
        { id: "top-1", category: "top" },
        { id: "bottom-1", category: "bottom" },
      ],
      outfitSets: [{ itemIds: ["top-1", "bottom-1"] }],
    },
    rejectedUrls: ["https://example.com/rejected"],
  },
  report: { summary: "ok" },
};

test("outfit set image snapshot helpers resolve sets and build snapshot updates", () => {
  expect(getOutfitSetsFromSnapshot(effectiveSnapshot)).toEqual({
    wardrobe: effectiveSnapshot.data.wardrobe,
    outfitSets: [{ itemIds: ["top-1", "bottom-1"] }],
  });
  expect(resolveTargetSetItems(effectiveSnapshot.data.wardrobe, 0)).toEqual([
    { id: "top-1", category: "top" },
    { id: "bottom-1", category: "bottom" },
  ]);
  expect(resolveTargetSetItems(effectiveSnapshot.data.wardrobe, 2)).toBeNull();
  expect(resolveTargetSetItems({ items: [] }, 0)).toBeNull();
  expect(areOutfitSetItemIdsEqual({ itemIds: ["a"] }, { itemIds: ["a"] })).toBe(
    true,
  );
  expect(areOutfitSetItemIdsEqual({ itemIds: ["a"] }, { itemIds: ["b"] })).toBe(
    false,
  );
  expect(
    buildOutfitSetSnapshotUpdate(
      effectiveSnapshot,
      effectiveSnapshot.data.wardrobe,
      [{ itemIds: ["top-1"], image: null }],
    ),
  ).toMatchObject({
    filters: effectiveSnapshot.filters,
    data: {
      rejectedUrls: ["https://example.com/rejected"],
      wardrobe: { outfitSets: [{ itemIds: ["top-1"], image: null }] },
    },
    report: { summary: "ok" },
  });
});

test("updateOutfitSetImageSnapshot writes saved-only capsules to saved snapshot", async () => {
  const updateCapsuleSavedSnapshotImpl = vi.fn(async () => ({ id: "saved" }));
  const updateCapsuleSnapshotImpl = vi.fn(async () => ({ id: "draft" }));

  await expect(
    updateOutfitSetImageSnapshot({
      capsule: { saved: effectiveSnapshot, draft: null, status: "saved" },
      capsuleId: "capsule-1",
      email: "person@example.com",
      nextSnapshot: effectiveSnapshot,
      updateCapsuleSavedSnapshotImpl,
      updateCapsuleSnapshotImpl,
    }),
  ).resolves.toEqual({ id: "saved" });
  expect(updateCapsuleSavedSnapshotImpl).toHaveBeenCalledOnce();

  await expect(
    updateOutfitSetImageSnapshot({
      capsule: { saved: effectiveSnapshot, draft: effectiveSnapshot },
      capsuleId: "capsule-1",
      email: "person@example.com",
      nextSnapshot: effectiveSnapshot,
      updateCapsuleSavedSnapshotImpl,
      updateCapsuleSnapshotImpl,
    }),
  ).resolves.toEqual({ id: "draft" });
  expect(updateCapsuleSnapshotImpl).toHaveBeenCalledOnce();
});
