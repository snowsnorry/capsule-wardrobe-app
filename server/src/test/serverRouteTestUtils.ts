/* eslint-disable max-lines, max-lines-per-function */
import type { Server } from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

process.env.NODE_ENV = "test";

const { createApp, startServer } = await import("../index.ts");

export const TEST_CLIENT_ORIGIN = "https://client.example";
export const SESSION_ID = "session-123";
export const CSRF_TOKEN = "csrf-123";
export const AUTH_COOKIE = `session=${SESSION_ID}; csrf=${CSRF_TOKEN}`;

export type DependencyOverrides = Record<string, unknown>;
export type StartedTestServer = {
  deps: Record<string, unknown>;
  baseUrl: string;
};
export type RequestJsonOptions = {
  method?: string;
  body?: unknown;
  cookie?: string;
  csrfToken?: string;
  origin?: string;
  headers?: Record<string, string>;
};
export type RequestJsonResult = {
  response: Response;
  json: TestResponseJson;
};
export type MutableRecord = Record<string, unknown>;
export type TestResponseJson = MutableRecord & {
  error?: string;
  ok?: boolean;
  capsuleId?: string;
  name?: string;
  options?: MutableRecord & {
    challenge?: string;
    userVerification?: string;
    authenticatorSelection?: MutableRecord & {
      userVerification?: string;
    };
  };
  passkey?: MutableRecord;
  passkeys?: MutableRecord[];
  profile?: MutableRecord & {
    audience?: unknown;
  };
  snapshot?: MutableRecord;
};
export type PasskeyInsertPayload = MutableRecord & {
  profileEmail: string;
  credentialId: string;
  aaguid: string | null;
  name: string;
};
export type PasskeyChallengePayload = MutableRecord & {
  id: string;
  kind: string;
  profileEmail?: string | null;
};
export type RegistrationOptionsInput = MutableRecord & {
  authenticatorSelection: MutableRecord & {
    userVerification?: string;
  };
};
export type AuthenticationOptionsInput = MutableRecord & {
  userVerification?: string;
};
export type WebAuthnVerifyInput = MutableRecord & {
  requireUserVerification?: boolean;
  response: MutableRecord & {
    response: MutableRecord;
  };
};

