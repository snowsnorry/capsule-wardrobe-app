import {
  buildProfileCapsuleContext,
  getEffectiveCapsuleSnapshot,
} from "../capsuleStore.js";

import { countItemsByKey, logWardrobeInfo } from "./ai.js";
import {
  buildStoredWardrobePayloadFromResult,
  isValidSelectedItemUrls,
  remapOutfitSetsAfterPartialRegeneration,
} from "./regenerateSelectedPrompt.js";
import { logError } from "../logger.js";
import type { PartialRegenerationJobState } from "./types.js";
import { getStoredWardrobePayload } from "./capsuleEvents.js";
import { throwIfAborted } from "./abortSignal.js";

const noopProgress = async (_update?: unknown) => undefined;

function publishPartialRegenerationSnapshot(
  deps,
  email,
  capsuleId,
  capsule,
  job,
) {
  deps.publishSnapshotImpl(
    email,
    capsuleId,
    deps.buildCapsuleEventSnapshotImpl({
      capsule,
      partialRegenerationJob: job,
    }),
  );
}

async function buildUpdatedCapsuleForPartialRegeneration({
  deps,
  email,
  capsuleId,
  capsule,
  payload,
}) {
  const baseSnapshot = getEffectiveCapsuleSnapshot(capsule);
  const snapshot = {
    filters: baseSnapshot?.filters,
    data: {
      wardrobe: payload,
      rejectedUrls: baseSnapshot?.data?.rejectedUrls || [],
      regeneration: baseSnapshot?.data?.regeneration || null,
    },
  };

  return capsuleId
    ? deps.updateCapsuleSnapshotImpl(email, capsuleId, snapshot)
    : { ...capsule, draft: snapshot };
}

async function runPartialRegenerationJob({
  deps,
  email,
  capsuleId,
  profile,
  capsule,
  selectedProducts,
  storedWardrobe,
  job,
  rethrowErrors = false,
  signal = null,
}) {
  const startedAt = job.startedAt;
  const jobLogContext = { capsuleRequestId: job.capsuleRequestId, startedAt };
  let currentCapsule = capsule;

  try {
    throwIfAborted(signal);
    const result = await deps.regenerateCapsuleWardrobeImpl(
      {
        ...buildProfileCapsuleContext(profile, capsule),
      },
      selectedProducts,
      jobLogContext,
      { signal },
    );
    throwIfAborted(signal);
    const payload = buildStoredWardrobePayloadFromResult(
      result,
      storedWardrobe,
    );
    payload.outfitSets = remapOutfitSetsAfterPartialRegeneration({
      currentItems: storedWardrobe?.items || [],
      nextItems: result?.items || [],
      pendingUrls: job.pendingItemUrls,
      outfitSets: storedWardrobe?.outfitSets || [],
    });
    currentCapsule = await buildUpdatedCapsuleForPartialRegeneration({
      deps,
      email,
      capsuleId,
      capsule,
      payload,
    });
    job.result = payload;
    job.status = "completed";
    job.phase = "completed";
    job.updatedAt = deps.nowMsImpl();
    logWardrobeInfo(
      "regenerate-total-completed",
      {
        totalDurationMs: deps.nowMsImpl() - startedAt,
        itemsTotal: payload.items.length,
        itemsByCategory: countItemsByKey(payload.items),
      },
      jobLogContext,
    );
  } catch (error) {
    job.status = "failed";
    job.phase = "failed";
    job.updatedAt = deps.nowMsImpl();
    job.error = error;
    logError("[wardrobe-ai][regenerate-selected]", error);
    if (rethrowErrors) {
      throw error;
    }
  } finally {
    publishPartialRegenerationSnapshot(
      deps,
      email,
      capsuleId,
      currentCapsule,
      job,
    );
  }
}

function getSelectedProductsFromWardrobe(storedWardrobe, itemUrls: string[]) {
  const storedItemsByUrl = new Map(
    (storedWardrobe?.items || [])
      .filter((item) => item && typeof item === "object")
      .map((item) => [String(item.url || "").trim(), item])
      .filter(([itemUrl]) => itemUrl),
  );
  return itemUrls
    .map((itemUrl) => storedItemsByUrl.get(itemUrl))
    .filter(Boolean);
}

function hasSelectedAnchorProducts(effectiveSnapshot, selectedProducts) {
  const anchorRefs = Array.isArray(effectiveSnapshot?.filters?.anchorItemRefs)
    ? effectiveSnapshot.filters.anchorItemRefs
    : [];
  const anchorRefSet = new Set(
    anchorRefs
      .map((ref) => {
        const source = ref?.source === "uploaded" ? "uploaded" : "from_catalog";
        const url = String(ref?.url || "").trim();
        return url ? `${source}\u0000${url}` : "";
      })
      .filter(Boolean),
  );

  if (anchorRefSet.size === 0) {
    return false;
  }

  return selectedProducts.some((item) => {
    const source = item?.source === "uploaded" ? "uploaded" : "from_catalog";
    const url = String(item?.url || "").trim();
    return url && anchorRefSet.has(`${source}\u0000${url}`);
  });
}

