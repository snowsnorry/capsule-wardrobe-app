import {
  deepClone,
  E2eCapsuleMemory,
  normalizeCapsuleId,
} from "./capsuleState.js";
import { E2E_CODE, E2E_EMAIL } from "./fixtures.js";
import {
  buildE2eCapsule,
  buildE2ePasskeyDependencies,
  buildE2eSearchPayload,
  buildE2eProfile,
  buildE2eSearchOptions,
  buildE2eSearchStats,
  buildE2eSavedSearchPayload,
  buildE2eWardrobeItems,
  e2eImageUrl,
} from "./fixtures.js";
import { buildSearchResultItems, E2eSearchDelayState } from "./searchState.js";
import { getCapsuleIdValue } from "../capsuleStoreModel.js";

type E2eScenario =
  | "with-profile"
  | "no-profile"
  | "with-saved-search"
  | "with-non-empty-stats";

type E2eSession = {
  email: string;
  csrfToken: string;
  createdAt: number;
  expiresAt: number;
};

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function parseSetIndex(value: unknown): number {
  return Number.parseInt(String(value ?? ""), 10);
}

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
  savedSearch = buildE2eSearchPayload();
  loginCodes = new Map<string, string>();
  sessionCounter = 0;
  outfitImageCounter = 0;
  searchDelay = new E2eSearchDelayState();

  get capsules() {
    return this.capsuleMemory.capsules;
  }

  reset(scenario: E2eScenario = "with-profile") {
    this.scenario = scenario;
    this.sessions.clear();
    this.loginCodes.clear();
    this.sessionCounter = 0;
    this.outfitImageCounter = 0;
    this.searchDelay.clear();
    this.capsuleMemory.reset();
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
}

export const e2eState = new E2eState();

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
    updateProfileActiveCapsuleIdImpl: async (_email, activeCapsuleId) => {
      state.profile = {
        ...buildE2eProfile(),
        ...state.profile,
        activeCapsuleId,
      };
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
    resolveActiveCapsuleImpl: async () => {
      const capsule = state.capsuleMemory.resolve(
        state.profile?.activeCapsuleId,
      );
      state.setActiveCapsuleId(getCapsuleIdValue(capsule));
      return capsule;
    },
    listRecentCapsulesImpl: async (_email, limit = 10) =>
      state.capsuleMemory.list(limit),
    searchCapsulesImpl: async (_email, query, limit = 25) =>
      state.capsuleMemory.search(query, limit),
    getCapsuleImpl: async (_email, id) => state.capsuleMemory.get(id),
    createCapsuleImpl: async (_email, payload) => {
      const capsule = state.capsuleMemory.create({
        name: payload?.name || "Playwright onboarding capsule",
        draft: payload?.draft ?? buildE2eCapsule().draft,
        saved: payload?.saved ?? null,
      });
      if (payload?.setActive !== false) {
        state.setActiveCapsuleId(getCapsuleIdValue(capsule));
      }
      return capsule;
    },
    setActiveCapsuleIdImpl: async (_email, activeCapsuleId) => {
      const capsuleId = normalizeCapsuleId(activeCapsuleId);
      const nextActiveId = state.capsules.has(capsuleId)
        ? capsuleId
        : getCapsuleIdValue(
            state.capsuleMemory.resolve(state.profile?.activeCapsuleId),
          );
      return deepClone(state.setActiveCapsuleId(nextActiveId));
    },
    updateCapsuleSnapshotImpl: async (_email, id, draft) =>
      state.capsuleMemory.update(id, draft),
    saveCapsuleImpl: async (_email, id) => state.capsuleMemory.save(id),
    revertCapsuleImpl: async (_email, id) => state.capsuleMemory.revert(id),
    renameCapsuleImpl: async (_email, id, name) =>
      state.capsuleMemory.rename(id, name),
    duplicateCapsuleImpl: async (_email, id, name) => {
      const capsule = state.capsuleMemory.duplicate(id, name);
      if (capsule) state.setActiveCapsuleId(getCapsuleIdValue(capsule));
      return capsule;
    },
    deleteCapsuleImpl: async (_email, id) => {
      const result = state.capsuleMemory.delete(
        id,
        state.profile?.activeCapsuleId,
      );
      if (result.activeCapsuleId) {
        state.setActiveCapsuleId(result.activeCapsuleId);
      }
      return result.deleted;
    },
  };
}

function searchAndGenerationDependencies(state: E2eState) {
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
      return {
        items,
        total: items.length,
        savedSearch,
      };
    },
    getOutfitSetImageJobImpl: () => null,
    getPartialRegenerationJobImpl: () => null,
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
    regenerateSelectedCapsuleItemsHandler: async (_req, res) =>
      res.json({ ok: true, status: "ready", items: buildE2eWardrobeItems() }),
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

export function createE2eDependencies(state = e2eState) {
  return {
    ...authDependencies(state),
    ...profileDependencies(state),
    ...capsuleDependencies(state),
    ...searchAndGenerationDependencies(state),
    ...buildE2ePasskeyDependencies(),
  };
}