export function createDependencies(overrides: DependencyOverrides = {}) {
  return {
    createPendingCodeImpl: async () => ({ ok: true, code: "654321" }),
    verifyCodeImpl: async () => ({ ok: true }),
    createSessionImpl: async (email: string) => ({
      sessionId: SESSION_ID,
      session: {
        email,
        csrfToken: CSRF_TOKEN,
        createdAt: new Date(0).toISOString(),
        expiresAt: new Date(60_000).toISOString()
      }
    }),
    getSessionImpl: async (sessionId) => (
      sessionId === SESSION_ID
        ? {
          email: "person@example.com",
          csrfToken: CSRF_TOKEN,
          createdAt: new Date(0).toISOString(),
          expiresAt: new Date(60_000).toISOString()
        }
        : null
    ),
    revokeSessionImpl: async () => {},
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
      updatedAt: new Date(0).toISOString()
    }),
    getPasskeyByCredentialIdImpl: async (credentialId) => (
      credentialId === "credential-1"
        ? {
          id: "passkey-1",
          profileEmail: "person@example.com",
          credentialId: "credential-1",
          credentialPublicKey: Buffer.from("public-key").toString("base64url"),
          counter: 0,
          deviceType: "multiDevice",
          backedUp: true,
          transports: ["internal"],
          name: "Passkey",
          aaguid: null,
          lastUsedAt: null,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString()
        }
        : null
    ),
    updatePasskeyAuthenticationImpl: async () => null,
    deletePasskeyByIdForEmailImpl: async () => true,
    insertPasskeyChallengeImpl: async () => {},
    consumePasskeyChallengeImpl: async () => null,
    pruneExpiredPasskeyChallengesImpl: async () => {},
    generateRegistrationOptionsImpl: async () => ({
      rp: { name: "Capsule Wardrobe", id: "localhost" },
      user: { id: "person@example.com", name: "person@example.com", displayName: "person@example.com" },
      challenge: "registration-challenge",
      pubKeyCredParams: [],
      authenticatorSelection: { residentKey: "preferred", userVerification: "required" }
    }),
    verifyRegistrationResponseImpl: async () => ({
      verified: true,
      registrationInfo: {
        credential: {
          id: "credential-1",
          publicKey: new Uint8Array([1, 2, 3]),
          counter: 1,
          transports: ["internal"]
        },
        credentialDeviceType: "multiDevice",
        credentialBackedUp: true
      }
    }),
    generateAuthenticationOptionsImpl: async () => ({
      challenge: "authentication-challenge",
      rpId: "localhost",
      userVerification: "required"
    }),
    verifyAuthenticationResponseImpl: async () => ({
      verified: true,
      authenticationInfo: {
        credentialID: "credential-1",
        newCounter: 2,
        userVerified: true,
        credentialDeviceType: "multiDevice",
        credentialBackedUp: true,
        origin: "https://client.example",
        rpID: "localhost"
      }
    }),
    sendLoginCodeEmailImpl: async () => {},
    createProfileImpl: async (email, payload) => ({ id: "profile-1", email, activeCapsuleId: null, ...payload }),
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
      imageLlm: "openai:gpt-image-2"
    }),
    hasProfileImpl: async () => true,
    updateProfileImpl: async (email, payload) => ({ id: "profile-1", email, activeCapsuleId: "capsule-1", ...payload }),
    updateProfileLocaleImpl: async (email, locale) => ({
      id: "profile-1",
      email,
      activeCapsuleId: "capsule-1",
      locale,
      fullname: null,
      theme: "system",
      llm: "openai:gpt-5.5",
      imageLlm: "openai:gpt-image-2"
    }),
    updateProfileActiveCapsuleIdImpl: async (_email, activeCapsuleId) => ({ activeCapsuleId }),
    resolveActiveCapsuleImpl: async () => ({
      id: "capsule-1",
      name: "<New capsule>",
      draft: null,
      saved: null,
      status: "new",
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString()
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
          text: ""
        },
        data: {
          wardrobe: { items: [{ url: "https://example.com/1" }] },
          rejectedUrls: []
        }
      },
      saved: null,
      status: "new",
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString()
    }),
    createCapsuleImpl: async (_email, payload) => ({ id: "capsule-2", status: "new", ...payload }),
    createCapsuleShareImpl: async () => ({
      id: "share-1",
      url: `${TEST_CLIENT_ORIGIN}/share/share-1`,
      expiresAt: new Date(60_000).toISOString()
    }),
    getSharedCapsuleImpl: async (id) => (
      id === "share-1"
        ? { id, name: "Spring edit", expiresAt: new Date(60_000).toISOString() }
        : null
    ),
    getSharedCapsuleOgMetadataImpl: async (id) => (
      id === "share-1"
        ? { title: "Spring edit", description: "", image: "" }
        : null
    ),
    importSharedCapsuleImpl: async () => ({
      id: "capsule-imported",
      name: "Spring edit (2)",
      draft: null,
      saved: { filters: {}, data: { wardrobe: { items: [{ url: "https://example.com/1" }] }, rejectedUrls: [] } },
      status: "saved"
    }),
    updateCapsuleSnapshotImpl: async (_email, _id, draft) => ({ id: "capsule-1", draft, saved: null, status: "new" }),
    saveCapsuleImpl: async () => ({ id: "capsule-1", draft: null, saved: { filters: {}, data: {} }, status: "saved" }),
    revertCapsuleImpl: async () => ({ id: "capsule-1", draft: null, saved: { filters: {}, data: {} }, status: "saved" }),
    renameCapsuleImpl: async (_email, id, name) => ({ id, name, draft: null, saved: null, status: "new" }),
    duplicateCapsuleImpl: async () => ({ id: "capsule-3", name: "<New capsule (1)>", draft: null, saved: { filters: {}, data: {} }, status: "saved" }),
    deleteCapsuleImpl: async () => true,
    setActiveCapsuleIdImpl: async () => ({ activeCapsuleId: "capsule-1" }),
    getSearchOptionsImpl: async () => ({
      brands: [{ value: "zara", label: "Zara" }],
      audience: ["woman", "man", "all"]
    }),
    getSavedSearchImpl: async () => ({ query: "coat", page: 1 }),
    getSearchStatsImpl: async () => ({ total: 3, stats: { category: [{ value: "top", count: 3 }] }, priceBuckets: [] }),
    runSavedSearchImpl: async (_email, payload) => ({ items: [{ id: "1" }], total: 1, search: payload }),
    getOutfitSetImageJobImpl: async () => null,
    streamCapsuleEventsImpl: async (_req, res, { snapshot }) => res.json({ ok: true, snapshot }),
    regenerateCapsuleWardrobeHandler: async (_req, res) => res.status(202).json({ ok: true, status: "pending", items: [] }),
    regenerateSelectedCapsuleItemsHandler: async (_req, res) => res.json({ ok: true, items: [] }),
    generateOutfitSetImageHandler: async (_req, res) => res.status(202).json({ ok: true, status: "pending" }),
    buildWardrobePdfInChildImpl: async () => Buffer.from("pdf"),
    getProductsByUrlsInOrderImpl: async () => [{ url: "https://example.com/1" }],
    checkDatabaseConnectionImpl: async () => {},
    ...overrides
  };
}

