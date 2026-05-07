import {
  buildProfileCapsuleContext,
  getEffectiveCapsuleSnapshot,
} from "../capsuleStore.js";
import { createPartialRegenerationJobKey } from "./partialRegenerationJobs.js";
import { isNoLlmProfileEnabled } from "./llm.js";
import { logWardrobeInfo } from "./ai.js";
import { getStoredWardrobePayload } from "./capsuleEvents.js";
import { isValidSelectedItemUrls } from "./regenerateSelectedPrompt.js";
import { publishPartialRegenerationSnapshot } from "./regenerateSelectedServiceJobs.js";
import { logError } from "../logger.js";

function getPartialRegenerationRequest(req) {
  return {
    capsuleId: String(req.params?.id || "").trim(),
    email: req.user.email,
    itemUrls: Array.isArray(req.body?.itemUrls)
      ? req.body.itemUrls
          .map((itemUrl) => String(itemUrl || "").trim())
          .filter(Boolean)
      : [],
  };
}

function clearFinishedPartialJob(deps, email, capsuleId, activeJob) {
  if (activeJob?.status === "completed" || activeJob?.status === "failed") {
    deps.jobs.delete(createPartialRegenerationJobKey(email, capsuleId));
  }
}

function getSelectedProductsFromWardrobe(storedWardrobe, itemUrls) {
  const storedItemsByUrl = new Map(
    storedWardrobe.items
      .filter((item) => item && typeof item === "object")
      .map((item) => [String(item.url || "").trim(), item])
      .filter(([itemUrl]) => itemUrl),
  );
  return itemUrls
    .map((itemUrl) => storedItemsByUrl.get(itemUrl))
    .filter(Boolean);
}

function getNextRejectedUrls(effectiveSnapshot, itemUrls) {
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

function buildPartialWardrobePayload(storedWardrobe, itemUrls) {
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

function buildPartialGenerationCapsule(
  capsule,
  effectiveSnapshot,
  partialPayload,
  nextRejectedUrls,
) {
  return {
    ...capsule,
    draft: {
      filters: effectiveSnapshot?.filters,
      data: {
        wardrobe: partialPayload,
        rejectedUrls: nextRejectedUrls,
        regeneration: effectiveSnapshot?.data?.regeneration || null,
      },
    },
  };
}

async function updatePartialRegenerationSnapshot({
  deps,
  email,
  capsuleId,
  effectiveSnapshot,
  partialPayload,
  nextRejectedUrls,
}) {
  await deps.updateCapsuleSnapshotImpl(email, capsuleId, {
    filters: effectiveSnapshot?.filters,
    data: {
      wardrobe: partialPayload,
      rejectedUrls: nextRejectedUrls,
      regeneration: effectiveSnapshot?.data?.regeneration || null,
    },
  });
}

function sendStoredWardrobeValidationError(res, itemUrls, storedWardrobe) {
  if (!isValidSelectedItemUrls(itemUrls)) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  if (!storedWardrobe?.items?.length) {
    return res.status(404).json({ error: "not_found" });
  }

  return null;
}

function sendPendingRegenerationResponse(res) {
  return res.status(202).json({
    ok: true,
    status: "pending",
    pendingStage: "regenerate",
  });
}

export function createRegenerateSelectedWardrobeItems(
  deps,
  getPartialRegenerationJob,
  startPartialRegenerationJob,
) {
  return async function regenerateSelectedWardrobeItems(req, res) {
    try {
      const { email, capsuleId, itemUrls } = getPartialRegenerationRequest(req);
      const profile = await deps.getProfileImpl(email);
      if (!capsuleId) {
        return res.status(400).json({ error: "invalid_payload" });
      }
      const capsule = await deps.getCapsuleImpl(email, capsuleId);
      if (!capsule) {
        return res.status(404).json({ error: "not_found" });
      }
      const activeJob = getPartialRegenerationJob(email, capsuleId);
      if (activeJob?.status === "pending") {
        return sendPendingRegenerationResponse(res);
      }
      clearFinishedPartialJob(deps, email, capsuleId, activeJob);
      const effectiveSnapshot = getEffectiveCapsuleSnapshot(capsule);
      const storedWardrobe = getStoredWardrobePayload({
        items: effectiveSnapshot?.data?.wardrobe,
      });
      const validationResponse = sendStoredWardrobeValidationError(
        res,
        itemUrls,
        storedWardrobe,
      );
      if (validationResponse) {
        return validationResponse;
      }
      const selectedProducts = getSelectedProductsFromWardrobe(
        storedWardrobe,
        itemUrls,
      );
      if (selectedProducts.length !== itemUrls.length) {
        return res.status(400).json({ error: "invalid_payload" });
      }
      const nextRejectedUrls = getNextRejectedUrls(effectiveSnapshot, itemUrls);
      const partialPayload = buildPartialWardrobePayload(
        storedWardrobe,
        itemUrls,
      );
      await updatePartialRegenerationSnapshot({
        deps,
        email,
        capsuleId,
        effectiveSnapshot,
        partialPayload,
        nextRejectedUrls,
      });
      const generationCapsule = buildPartialGenerationCapsule(
        capsule,
        effectiveSnapshot,
        partialPayload,
        nextRejectedUrls,
      );
      const generationProfile = buildProfileCapsuleContext(
        profile,
        generationCapsule,
      );
      const logContext = {
        capsuleRequestId: deps.randomUuidImpl(),
        source: "partial-regeneration",
      };
      logWardrobeInfo(
        "regenerate-request-received",
        {
          itemUrls,
          noLlm: isNoLlmProfileEnabled(generationProfile) || undefined,
        },
        logContext,
      );
      const job = startPartialRegenerationJob(
        email,
        capsuleId,
        profile,
        generationCapsule,
        selectedProducts,
        storedWardrobe,
        logContext,
      );
      publishPartialRegenerationSnapshot(
        deps,
        email,
        capsuleId,
        generationCapsule,
        job,
      );
      return sendPendingRegenerationResponse(res);
    } catch (error) {
      logError("[wardrobe-ai][regenerate-selected]", error);
      return res.status(503).json({ error: "service_unavailable" });
    }
  };
}
