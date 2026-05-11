import { E2E_CODE, E2E_EMAIL } from "./fixtures.js";
import {
  buildE2eCapsule,
  buildE2eSearchPayload,
  buildE2eProfile,
  buildE2eSearchOptions,
  buildE2eSearchStats,
  buildE2eSavedSearchPayload,
  buildE2eWardrobeItems,
  e2eImageUrl,
} from "./fixtures.js";

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

function buildSession(sessionId: string, email: string): E2eSession {
  const createdAt = Date.now();
  return {
    email,
    csrfToken: `csrf-${sessionId}`,
    createdAt,
    expiresAt: createdAt + SESSION_TTL_MS,
  };
}

function normalizeCapsuleId(id: unknown): string {
  return String(id || "capsule-e2e").trim() || "capsule-e2e";
}

class E2eState {
  scenario: E2eScenario = "with-profile";
  sessions = new Map<string, E2eSession>();
  profile: Record<string, unknown> | null = buildE2eProfile();
  capsules = new Map<string, Record<string, unknown>>([
    ["capsule-e2e", buildE2eCapsule()],
  ]);
  savedSearch = buildE2eSearchPayload();
  loginCodes = new Map<string, string>();
  sessionCounter = 0;
  capsuleCounter = 1;

  reset(scenario: E2eScenario = "with-profile") {
    this.scenario = scenario;
    this.sessions.clear();
    this.loginCodes.clear();
    this.sessionCounter = 0;
    this.capsuleCounter = 1;
    this.profile = scenario === "no-profile" ? null : buildE2eProfile();
    this.capsules = new Map([["capsule-e2e", buildE2eCapsule()]]);
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

  activeCapsule() {
    const activeId = String(this.profile?.activeCapsuleId || "capsule-e2e");
    return this.capsules.get(activeId) || this.capsules.get("capsule-e2e");
  }
}

export const e2eState = new E2eState();

function payloadIncludes(payload, field: string, value: string) {
  return Array.isArray(payload?.[field]) && payload[field].includes(value);
}

function isUrlSearchPayload(payload) {
  const query = String(payload?.query || "").trim();
  return query.startsWith("http://") || query.startsWith("https://");
}

function hasSavedFilterPayload(payload) {
  return (
    payloadIncludes(payload, "category", "top") &&
    payloadIncludes(payload, "color", "navy")
  );
}

function buildSearchResultItems(payload) {
  const items = buildE2eWardrobeItems();
  const query = String(payload?.query || "").trim();
  if (isUrlSearchPayload(payload)) {
    return items.filter((item) => item.url === query);
  }

  if (payloadIncludes(payload, "style", "sporty")) {
    return items.filter((item) => item.id === "sporty-overshirt-e2e");
  }

  if (hasSavedFilterPayload(payload)) {
    return items.filter((item) => item.id === "top-e2e");
  }

  return items.filter((item) =>
    ["top-e2e", "bottom-e2e", "shoes-e2e"].includes(String(item.id)),
  );
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
    resolveActiveCapsuleImpl: async () => state.activeCapsule(),
    listRecentCapsulesImpl: async () => [...state.capsules.values()],
    searchCapsulesImpl: async () => [...state.capsules.values()],
    getCapsuleImpl: async (_email, id) =>
      state.capsules.get(normalizeCapsuleId(id)) || null,
    createCapsuleImpl: async (_email, payload) => {
      state.capsuleCounter += 1;
      const capsule = {
        ...buildE2eCapsule(),
        id: `capsule-e2e-${state.capsuleCounter}`,
        name: payload?.name || "Playwright onboarding capsule",
        draft: payload?.draft || buildE2eCapsule().draft,
      };
      state.capsules.set(String(capsule.id), capsule);
      state.profile = {
        ...buildE2eProfile(),
        ...state.profile,
        activeCapsuleId: capsule.id,
      };
      return capsule;
    },
    setActiveCapsuleIdImpl: async (_email, activeCapsuleId) => {
      state.profile = {
        ...buildE2eProfile(),
        ...state.profile,
        activeCapsuleId,
      };
      return state.profile;
    },
    updateCapsuleSnapshotImpl: async (_email, id, draft) => {
      const capsuleId = normalizeCapsuleId(id);
      const current = state.capsules.get(capsuleId) || buildE2eCapsule();
      const next = { ...current, id: capsuleId, draft, status: "new" };
      state.capsules.set(capsuleId, next);
      return next;
    },
    saveCapsuleImpl: async (_email, id) =>
      state.capsules.get(normalizeCapsuleId(id)),
    revertCapsuleImpl: async (_email, id) =>
      state.capsules.get(normalizeCapsuleId(id)),
    renameCapsuleImpl: async (_email, id, name) => {
      const capsuleId = normalizeCapsuleId(id);
      const current = state.capsules.get(capsuleId);
      if (!current) return null;
      const next = { ...current, name };
      state.capsules.set(capsuleId, next);
      return next;
    },
    duplicateCapsuleImpl: async () => buildE2eCapsule(),
    deleteCapsuleImpl: async (_email, id) =>
      state.capsules.delete(normalizeCapsuleId(id)),
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
      state.savedSearch = buildE2eSearchPayload(payload);
      const items = buildSearchResultItems(state.savedSearch).map((item) => ({
        ...item,
        imageUrl: item.image_url,
      }));
      return {
        items,
        total: items.length,
        savedSearch: state.savedSearch,
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
    generateOutfitSetImageHandler: async (_req, res) =>
      res.json({ ok: true, status: "ready", image: e2eImageUrl("outfit-set") }),
    deleteOutfitSetImageHandler: async (_req, res) =>
      res.json({ ok: true, status: "ready" }),
    buildWardrobePdfInChildImpl: async () => Buffer.from("e2e-pdf"),
    getProductsByUrlsInOrderImpl: async () => buildE2eWardrobeItems(),
  };
}

function passkeyDependencies() {
  return {
    listPasskeysImpl: async () => [],
    insertPasskeyImpl: async () => null,
    getPasskeyByCredentialIdImpl: async () => null,
    updatePasskeyAuthenticationImpl: async () => null,
    deletePasskeyByIdForEmailImpl: async () => true,
    insertPasskeyChallengeImpl: async () => {},
    consumePasskeyChallengeImpl: async () => null,
    pruneExpiredPasskeyChallengesImpl: async () => {},
    generateRegistrationOptionsImpl: async () => ({
      challenge: "e2e-registration-challenge",
      pubKeyCredParams: [],
      rp: { id: "127.0.0.1", name: "Capsule Wardrobe E2E" },
      user: {
        id: E2E_EMAIL,
        name: E2E_EMAIL,
        displayName: E2E_EMAIL,
      },
    }),
    verifyRegistrationResponseImpl: async () => ({ verified: false }),
    generateAuthenticationOptionsImpl: async () => ({
      challenge: "e2e-authentication-challenge",
      rpId: "127.0.0.1",
      userVerification: "required",
    }),
    verifyAuthenticationResponseImpl: async () => ({ verified: false }),
  };
}

export function createE2eDependencies(state = e2eState) {
  return {
    ...authDependencies(state),
    ...profileDependencies(state),
    ...capsuleDependencies(state),
    ...searchAndGenerationDependencies(state),
    ...passkeyDependencies(),
  };
}
