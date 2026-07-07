import {
  deepClone,
  E2eCapsuleMemory,
  normalizeCapsuleId,
} from "./capsuleState.js";
import {
  buildE2eCapsule,
  buildE2ePasskeyDependencies,
  buildE2eEmptyWardrobeCapsule,
  buildE2eSearchPayload,
  buildE2eProfile,
  buildE2eWardrobeItems,
  buildE2eSavedSearchPayload,
  e2eImageUrl,
  E2E_CODE,
  E2E_EMAIL,
} from "./fixtures.js";
import { E2eGenerationMemory } from "./generationState.js";
import { buildE2eOutfitReport } from "./outfitReportMock.js";
import { E2eOutfitMemory } from "./outfitState.js";
import { E2eSearchDelayState } from "./searchState.js";
import { searchAndGenerationDependencies } from "./searchAndGenerationDependencies.js";
import { E2eSelectedRegenerationMemory } from "./selectedRegenerationState.js";
import { E2eShareMemory } from "./shareState.js";
import {
  createE2eWardrobeDependencies,
  E2eWardrobeMemory,
} from "./wardrobeState.js";
import { createE2eJobDependencies } from "./jobState.js";
import { annotateLikedItems } from "../routes/likedItemsRoutes.js";
import { processQueuedWardrobeFileUploadImpl } from "../routes/wardrobeFileUploadRoute.js";
import { processQueuedWardrobeUrlUpload } from "../routes/wardrobeUrlUploadRoute.js";

export type E2eScenario =
  | "with-profile"
  | "no-profile"
  | "with-saved-search"
  | "with-non-empty-stats"
  | "empty-wardrobe";

type E2eSession = {
  email: string;
  csrfToken: string;
  createdAt: number;
  expiresAt: number;
};
type E2ePersonalItemsReportSnapshot = {
  generatedAt: string;
  personalItemUrls: string[];
  report: Record<string, unknown>;
};

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function buildSession(sessionId: string, email: string): E2eSession {
  const createdAt = Date.now();
  return {
    email,
    csrfToken: `csrf-${sessionId}`,
    createdAt,
    expiresAt: createdAt + SESSION_TTL_MS,
  };
}

class E2eState {
  scenario: E2eScenario = "with-profile";
  sessions = new Map<string, E2eSession>();
  profile: Record<string, unknown> | null = buildE2eProfile();
  capsuleMemory = new E2eCapsuleMemory();
  outfitMemory = new E2eOutfitMemory();
  shareMemory = new E2eShareMemory();
  savedSearch = buildE2eSearchPayload();
  loginCodes = new Map<string, string>();
  sessionCounter = 0;
  outfitImageCounter = 0;
  wardrobeMemory = new E2eWardrobeMemory();
  selectedRegenerationMemory = new E2eSelectedRegenerationMemory();
  searchDelay = new E2eSearchDelayState();
  generationMemory = new E2eGenerationMemory();
  personalItemsReport: E2ePersonalItemsReportSnapshot | null = null;
  personalItemsReportCounter = 0;

  get capsules() {
    return this.capsuleMemory.capsules;
  }

  reset(scenario: E2eScenario = "with-profile") {
    this.scenario = scenario;
    this.sessions.clear();
    this.loginCodes.clear();
    this.sessionCounter = 0;
    this.shareMemory.reset();
    this.outfitImageCounter = 0;
    this.wardrobeMemory.reset();
    this.selectedRegenerationMemory.reset();
    this.searchDelay.clear();
    this.generationMemory.reset();
    this.personalItemsReport = null;
    this.personalItemsReportCounter = 0;
    this.outfitMemory.reset();
    this.capsuleMemory.reset(
      scenario === "empty-wardrobe"
        ? buildE2eEmptyWardrobeCapsule()
        : undefined,
    );
    this.profile = scenario === "no-profile" ? null : buildE2eProfile();
    this.savedSearch =
      scenario === "with-saved-search"
        ? buildE2eSavedSearchPayload()
        : buildE2eSearchPayload();
  }

  createSession(email = E2E_EMAIL) {
    this.sessionCounter += 1;
    const sessionId = `e2e-session-${this.sessionCounter}`;
    const session = buildSession(sessionId, email);
    this.sessions.set(sessionId, session);
    return {
      sessionId,
      session: {
        email,
        csrfToken: session.csrfToken,
        createdAt: new Date(session.createdAt).toISOString(),
        expiresAt: new Date(session.expiresAt).toISOString(),
      },
    };
  }

