import {
  getCapsuleSnapshotRegeneration,
  getEffectiveCapsuleSnapshot,
} from "../capsuleStore.js";
import type { CapsuleRecord } from "../capsuleStoreModel.js";

function getTrimmedText(value) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeOutfitSet(set) {
  const normalizedSet: {
    itemIds: string[];
    image?: string | null;
    imageObsolete?: boolean;
  } = {
    itemIds: Array.isArray(set?.itemIds)
      ? set.itemIds.map((id) => String(id || "").trim()).filter(Boolean)
      : [],
  };

  const image = getTrimmedText(set?.image);
  if (image || (set && typeof set === "object" && "image" in set)) {
    normalizedSet.image = image;
  }

  if (set && typeof set === "object" && "imageObsolete" in set) {
    normalizedSet.imageObsolete = Boolean(set.imageObsolete);
  }

  return normalizedSet;
}

function normalizeOutfitSets(value) {
  return Array.isArray(value)
    ? value.map(normalizeOutfitSet).filter((set) => set.itemIds.length > 0)
    : [];
}

function getStoredRawSelectionText(stored) {
  return getTrimmedText(stored.rawSelectionText);
}

function getStoredWardrobePayload(profile) {
  const stored = profile?.items;
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
    return null;
  }

  return {
    items: Array.isArray(stored.items) ? stored.items : [],
    outfitSets: normalizeOutfitSets(stored.outfitSets),
    rawSelectionText: getStoredRawSelectionText(stored),
    swimwearReasoning: getTrimmedText(stored.swimwearReasoning),
    swimwearRawSelectionText: getTrimmedText(stored.swimwearRawSelectionText),
  };
}

function buildSnapshotPayload(payload = {}) {
  return {
    status: "idle",
    pendingStage: null,
    hasPendingAdditionalItems: false,
    pendingRegenerationUrls: [],
    pendingImageSetIndexes: [],
    items: [],
    outfitSets: [],
    rawSelectionText: null,
    swimwearReasoning: null,
    swimwearRawSelectionText: null,
    error: null,
    ...payload,
  };
}

function getFailedRawSelectionText(storedWardrobe, error) {
  return (
    getTrimmedText(error?.rawSelectionText) ||
    storedWardrobe?.rawSelectionText ||
    null
  );
}

function buildFailedSnapshot(storedWardrobe, error) {
  return buildSnapshotPayload({
    status: "failed",
    ...getStoredWardrobeSnapshotFields(storedWardrobe),
    rawSelectionText: getFailedRawSelectionText(storedWardrobe, error),
    error: "service_unavailable",
  });
}

function getWardrobeItemUrls(storedWardrobe) {
  return Array.isArray(storedWardrobe?.items)
    ? storedWardrobe.items
        .map((item) => String(item?.url || "").trim())
        .filter(Boolean)
    : [];
}

function getPendingImageSetIndexes(outfitSetImageJob) {
  return Array.isArray(outfitSetImageJob?.pendingSetIndexes)
    ? outfitSetImageJob.pendingSetIndexes
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isInteger(value) && value >= 0)
        .sort((left, right) => left - right)
    : [];
}

function getPendingRegenerationUrls(partialRegenerationJob) {
  return Array.isArray(partialRegenerationJob?.pendingItemUrls)
    ? partialRegenerationJob.pendingItemUrls
        .map((itemUrl) => String(itemUrl || "").trim())
        .filter(Boolean)
    : Array.isArray(partialRegenerationJob?.payload?.itemUrls)
      ? partialRegenerationJob.payload.itemUrls
          .map((itemUrl) => String(itemUrl || "").trim())
          .filter(Boolean)
      : [];
}

function getStoredWardrobeSnapshotFields(storedWardrobe) {
  return {
    items: storedWardrobe?.items || [],
    outfitSets: storedWardrobe?.outfitSets || [],
    rawSelectionText: storedWardrobe?.rawSelectionText || null,
    swimwearReasoning: storedWardrobe?.swimwearReasoning || null,
    swimwearRawSelectionText: storedWardrobe?.swimwearRawSelectionText || null,
  };
}

function buildPartialPendingSnapshot(
  partialRegenerationJob,
  pendingImageSetIndexes,
  storedWardrobeFields,
) {
  return buildSnapshotPayload({
    status: "pending",
    pendingStage: "regenerate",
    pendingRegenerationUrls: getPendingRegenerationUrls(partialRegenerationJob),
    pendingImageSetIndexes,
    ...storedWardrobeFields,
  });
}

function buildExtrasPendingSnapshot(
  pendingImageSetIndexes,
  storedWardrobeFields,
) {
  return buildSnapshotPayload({
    status: "pending",
    pendingStage: "extras",
    hasPendingAdditionalItems: true,
    pendingImageSetIndexes,
    ...storedWardrobeFields,
  });
}

