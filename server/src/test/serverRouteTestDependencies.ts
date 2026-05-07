import {
  CSRF_TOKEN,
  SESSION_ID,
  TEST_CLIENT_ORIGIN,
} from "./serverRouteTestConstants.js";
import type { DependencyOverrides } from "./serverRouteTestTypes.js";

function createAuthDependencies() {
  return {
    createPendingCodeImpl: async () => ({ ok: true, code: "654321" }),
    verifyCodeImpl: async () => ({ ok: true }),
    createSessionImpl: async (email: string) => ({
      sessionId: SESSION_ID,
      session: {
        email,
        csrfToken: CSRF_TOKEN,
        createdAt: new Date(0).toISOString(),
        expiresAt: new Date(60_000).toISOString(),
      },
    }),
    getSessionImpl: async (sessionId) =>
      sessionId === SESSION_ID
        ? {
            email: "person@example.com",
            csrfToken: CSRF_TOKEN,
            createdAt: new Date(0).toISOString(),
            expiresAt: new Date(60_000).toISOString(),
          }
        : null,
    revokeSessionImpl: async () => {},
    sendLoginCodeEmailImpl: async () => {},
  };
}

function createPasskeyDependencies() {
  return {
    listPasskeysImpl: async () => [],
    insertPasskeyImpl: async (_payload) => ({
      id: "passkey-1",
      profileEmail: "person@example.com",
      credentialId: "credential-1",
      credentialPublicKey: "public-key",
      counter: 0,
      deviceType: "multiDevice",
      backedUp: true,
      transports: ["internal"],
      name: "Passkey",
      aaguid: null,
      lastUsedAt: null,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    }),
    getPasskeyByCredentialIdImpl: async (credentialId) =>
      credentialId === "credential-1"
        ? {
            id: "passkey-1",
            profileEmail: "person@example.com",
            credentialId: "credential-1",
            credentialPublicKey:
              Buffer.from("public-key").toString("base64url"),
            counter: 0,
            deviceType: "multiDevice",
            backedUp: true,
            transports: ["internal"],
            name: "Passkey",
            aaguid: null,
            lastUsedAt: null,
            createdAt: new Date(0).toISOString(),
            updatedAt: new Date(0).toISOString(),
          }
        : null,
    updatePasskeyAuthenticationImpl: async () => null,
    deletePasskeyByIdForEmailImpl: async () => true,
    insertPasskeyChallengeImpl: async () => {},
    consumePasskeyChallengeImpl: async () => null,
    pruneExpiredPasskeyChallengesImpl: async () => {},
    generateRegistrationOptionsImpl: async () => ({
      rp: { name: "Capsule Wardrobe", id: "localhost" },
      user: {
        id: "person@example.com",
        name: "person@example.com",
        displayName: "person@example.com",
      },
      challenge: "registration-challenge",
      pubKeyCredParams: [],
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
      },
    }),
    verifyRegistrationResponseImpl: async () => ({
      verified: true,
      registrationInfo: {
        credential: {
          id: "credential-1",
          publicKey: new Uint8Array([1, 2, 3]),
          counter: 1,
          transports: ["internal"],
        },
        credentialDeviceType: "multiDevice",
        credentialBackedUp: true,
      },
    }),
    generateAuthenticationOptionsImpl: async () => ({
      challenge: "authentication-challenge",
      rpId: "localhost",
      userVerification: "required",
    }),
    verifyAuthenticationResponseImpl: async () => ({
      verified: true,
      authenticationInfo: {
        credentialID: "credential-1",
        newCounter: 2,
        userVerified: true,
        credentialDeviceType: "multiDevice",
        credentialBackedUp: true,
        origin: TEST_CLIENT_ORIGIN,
        rpID: "localhost",
      },
    }),
  };
}

function createProfileDependencies() {
  return {
    createProfileImpl: async (email, payload) => ({
      id: "profile-1",
      email,
      activeCapsuleId: null,
      ...payload,
    }),
    deleteProfileImpl: async () => true,
    getFormalityLevelsImpl: async () => ["casual", "formal"],
    getStylesImpl: async () => ["minimalistic", "sporty"],
    getOccasionsImpl: async () => ["office", "date_night"],
    getSeasonsImpl: async () => ["spring", "summer"],
    getAudienceOptionsImpl: () => ["man", "woman", "any"],
    getPatternOptionsImpl: async () => ["striped", "plain"],
    getProfileImpl: async () => ({
      email: "person@example.com",
      activeCapsuleId: "capsule-1",
      locale: "en",
      fullname: null,
      theme: "system",
      llm: "openai:gpt-5.5",
      imageLlm: "openai:gpt-image-2",
    }),
    hasProfileImpl: async () => true,
    updateProfileImpl: async (email, payload) => ({
      id: "profile-1",
      email,
      activeCapsuleId: "capsule-1",
      ...payload,
    }),
    updateProfileLocaleImpl: async (email, locale) => ({
      id: "profile-1",
      email,
      activeCapsuleId: "capsule-1",
      locale,
      fullname: null,
      theme: "system",
      llm: "openai:gpt-5.5",
      imageLlm: "openai:gpt-image-2",
    }),
    updateProfileActiveCapsuleIdImpl: async (_email, activeCapsuleId) => ({
      activeCapsuleId,
    }),
  };
}

