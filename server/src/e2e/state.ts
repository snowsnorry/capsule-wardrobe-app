import { deepClone } from "./capsuleState.js";
import { authDependencies } from "./authDependencies.js";
import { capsuleDependencies } from "./capsuleDependencies.js";
import { buildE2ePasskeyDependencies, e2eImageUrl } from "./fixtures.js";
import { createE2eJobDependencies } from "./jobState.js";
import { outfitDependencies } from "./outfitDependencies.js";
import { buildE2ePersonalItemsReport } from "./personalItemsReportState.js";
import { profileDependencies } from "./profileDependencies.js";
import { searchAndGenerationDependencies } from "./searchAndGenerationDependencies.js";
import { e2eState } from "./stateModel.js";
import { createE2eWardrobeDependencies } from "./wardrobeState.js";
import { annotateLikedItems } from "../routes/likedItemsRoutes.js";
import { processQueuedWardrobeFileUploadImpl } from "../routes/wardrobeFileUploadRoute.js";
import { processQueuedWardrobeUrlUpload } from "../routes/wardrobeUrlUploadRoute.js";
import type { E2eState } from "./stateModel.js";

export { e2eState };
export type { E2eScenario } from "./stateTypes.js";

export function createE2eDependencies(state: E2eState = e2eState) {
  const deps = {
    ...authDependencies(state),
    ...profileDependencies(state),
    ...capsuleDependencies(state),
    ...outfitDependencies(state),
    ...searchAndGenerationDependencies(state),
    ...createE2eWardrobeDependencies(state.wardrobeMemory),
    ...buildE2ePasskeyDependencies(),
    deletePersonalItemsReportImpl: async () => {
      const removed = Boolean(state.personalItemsReport);
      state.personalItemsReport = null;
      return removed;
    },
    generatePersonalItemsReportImpl: async () => {
      const items = state.wardrobeMemory.listItems(null) as Array<
        Record<string, unknown>
      >;
      if (items.length === 0) {
        const error = new Error("not_found") as Error & {
          code?: string;
          suppressJobHandlerLog?: boolean;
        };
        error.code = "not_found";
        error.suppressJobHandlerLog = true;
        throw error;
      }

      state.personalItemsReportCounter += 1;
      const snapshot = buildE2ePersonalItemsReport(
        items,
        state.personalItemsReportCounter,
      );
      state.personalItemsReport = snapshot;
      return deepClone(snapshot);
    },
    getPersonalItemsReportImpl: async () =>
      state.personalItemsReport ? deepClone(state.personalItemsReport) : null,
    createUploadedWardrobeItemEmbeddingImpl: async () => [0.1, 0.2, 0.3],
    deleteR2ObjectsImpl: async (payload) => ({
      deleted: Array.isArray(payload?.keys) ? payload.keys.length : 0,
    }),
    copyImageObjectToR2Impl: async () => ({
      key: "e2e/copied-saved-outfit.svg",
      url: e2eImageUrl("copied-saved-outfit"),
      digest: "e2e",
    }),
    uploadImageToR2Impl: async () => ({
      key: "e2e/uploaded-saved-outfit.svg",
      url: e2eImageUrl("uploaded-saved-outfit"),
      digest: "e2e",
    }),
    annotateLikedItems,
    clearAccountTransientStateImpl: async () => {},
    listUploadedWardrobeR2KeysImpl: async () => [],
  };
  const queuedDeps = {
    ...deps,
    processQueuedWardrobeFileUploadImpl: (input) =>
      processQueuedWardrobeFileUploadImpl({ context: deps, ...input }),
    processQueuedWardrobeUrlUploadImpl: (input) =>
      processQueuedWardrobeUrlUpload({ context: deps, ...input }),
  };
  const jobDependencies = createE2eJobDependencies(queuedDeps);
  state.jobControls = jobDependencies.controls;
  return {
    ...queuedDeps,
    ...jobDependencies,
  };
}