export async function startTestServer(testContext, {
  nodeEnv = "production",
  authTestMode = false,
  googleClientId = "google-client-id",
  googleAuthClient = null,
  overrides = {}
}: {
  nodeEnv?: string;
  authTestMode?: boolean;
  googleClientId?: string;
  googleAuthClient?: unknown | null;
  overrides?: DependencyOverrides;
} = {}): Promise<StartedTestServer> {
  const deps = createDependencies(overrides);
  const app = createApp({
    nodeEnv,
    clientOrigin: TEST_CLIENT_ORIGIN,
    authTestMode,
    googleClientId,
    googleAuthClient,
    ...deps
  });

  const server = await new Promise<Server>((resolve) => {
    const nextServer = app.listen(0, "127.0.0.1", () => resolve(nextServer));
  });

  testContext.after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  return {
    deps,
    baseUrl: `http://127.0.0.1:${(server.address() as { port: number }).port}`
  };
}

export async function startSpaFallbackTestServer(testContext, {
  overrides = {}
}: {
  overrides?: DependencyOverrides;
} = {}): Promise<StartedTestServer> {
  const deps = createDependencies(overrides);
  const app = createApp({
    nodeEnv: "production",
    clientOrigin: TEST_CLIENT_ORIGIN,
    ...deps
  });
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "capsule-og-test-"));
  await fs.writeFile(
    path.join(tempDir, "index.html"),
    "<!doctype html><html><head><title>Capsule Wardrobe</title></head><body><div id=\"root\"></div></body></html>",
    "utf-8"
  );

  const server = await startServer({
    appInstance: app,
    nodeEnv: "production",
    ensureTablesImpl: async () => {},
    port: 0,
    clientDistPath: tempDir,
    getSharedCapsuleOgMetadataImpl: deps.getSharedCapsuleOgMetadataImpl
  });

  testContext.after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  return {
    deps,
    baseUrl: `http://127.0.0.1:${(server.address() as { port: number }).port}`
  };
}

export async function requestJson(baseUrl, pathname, {
  method = "GET",
  body,
  cookie,
  csrfToken,
  origin,
  headers = {}
}: RequestJsonOptions = {}): Promise<RequestJsonResult> {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      ...(origin ? { origin } : {}),
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const text = await response.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }

  return { response, json };
}

export async function requestText(baseUrl, pathname, headers: Record<string, string> = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, { headers });
  return {
    response,
    text: await response.text()
  };
}

export function passkeyRegistrationResponse(overrides: Record<string, unknown> = {}) {
  const responseOverrides: Record<string, unknown> = overrides.response
    && typeof overrides.response === "object"
    && !Array.isArray(overrides.response)
    ? overrides.response as Record<string, unknown>
    : {};
  const { response: _response, ...topLevelOverrides } = overrides;
  return {
    id: "credential-1",
    rawId: "credential-1",
    type: "public-key",
    authenticatorAttachment: "platform",
    clientExtensionResults: {},
    response: {
      clientDataJSON: "client-data",
      attestationObject: "attestation-object",
      transports: ["internal"],
      publicKeyAlgorithm: -7,
      publicKey: "public-key",
      authenticatorData: "authenticator-data",
      ...responseOverrides
    },
    ...topLevelOverrides
  };
}

export function passkeyAuthenticationResponse(overrides: Record<string, unknown> = {}) {
  const responseOverrides: Record<string, unknown> = overrides.response
    && typeof overrides.response === "object"
    && !Array.isArray(overrides.response)
    ? overrides.response as Record<string, unknown>
    : {};
  const { response: _response, ...topLevelOverrides } = overrides;
  return {
    id: "credential-1",
    rawId: "credential-1",
    type: "public-key",
    authenticatorAttachment: "platform",
    clientExtensionResults: {},
    response: {
      clientDataJSON: "client-data",
      authenticatorData: "authenticator-data",
      signature: "signature",
      userHandle: "person@example.com",
      ...responseOverrides
    },
    ...topLevelOverrides
  };
}