function getNextRejectedUrls(effectiveSnapshot, itemUrls: string[]) {
  return [
    ...new Set(
      [
        ...(Array.isArray(effectiveSnapshot?.data?.rejectedUrls)
          ? effectiveSnapshot.data.rejectedUrls
          : []),
        ...itemUrls,
      ]
        .map((itemUrl) => String(itemUrl || "").trim())
        .filter(Boolean),
    ),
  ];
}

function buildPartialWardrobePayload(storedWardrobe, itemUrls: string[]) {
  const selectedItemUrlSet = new Set(itemUrls);
  return {
    items: storedWardrobe.items.filter(
      (item) => !selectedItemUrlSet.has(String(item?.url || "").trim()),
    ),
    outfitSets: storedWardrobe.outfitSets || [],
    rawSelectionText: storedWardrobe.rawSelectionText || null,
    swimwearReasoning: storedWardrobe.swimwearReasoning || null,
    swimwearRawSelectionText: storedWardrobe.swimwearRawSelectionText || null,
  };
}

function buildCodedError(code: string) {
  const error = new Error(code) as Error & { code?: string };
  error.code = code;
  return error;
}

async function preparePersistedPartialRegenerationJob(deps, input) {
  const { capsuleId, email, itemUrls } = input;
  const normalizedItemUrls = Array.isArray(itemUrls)
    ? itemUrls.map((itemUrl) => String(itemUrl || "").trim()).filter(Boolean)
    : [];
  if (!capsuleId || !isValidSelectedItemUrls(normalizedItemUrls)) {
    throw buildCodedError("invalid_payload");
  }

  const [profile, capsule] = await Promise.all([
    deps.getProfileImpl(email),
    deps.getCapsuleImpl(email, capsuleId),
  ]);
  if (!capsule) {
    throw buildCodedError("not_found");
  }

  const effectiveSnapshot = getEffectiveCapsuleSnapshot(capsule);
  const storedWardrobe = getStoredWardrobePayload({
    items: effectiveSnapshot?.data?.wardrobe,
  });
  if (!storedWardrobe?.items?.length) {
    throw buildCodedError("not_found");
  }

  const selectedProducts = getSelectedProductsFromWardrobe(
    storedWardrobe,
    normalizedItemUrls,
  );
  if (
    selectedProducts.length !== normalizedItemUrls.length ||
    hasSelectedAnchorProducts(effectiveSnapshot, selectedProducts)
  ) {
    throw buildCodedError("invalid_payload");
  }

  return {
    capsule,
    effectiveSnapshot,
    normalizedItemUrls,
    partialPayload: buildPartialWardrobePayload(
      storedWardrobe,
      normalizedItemUrls,
    ),
    profile,
    selectedProducts,
    storedWardrobe,
  };
}

export async function runPersistedPartialRegenerationJobForService(
  deps,
  { email, capsuleId, itemUrls, signal = null, updateProgress = noopProgress },
) {
  const prepared = await preparePersistedPartialRegenerationJob(deps, {
    capsuleId,
    email,
    itemUrls,
  });
  const generationCapsule =
    (await deps.updateCapsuleSnapshotImpl(email, capsuleId, {
      filters: prepared.effectiveSnapshot?.filters,
      data: {
        wardrobe: prepared.partialPayload,
        rejectedUrls: getNextRejectedUrls(
          prepared.effectiveSnapshot,
          prepared.normalizedItemUrls,
        ),
        regeneration: prepared.effectiveSnapshot?.data?.regeneration || null,
      },
    })) || prepared.capsule;
  const startedAt = deps.nowMsImpl();
  const job: PartialRegenerationJobState = {
    capsuleRequestId: deps.randomUuidImpl(),
    status: "pending",
    phase: "regenerate",
    startedAt,
    updatedAt: startedAt,
    pendingItemUrls: prepared.normalizedItemUrls,
    result: null,
    promise: null,
  };
  publishPartialRegenerationSnapshot(
    deps,
    email,
    capsuleId,
    generationCapsule,
    job,
  );
  await updateProgress({
    phase: "regenerate",
    current: 0,
    label: "Regenerating selected items",
  });
  await runPartialRegenerationJob({
    deps,
    email,
    capsuleId,
    profile: prepared.profile,
    capsule: generationCapsule,
    selectedProducts: prepared.selectedProducts,
    storedWardrobe: prepared.storedWardrobe,
    job,
    rethrowErrors: true,
    signal,
  });
  return { capsuleId, itemUrls: prepared.normalizedItemUrls };
}
