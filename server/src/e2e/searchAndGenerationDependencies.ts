import { normalizeCapsuleId } from "./capsuleState.js";
import {
  buildE2eCapsule,
  buildE2eRegeneratedWardrobe,
  buildE2eSearchOptions,
  buildE2eSearchPayload,
  buildE2eSearchStats,
  buildE2eWardrobeItems,
} from "./fixtures.js";
import {
  buildSearchResultItems,
  type E2eSearchDelayState,
} from "./searchState.js";
import type { E2eCapsuleMemory } from "./capsuleState.js";
import type { E2eGenerationMemory } from "./generationState.js";
import type { E2eSelectedRegenerationMemory } from "./selectedRegenerationState.js";
import {
  getEffectiveCapsuleSnapshot,
  normalizeCapsuleSnapshot,
  type NormalizedCapsuleRecord,
} from "../capsuleStoreModel.js";
import type { WardrobeUiItemLike } from "../ai/types.js";

type E2eSearchAndGenerationState = {
  scenario: string;
  capsuleMemory: E2eCapsuleMemory;
  capsules: Map<string, NormalizedCapsuleRecord>;
  savedSearch: unknown;
  searchDelay: E2eSearchDelayState;
  generationMemory: E2eGenerationMemory;
  selectedRegenerationMemory: E2eSelectedRegenerationMemory;
  nextOutfitImageUrl: (capsuleId: unknown, setIndex: number) => string;
};

function parseSetIndex(value: unknown): number {
  return Number.parseInt(String(value ?? ""), 10);
}

function applyReadyWardrobeFixture(
  state: E2eSearchAndGenerationState,
  capsuleId: unknown,
) {
  const normalizedCapsuleId = normalizeCapsuleId(capsuleId);
  const capsule = state.capsuleMemory.get(normalizedCapsuleId);
  const baseSnapshot =
    getEffectiveCapsuleSnapshot(capsule) ||
    normalizeCapsuleSnapshot(buildE2eCapsule().draft);
  if (!baseSnapshot) return null;

  return state.capsuleMemory.update(
    normalizedCapsuleId,
    normalizeCapsuleSnapshot({
      filters: baseSnapshot.filters,
      data: {
        wardrobe: buildE2eRegeneratedWardrobe(),
        rejectedUrls: [],
        regeneration: null,
      },
    }),
  );
}

function selectedRegenerationHandler(state: E2eSearchAndGenerationState) {
  return async (req, res) => {
    const selectedItemUrls = Array.isArray(req.body?.itemUrls)
      ? req.body.itemUrls
      : [];
    const capsuleId = normalizeCapsuleId(req.params?.id);
    const result = state.capsuleMemory.regenerateSelectedItems(
      capsuleId,
      selectedItemUrls,
    );
    if (result.status === "missing-capsule") {
      return res.status(404).json({ error: "not_found" });
    }
    if (result.status === "missing-wardrobe") {
      return res.status(404).json({ error: "not_found" });
    }
    if (result.status === "invalid-selection") {
      return res.status(400).json({ error: "invalid_payload" });
    }

    state.selectedRegenerationMemory.recordCompletedJob({
      email: req.user?.email,
      capsuleId,
      pendingItemUrls: result.selectedItemUrls,
      items: result.items as WardrobeUiItemLike[],
    });

    return res.status(202).json({
      ok: true,
      status: "pending",
      pendingStage: "regenerate",
    });
  };
}

function streamCapsuleEventsImpl(state: E2eSearchAndGenerationState) {
  return async (_req, res, { email, capsuleId, snapshot }) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    state.generationMemory.subscribe({ email, capsuleId, res, snapshot });
  };
}