  setActiveCapsuleId(activeCapsuleId: string | null): Record<string, unknown> {
    this.profile = {
      ...buildE2eProfile(),
      ...this.profile,
      activeCapsuleId,
    };
    return this.profile;
  }

  nextOutfitImageUrl(capsuleId: unknown, setIndex: number): string {
    this.outfitImageCounter += 1;
    return e2eImageUrl(
      `generated-outfit-set-${normalizeCapsuleId(capsuleId)}-${setIndex}-${this.outfitImageCounter}`,
    );
  }

  resetShares(): void {
    this.shareMemory.reset();
  }

  getShareOgMetadataById(id: unknown) {
    return this.shareMemory.getOgMetadataById(id);
  }
}

export const e2eState = new E2eState();

function normalizePersonalItemUrls(items: Array<Record<string, unknown>>) {
  return [
    ...new Set(
      items.map((item) => String(item?.url || "").trim()).filter(Boolean),
    ),
  ].sort((left, right) => left.localeCompare(right));
}

function buildE2ePersonalItemsReport(
  items: Array<Record<string, unknown>>,
  generationNumber: number,
): E2ePersonalItemsReportSnapshot {
  const generatedAt = new Date().toISOString();
  return {
    generatedAt,
    personalItemUrls: normalizePersonalItemUrls(items),
    report: {
      schemaVersion: 1,
      generatedAt,
      verdict: {
        score: 0.82,
        status: "good",
        summary: `E2E personal items report #${generationNumber} for ${
          items.length
        } item${items.length === 1 ? "" : "s"}.`,
      },
      scores: {
        coverage: 0.78,
        outfitReadiness: 0.84,
        versatility: 0.8,
        seasonality: 0.86,
      },
    },
  };
}

function profileDependencies(state: E2eState) {
  return {
    createProfileImpl: async (email, payload) => {
      state.profile = { ...buildE2eProfile(email), ...payload };
      return state.profile;
    },
    deleteProfileImpl: async () => {
      state.profile = null;
      return true;
    },
    getProfileImpl: async () => state.profile,
    updateProfileImpl: async (email, payload) => {
      state.profile = {
        ...buildE2eProfile(email),
        ...state.profile,
        ...payload,
      };
      return state.profile;
    },
    updateProfileLocaleImpl: async (email, locale) => {
      state.profile = { ...buildE2eProfile(email), ...state.profile, locale };
      return state.profile;
    },
    updateProfileActiveCapsuleIdImpl: async () => {
      return state.profile;
    },
    getFormalityLevelsImpl: async () => ["casual", "formal"],
    getStylesImpl: async () => ["minimalistic", "sporty"],
    getOccasionsImpl: async () => ["office", "date_night"],
    getSeasonsImpl: async () => ["spring", "summer"],
    getAudienceOptionsImpl: () => ["woman", "man", "any"],
    getPatternOptionsImpl: async () => ["solid", "striped"],
  };
}

function authDependencies(state: E2eState) {
  return {
    authTestMode: true,
    createPendingCodeImpl: async (email) => {
      state.loginCodes.set(email, E2E_CODE);
      return { ok: true, code: E2E_CODE };
    },
    verifyCodeImpl: async (email, code) => ({
      ok: state.loginCodes.get(email) === code,
      reason: state.loginCodes.get(email) === code ? undefined : "invalid",
    }),
    createSessionImpl: async (email) => state.createSession(email),
    getSessionImpl: async (sessionId) => state.sessions.get(sessionId) || null,
    revokeSessionImpl: async (sessionId) => {
      state.sessions.delete(sessionId);
    },
    sendLoginCodeEmailImpl: async () => {},
  };
}

function capsuleDependencies(state: E2eState) {
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

async function runE2eOutfitImageGenerationJob(state: E2eState, outfitId) {
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

function outfitDependencies(state: E2eState) {
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
    streamOutfitEventsImpl: async (_req, res) => res.status(204).end(),
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

export function createE2eDependencies(state = e2eState) {
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
  return {
    ...queuedDeps,
    ...createE2eJobDependencies(queuedDeps),
  };
}
