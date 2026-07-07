import { deepClone } from "./capsuleState.js";
import { buildE2eCapsule } from "./fixtures.js";
import { buildE2eCapsuleReport } from "./capsuleReportMock.js";
import type { E2eState } from "./stateModel.js";

export function capsuleDependencies(state: E2eState) {
  return {
    resolveActiveCapsuleImpl: async () => null,
    listRecentCapsulesImpl: async (_email, limit = 10, offset = 0) =>
      state.capsuleMemory.list(limit, offset),
    countCapsulesImpl: async () => state.capsuleMemory.list(1000).length,
    searchCapsulesImpl: async (_email, query, limit = 25) =>
      state.capsuleMemory.search(query, limit),
    getCapsuleImpl: async (_email, id) => state.capsuleMemory.get(id),
    createCapsuleImpl: async (_email, payload) => {
      const capsule = state.capsuleMemory.create({
        name: payload?.name || "Playwright new capsule",
        draft: payload?.draft ?? buildE2eCapsule().draft,
        saved: payload?.saved ?? null,
      });
      return capsule;
    },
    setActiveCapsuleIdImpl: async () => deepClone(state.profile),
    updateCapsuleSnapshotImpl: async (_email, id, draft) =>
      state.capsuleMemory.update(id, draft),
    saveCapsuleImpl: async (_email, id) => state.capsuleMemory.save(id),
    revertCapsuleImpl: async (_email, id) => state.capsuleMemory.revert(id),
    renameCapsuleImpl: async (_email, id, name) =>
      state.capsuleMemory.rename(id, name),
    duplicateCapsuleImpl: async (_email, id, name) => {
      return state.capsuleMemory.duplicate(id, name);
    },
    deleteCapsuleImpl: async (_email, id) => state.capsuleMemory.delete(id),
    generateCapsuleReportImpl: async (_email, id) => {
      state.capsuleReportCounter += 1;
      const report = buildE2eCapsuleReport(state.capsuleReportCounter);
      const capsule = state.capsuleMemory.setReport(id, report);
      if (!capsule) {
        const error = new Error("not_found") as Error & { code?: string };
        error.code = "not_found";
        throw error;
      }
      return report;
    },
    updateCapsuleReportImpl: async (_email, id, report) =>
      state.capsuleMemory.setReport(id, report),
    createCapsuleShareImpl: async (email, capsuleId, clientOrigin) =>
      state.shareMemory.createFromCapsule({
        capsuleId,
        capsuleMemory: state.capsuleMemory,
        clientOrigin,
      }),
    getSharedCapsuleImpl: async (id) => state.shareMemory.getById(id),
    getSharedCapsuleOgMetadataImpl: async (id) =>
      state.getShareOgMetadataById(id),
    importSharedCapsuleImpl: async (email, id) =>
      state.shareMemory.importAsCapsule({
        capsuleMemory: state.capsuleMemory,
        id,
      }),
  };
}