function regenerateCapsuleWardrobeHandler(state: E2eSearchAndGenerationState) {
  return async (req, res) => {
    const capsuleId = normalizeCapsuleId(req.params?.id);
    const failure = state.generationMemory.consumeFailureOnce();
    if (failure) {
      return res.status(503).json({
        error: "service_unavailable",
        rawSelectionText: null,
      });
    }

    const shouldUseReadyFixture =
      state.generationMemory.consumeRetryReadyOnce();
    if (state.generationMemory.mode === "pending") {
      const job = state.generationMemory.createPendingWardrobeJob({
        capsuleMemory: state.capsuleMemory,
        capsuleId,
        email: req.user?.email,
      });
      if (!job) return res.status(404).json({ error: "not_found" });

      return res.status(202).json({
        ok: true,
        status: "pending",
        pendingStage: "capsule",
        hasPendingAdditionalItems: false,
      });
    }

    if (shouldUseReadyFixture) {
      const capsule = applyReadyWardrobeFixture(state, capsuleId);
      if (!capsule) return res.status(404).json({ error: "not_found" });
      return res.json({
        ok: true,
        status: "ready",
        items: buildE2eRegeneratedWardrobe().items,
      });
    }

    const capsule = state.capsules.get(capsuleId);
    if (capsule?.draft && typeof capsule.draft === "object") {
      state.capsules.set(String(capsule.id), {
        ...capsule,
        draft: {
          ...capsule.draft,
          data: {
            wardrobe: buildE2eCapsule().draft.data.wardrobe,
            rejectedUrls: [],
          },
        },
      });
    }
    return res.json({
      ok: true,
      status: "ready",
      items: buildE2eWardrobeItems(),
    });
  };
}

function generateOutfitSetImageHandler(state: E2eSearchAndGenerationState) {
  return async (req, res) => {
    const capsuleId = normalizeCapsuleId(req.params?.id);
    const setIndex = parseSetIndex(req.params?.setIndex);
    if (!Number.isInteger(setIndex) || setIndex < 0) {
      return res.status(400).json({ error: "invalid_payload" });
    }

    const image = state.nextOutfitImageUrl(capsuleId, setIndex);
    const result = state.capsuleMemory.setOutfitSetImage(
      capsuleId,
      setIndex,
      image,
    );
    if (result.status !== "updated") {
      return res.status(404).json({ error: "not_found" });
    }

    return res.json({ ok: true, status: "ready", image: result.image });
  };
}

function deleteOutfitSetImageHandler(state: E2eSearchAndGenerationState) {
  return async (req, res) => {
    const setIndex = parseSetIndex(req.params?.setIndex);
    if (!Number.isInteger(setIndex) || setIndex < 0) {
      return res.status(400).json({ error: "invalid_payload" });
    }

    const result = state.capsuleMemory.setOutfitSetImage(
      req.params?.id,
      setIndex,
      null,
    );
    if (result.status !== "updated") {
      return res.status(404).json({ error: "not_found" });
    }

    return res.json({ ok: true, status: "ready" });
  };
}

export function searchAndGenerationDependencies(
  state: E2eSearchAndGenerationState,
) {
  return {
    checkDatabaseConnectionImpl: async () => {},
    getSearchOptionsImpl: async () => buildE2eSearchOptions(),
    getSavedSearchImpl: async () => state.savedSearch,
    getSearchStatsImpl: async (_email, payload) =>
      state.scenario === "with-non-empty-stats"
        ? buildE2eSearchStats(payload)
        : { total: 0, stats: {}, priceBuckets: [] },
    runSavedSearchImpl: async (_email, payload) => {
      const savedSearch = buildE2eSearchPayload(payload);
      state.savedSearch = savedSearch;
      const requestOrder = await state.searchDelay.waitForGate(savedSearch);
      const items = buildSearchResultItems(savedSearch).map((item) => ({
        ...item,
        imageUrl: item.image_url,
      }));
      state.searchDelay.completeRequest(requestOrder);
      return { items, total: items.length, savedSearch };
    },
    getOutfitSetImageJobImpl: () => null,
    getPartialRegenerationJobImpl: (email, capsuleId) =>
      state.selectedRegenerationMemory.getJob(email, capsuleId),
    getWardrobeJobImpl: (email, capsuleId) =>
      state.generationMemory.getJob(email, capsuleId),
    streamCapsuleEventsImpl: streamCapsuleEventsImpl(state),
    regenerateCapsuleWardrobeHandler: regenerateCapsuleWardrobeHandler(state),
    regenerateSelectedCapsuleItemsHandler: selectedRegenerationHandler(state),
    generateOutfitSetImageHandler: generateOutfitSetImageHandler(state),
    deleteOutfitSetImageHandler: deleteOutfitSetImageHandler(state),
    buildWardrobePdfInChildImpl: async () => Buffer.from("e2e-pdf"),
    getProductsByUrlsInOrderImpl: async () => buildE2eWardrobeItems(),
  };
}
