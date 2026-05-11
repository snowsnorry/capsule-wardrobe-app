import { normalizeCapsuleId } from "./capsuleState.js";
import {
  buildE2eCapsule,
  buildE2eSearchOptions,
  buildE2eSearchPayload,
  buildE2eSearchStats,
  buildE2eWardrobeItems,
} from "./fixtures.js";
import { buildSearchResultItems } from "./searchState.js";
import type { E2eState } from "./state.js";
import type { WardrobeUiItemLike } from "../ai/types.js";

function parseSetIndex(value: unknown): number {
  return Number.parseInt(String(value ?? ""), 10);
}

function selectedRegenerationHandler(state: E2eState) {
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

export function searchAndGenerationDependencies(state: E2eState) {
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
    getWardrobeJobImpl: () => null,
    streamCapsuleEventsImpl: async (_req, res, { snapshot }) => {
      res.setHeader("Content-Type", "text/event-stream");
      res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);
      res.end();
    },
    regenerateCapsuleWardrobeHandler: async (req, res) => {
      const capsule = state.capsules.get(normalizeCapsuleId(req.params?.id));
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
    },
    regenerateSelectedCapsuleItemsHandler: selectedRegenerationHandler(state),
    generateOutfitSetImageHandler: async (req, res) => {
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
    },
    deleteOutfitSetImageHandler: async (req, res) => {
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
    },
    buildWardrobePdfInChildImpl: async () => Buffer.from("e2e-pdf"),
    getProductsByUrlsInOrderImpl: async () => buildE2eWardrobeItems(),
  };
}