function buildFullPendingSnapshot(
  activeJob,
  fullRegenerationMarker,
  storedWardrobe,
  pendingImageSetIndexes,
  storedWardrobeFields,
) {
  const isPendingExtras = activeJob?.phase === "extras";
  return buildSnapshotPayload({
    status: "pending",
    pendingStage: isPendingExtras ? "extras" : "capsule",
    hasPendingAdditionalItems: isPendingExtras,
    pendingRegenerationUrls: isPendingExtras
      ? []
      : getWardrobeItemUrls(storedWardrobe),
    pendingImageSetIndexes,
    ...storedWardrobeFields,
  });
}

function buildReadySnapshot(pendingImageSetIndexes, storedWardrobeFields) {
  return buildSnapshotPayload({
    status: "ready",
    pendingImageSetIndexes,
    ...storedWardrobeFields,
  });
}

function isPartialRegenerationPending(partialRegenerationJob) {
  return (
    partialRegenerationJob?.status === "pending" ||
    partialRegenerationJob?.status === "queued" ||
    partialRegenerationJob?.status === "running"
  );
}

function isPartialRegenerationFailed(partialRegenerationJob) {
  return partialRegenerationJob?.status === "failed";
}

function isActiveExtrasPendingWithItems(activeJob, storedWardrobe) {
  return (
    isActiveJobPending(activeJob) &&
    activeJob.phase === "extras" &&
    Boolean(storedWardrobe?.items?.length)
  );
}

function isActiveJobPending(activeJob) {
  return (
    activeJob?.status === "pending" ||
    activeJob?.status === "queued" ||
    activeJob?.status === "running"
  );
}

function isActiveJobFailed(activeJob) {
  return activeJob?.status === "failed";
}

function isCapsulePending(activeJob, fullRegenerationMarker) {
  return (
    isActiveJobPending(activeJob) ||
    fullRegenerationMarker?.status === "pending"
  );
}

function hasStoredWardrobeItems(storedWardrobe) {
  return Boolean(storedWardrobe?.items?.length);
}

const CAPSULE_SNAPSHOT_BRANCHES = [
  {
    matches: ({ partialRegenerationJob }) =>
      isPartialRegenerationPending(partialRegenerationJob),
    build: ({
      partialRegenerationJob,
      pendingImageSetIndexes,
      storedWardrobeFields,
    }) =>
      buildPartialPendingSnapshot(
        partialRegenerationJob,
        pendingImageSetIndexes,
        storedWardrobeFields,
      ),
  },
  {
    matches: ({ partialRegenerationJob }) =>
      isPartialRegenerationFailed(partialRegenerationJob),
    build: ({ partialRegenerationJob, storedWardrobe }) =>
      buildFailedSnapshot(storedWardrobe, partialRegenerationJob.error),
  },
  {
    matches: ({ activeJob, storedWardrobe }) =>
      isActiveExtrasPendingWithItems(activeJob, storedWardrobe),
    build: ({ pendingImageSetIndexes, storedWardrobeFields }) =>
      buildExtrasPendingSnapshot(pendingImageSetIndexes, storedWardrobeFields),
  },
  {
    matches: ({ activeJob }) => isActiveJobFailed(activeJob),
    build: ({ activeJob, storedWardrobe }) =>
      buildFailedSnapshot(storedWardrobe, activeJob.error),
  },
  {
    matches: ({ activeJob, fullRegenerationMarker }) =>
      isCapsulePending(activeJob, fullRegenerationMarker),
    build: ({
      activeJob,
      fullRegenerationMarker,
      storedWardrobe,
      pendingImageSetIndexes,
      storedWardrobeFields,
    }) =>
      buildFullPendingSnapshot(
        activeJob,
        fullRegenerationMarker,
        storedWardrobe,
        pendingImageSetIndexes,
        storedWardrobeFields,
      ),
  },
  {
    matches: ({ storedWardrobe }) => hasStoredWardrobeItems(storedWardrobe),
    build: ({ pendingImageSetIndexes, storedWardrobeFields }) =>
      buildReadySnapshot(pendingImageSetIndexes, storedWardrobeFields),
  },
];

function buildCapsuleEventSnapshot(options: Record<string, unknown> = {}) {
  const {
    capsule = null,
    activeJob = null,
    partialRegenerationJob = null,
    outfitSetImageJob = null,
  } = options;
  const effectiveSnapshot = getEffectiveCapsuleSnapshot(
    capsule as CapsuleRecord | null,
  );
  const storedWardrobe = getStoredWardrobePayload({
    items: effectiveSnapshot?.data?.wardrobe,
  });
  const fullRegenerationMarker =
    getCapsuleSnapshotRegeneration(effectiveSnapshot);
  const pendingImageSetIndexes = getPendingImageSetIndexes(outfitSetImageJob);
  const storedWardrobeFields = getStoredWardrobeSnapshotFields(storedWardrobe);
  const branchContext = {
    activeJob,
    fullRegenerationMarker,
    partialRegenerationJob,
    pendingImageSetIndexes,
    storedWardrobe,
    storedWardrobeFields,
  };
  const branch = CAPSULE_SNAPSHOT_BRANCHES.find(({ matches }) =>
    matches(branchContext),
  );
  return branch ? branch.build(branchContext) : buildSnapshotPayload();
}

export { buildCapsuleEventSnapshot, getStoredWardrobePayload };
