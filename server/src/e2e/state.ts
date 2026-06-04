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
  buildE2eSavedSearchPayload,
  e2eImageUrl,
  E2E_CODE,
  E2E_EMAIL,
} from "./fixtures.js";
import { E2eGenerationMemory } from "./generationState.js";
import { E2eSearchDelayState } from "./searchState.js";
import { searchAndGenerationDependencies } from "./searchAndGenerationDependencies.js";
import { E2eSelectedRegenerationMemory } from "./selectedRegenerationState.js";
import { E2eShareMemory } from "./shareState.js";
import {
  createE2eWardrobeDependencies,
  E2eWardrobeMemory,
} from "./wardrobeState.js";

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
  shareMemory = new E2eShareMemory();
  savedSearch = buildE2eSearchPayload();
  loginCodes = new Map<string, string>();
  sessionCounter = 0;
  outfitImageCounter = 0;
  wardrobeMemory = new E2eWardrobeMemory();
  selectedRegenerationMemory = new E2eSelectedRegenerationMemory();
  searchDelay = new E2eSearchDelayState();
  generationMemory = new E2eGenerationMemory();

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

export function createE2eDependencies(state = e2eState) {
  return {
    ...authDependencies(state),
    ...profileDependencies(state),
    ...capsuleDependencies(state),
    ...searchAndGenerationDependencies(state),
    ...createE2eWardrobeDependencies(state.wardrobeMemory),
    ...buildE2ePasskeyDependencies(),
    createUploadedWardrobeItemEmbeddingImpl: async () => [0.1, 0.2, 0.3],
    deleteR2ObjectsImpl: async (payload) => ({
      deleted: Array.isArray(payload?.keys) ? payload.keys.length : 0,
    }),
  };
}
