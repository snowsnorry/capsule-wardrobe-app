function resolveTargetSetItems(wardrobe, setIndex) {
  const items = Array.isArray(wardrobe?.items) ? wardrobe.items : [];
  const targetSet = Array.isArray(wardrobe?.outfitSets)
    ? wardrobe.outfitSets[setIndex]
    : null;
  if (!targetSet) {
    return null;
  }

  const itemsById = new Map(
    items
      .map((item) => [String(item?.id || "").trim(), item])
      .filter(([id]) => id),
  );

  return (Array.isArray(targetSet?.itemIds) ? targetSet.itemIds : [])
    .map((itemId) => itemsById.get(String(itemId || "").trim()))
    .filter(Boolean);
}

function buildOutfitSetSnapshotUpdate(effectiveSnapshot, wardrobe, outfitSets) {
  return {
    filters: effectiveSnapshot?.filters,
    data: {
      wardrobe: {
        ...wardrobe,
        outfitSets,
      },
      rejectedUrls: effectiveSnapshot?.data?.rejectedUrls || [],
    },
    ...(Object.prototype.hasOwnProperty.call(effectiveSnapshot || {}, "report")
      ? { report: effectiveSnapshot?.report || null }
      : {}),
  };
}

function getOutfitSetsFromSnapshot(effectiveSnapshot) {
  const wardrobe = effectiveSnapshot?.data?.wardrobe;
  return {
    outfitSets: Array.isArray(wardrobe?.outfitSets) ? wardrobe.outfitSets : [],
    wardrobe,
  };
}

function areOutfitSetItemIdsEqual(left, right) {
  return (
    JSON.stringify(Array.isArray(left?.itemIds) ? left.itemIds : []) ===
    JSON.stringify(Array.isArray(right?.itemIds) ? right.itemIds : [])
  );
}

function shouldPersistOutfitSetImageInSavedSnapshot(capsule) {
  return (
    Boolean(capsule?.saved) && (!capsule?.draft || capsule.status === "saved")
  );
}

async function updateOutfitSetImageSnapshot({
  capsule,
  capsuleId,
  email,
  nextSnapshot,
  updateCapsuleSavedSnapshotImpl,
  updateCapsuleSnapshotImpl,
}) {
  return shouldPersistOutfitSetImageInSavedSnapshot(capsule)
    ? updateCapsuleSavedSnapshotImpl(email, capsuleId, nextSnapshot)
    : updateCapsuleSnapshotImpl(email, capsuleId, nextSnapshot);
}

function resolveSnapshotUpdater(impl, fallback) {
  return impl || fallback;
}

export {
  areOutfitSetItemIdsEqual,
  buildOutfitSetSnapshotUpdate,
  getOutfitSetsFromSnapshot,
  resolveSnapshotUpdater,
  resolveTargetSetItems,
  updateOutfitSetImageSnapshot,
};
