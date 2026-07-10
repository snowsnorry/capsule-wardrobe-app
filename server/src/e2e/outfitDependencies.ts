import { buildE2eWardrobeItems, e2eImageUrl } from "./fixtures.js";
import { buildE2eOutfitReport } from "./outfitReportMock.js";
import type { E2eState } from "./stateModel.js";

function createE2eGenerateOutfitImageHandler(state: E2eState) {
  return async (req, res) => {
    const outfitId = String(req.params?.id || "").trim();
    const image = e2eImageUrl(
      `generated-saved-outfit-${outfitId}-${state.outfitImageCounter + 1}`,
    );
    state.outfitImageCounter += 1;
    const outfit = state.outfitMemory.setImage(outfitId, image, false);
    if (!outfit) {
      return res.status(404).json({ error: "not_found" });
    }
    return res.json({ ok: true, status: "ready", image });
  };
}

async function runE2eOutfitImageGenerationJob(
  state: E2eState,
  outfitId: unknown,
) {
  const normalizedOutfitId = String(outfitId || "").trim();
  const image = e2eImageUrl(
    `generated-saved-outfit-${normalizedOutfitId}-${state.outfitImageCounter + 1}`,
  );
  state.outfitImageCounter += 1;
  const outfit = state.outfitMemory.setImage(normalizedOutfitId, image, false);
  if (!outfit) {
    const error = new Error("not_found") as Error & { code?: string };
    error.code = "not_found";
    throw error;
  }
  return { outfitId: normalizedOutfitId };
}

export function outfitDependencies(state: E2eState) {
  return {
    listRecentOutfitsImpl: async (_email, limit = 10, offset = 0) =>
      state.outfitMemory.list(limit, offset),
    countOutfitsImpl: async () => state.outfitMemory.list(1000).length,
    searchOutfitsImpl: async (_email, query, limit = 25) =>
      state.outfitMemory.search(query, limit),
    getOutfitImpl: async (_email, id) => state.outfitMemory.get(id),
    createOutfitImpl: async (_email, payload) =>
      state.outfitMemory.create({
        name: payload?.name || undefined,
        draft: payload?.draft ?? { items: [] },
        saved: payload?.saved ?? null,
      }),
    updateOutfitSnapshotImpl: async (_email, id, draft) =>
      state.outfitMemory.update(id, draft),
    saveOutfitImpl: async (_email, id) => state.outfitMemory.save(id),
    revertOutfitImpl: async (_email, id) => state.outfitMemory.revert(id),
    renameOutfitImpl: async (_email, id, name) =>
      state.outfitMemory.rename(id, name),
    duplicateOutfitImpl: async (_email, id, name) =>
      state.outfitMemory.duplicate(id, name),
    setOutfitPinImpl: async (_email, id, pin) =>
      state.outfitMemory.setPin(id, Boolean(pin)),
    deleteOutfitImpl: async (_email, id) => state.outfitMemory.delete(id),
    generateOutfitImageHandler: createE2eGenerateOutfitImageHandler(state),
    runOutfitImageGenerationJobImpl: async ({ outfitId }) =>
      runE2eOutfitImageGenerationJob(state, outfitId),
    deleteOutfitImageHandler: async (req, res) => {
      const outfit = state.outfitMemory.setImage(req.params?.id, null, false);
      if (!outfit) {
        return res.status(404).json({ error: "not_found" });
      }
      return res.json({ ok: true, status: "ready" });
    },
    generateOutfitReportImpl: async (_email, outfitId) => {
      const normalizedOutfitId = String(outfitId || "").trim();
      const report = buildE2eOutfitReport(normalizedOutfitId);
      const outfit = state.outfitMemory.setReport(outfitId, report);
      if (!outfit) {
        const error = new Error("not_found") as Error & { code?: string };
        error.code = "not_found";
        throw error;
      }
      return report;
    },
    updateOutfitReportImpl: async (_email, outfitId, report) =>
      state.outfitMemory.setReport(outfitId, report),
    getOutfitImageJobImpl: async () => null,
    getProductsByUrlsForEmailImpl: async (payload) => {
      const urls = new Set(
        Array.isArray(payload?.urls)
          ? payload.urls.map((url) => String(url || "").trim())
          : [],
      );
      return buildE2eWardrobeItems()
        .filter((item) => urls.has(String(item.url || "").trim()))
        .map((item) => ({ ...item, source: "from_catalog" }));
    },
    listWardrobeItemsByUrlsImpl: async (payload) => {
      const urls = new Set(
        Array.isArray(payload?.urls)
          ? payload.urls.map((url) => String(url || "").trim())
          : [],
      );
      const itemMatchesRequestedUrl = (item: Record<string, unknown>) => {
        const itemUrl = String(item?.url || "").trim();
        const uploadedRefUrl =
          payload?.source === "uploaded" && item?.id
            ? `wardrobe://${String(item.id).trim()}`
            : "";
        return Boolean(
          urls.has(itemUrl) || (uploadedRefUrl && urls.has(uploadedRefUrl)),
        );
      };
      return state.wardrobeMemory
        .listItems(payload?.source)
        .filter(itemMatchesRequestedUrl);
    },
  };
}