function createCapsuleDependencies() {
  return {
    resolveActiveCapsuleImpl: async () => ({
      id: "capsule-1",
      name: "<New capsule>",
      draft: null,
      saved: null,
      status: "new",
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    }),
    listRecentCapsulesImpl: async () => [],
    searchCapsulesImpl: async () => [],
    getCapsuleImpl: async () => ({
      id: "capsule-1",
      name: "<New capsule>",
      draft: {
        filters: {
          formalityLevel: "casual",
          style: "minimalistic",
          occasions: ["office"],
          season: ["spring"],
          audience: "woman",
          color: null,
          pattern: "solid",
          text: "",
        },
        data: {
          wardrobe: { items: [{ url: "https://example.com/1" }] },
          rejectedUrls: [],
        },
      },
      saved: null,
      status: "new",
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    }),
    createCapsuleImpl: async (_email, payload) => ({
      id: "capsule-2",
      status: "new",
      ...payload,
    }),
    ...createCapsuleShareDependencies(),
    ...createCapsuleMutationDependencies(),
  };
}

function createCapsuleShareDependencies() {
  return {
    createCapsuleShareImpl: async () => ({
      id: "share-1",
      url: `${TEST_CLIENT_ORIGIN}/share/share-1`,
      expiresAt: new Date(60_000).toISOString(),
    }),
    getSharedCapsuleImpl: async (id) =>
      id === "share-1"
        ? { id, name: "Spring edit", expiresAt: new Date(60_000).toISOString() }
        : null,
    getSharedCapsuleOgMetadataImpl: async (id) =>
      id === "share-1"
        ? { title: "Spring edit", description: "", image: "" }
        : null,
    importSharedCapsuleImpl: async () => ({
      id: "capsule-imported",
      name: "Spring edit (2)",
      draft: null,
      saved: {
        filters: {},
        data: {
          wardrobe: { items: [{ url: "https://example.com/1" }] },
          rejectedUrls: [],
        },
      },
      status: "saved",
    }),
  };
}

function createCapsuleMutationDependencies() {
  return {
    updateCapsuleSnapshotImpl: async (_email, _id, draft) => ({
      id: "capsule-1",
      draft,
      saved: null,
      status: "new",
    }),
    saveCapsuleImpl: async () => ({
      id: "capsule-1",
      draft: null,
      saved: { filters: {}, data: {} },
      status: "saved",
    }),
    revertCapsuleImpl: async () => ({
      id: "capsule-1",
      draft: null,
      saved: { filters: {}, data: {} },
      status: "saved",
    }),
    renameCapsuleImpl: async (_email, id, name) => ({
      id,
      name,
      draft: null,
      saved: null,
      status: "new",
    }),
    duplicateCapsuleImpl: async () => ({
      id: "capsule-3",
      name: "<New capsule (1)>",
      draft: null,
      saved: { filters: {}, data: {} },
      status: "saved",
    }),
    deleteCapsuleImpl: async () => true,
    setActiveCapsuleIdImpl: async () => ({ activeCapsuleId: "capsule-1" }),
  };
}

function createSearchAndGenerationDependencies() {
  return {
    getSearchOptionsImpl: async () => ({
      brands: [{ value: "zara", label: "Zara" }],
      audience: ["woman", "man", "all"],
    }),
    getSavedSearchImpl: async () => ({ query: "coat", page: 1 }),
    getSearchStatsImpl: async () => ({
      total: 3,
      stats: { category: [{ value: "top", count: 3 }] },
      priceBuckets: [],
    }),
    runSavedSearchImpl: async (_email, payload) => ({
      items: [{ id: "1" }],
      total: 1,
      search: payload,
    }),
    getOutfitSetImageJobImpl: async () => null,
    streamCapsuleEventsImpl: async (_req, res, { snapshot }) =>
      res.json({ ok: true, snapshot }),
    regenerateCapsuleWardrobeHandler: async (_req, res) =>
      res.status(202).json({ ok: true, status: "pending", items: [] }),
    regenerateSelectedCapsuleItemsHandler: async (_req, res) =>
      res.json({ ok: true, items: [] }),
    generateOutfitSetImageHandler: async (_req, res) =>
      res.status(202).json({ ok: true, status: "pending" }),
    buildWardrobePdfInChildImpl: async () => Buffer.from("pdf"),
    getProductsByUrlsInOrderImpl: async () => [
      { url: "https://example.com/1" },
    ],
    checkDatabaseConnectionImpl: async () => {},
  };
}

export function createDependencies(overrides: DependencyOverrides = {}) {
  return {
    ...createAuthDependencies(),
    ...createPasskeyDependencies(),
    ...createProfileDependencies(),
    ...createCapsuleDependencies(),
    ...createSearchAndGenerationDependencies(),
    ...overrides,
  };
}
