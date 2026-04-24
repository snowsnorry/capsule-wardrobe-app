import test from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { OAuth2Client } from "google-auth-library";
import type { ErrorWithCode } from "./ai/types.js";

process.env.NODE_ENV = "test";

const { createApp } = await import("./index.ts");

const TEST_CLIENT_ORIGIN = "https://client.example";
const SESSION_ID = "session-123";
const CSRF_TOKEN = "csrf-123";
const AUTH_COOKIE = `session=${SESSION_ID}; csrf=${CSRF_TOKEN}`;

type DependencyOverrides = Record<string, unknown>;
type StartedTestServer = {
  deps: Record<string, unknown>;
  baseUrl: string;
};
type RequestJsonOptions = {
  method?: string;
  body?: unknown;
  cookie?: string;
  csrfToken?: string;
  origin?: string;
  headers?: Record<string, string>;
};
type RequestJsonResult = {
  response: Response;
  json: any;
};

function createDependencies(overrides: DependencyOverrides = {}) {
  return {
    createPendingCodeImpl: async () => ({ ok: true, code: "654321" }),
    verifyCodeImpl: async () => ({ ok: true }),
    createSessionImpl: async (email) => ({
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
          csrfToken: CSRF_TOKEN
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
      pubKeyCredParams: []
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
      userVerification: "preferred"
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
      llm: "openai:gpt-5.4",
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
      llm: "openai:gpt-5.4",
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

async function startTestServer(testContext, {
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
    googleAuthClient: googleAuthClient as OAuth2Client | null,
    ...deps
  } as any);

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

async function requestJson(baseUrl, pathname, {
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

test("index routes expose health checks and protected auth status", async (t) => {
  const { baseUrl } = await startTestServer(t);

  const health = await requestJson(baseUrl, "/health");
  assert.equal(health.response.status, 200);
  assert.deepEqual(health.json, { ok: true });

  const healthAll = await requestJson(baseUrl, "/healthall");
  assert.equal(healthAll.response.status, 200);
  assert.deepEqual(healthAll.json, { ok: true });

  const unauthorized = await requestJson(baseUrl, "/auth/me");
  assert.equal(unauthorized.response.status, 401);
  assert.deepEqual(unauthorized.json, { error: "unauthorized" });

  const authorized = await requestJson(baseUrl, "/auth/me", {
    cookie: AUTH_COOKIE
  });
  assert.equal(authorized.response.status, 200);
  assert.deepEqual(authorized.json, {
    ok: true,
    user: { email: "person@example.com" }
  });
});

test("index routes map auth request-code branches", async (t) => {
  t.mock.method(console, "log", () => {});
  t.mock.method(console, "error", () => {});

  const invalidServer = await startTestServer(t);
  const invalid = await requestJson(invalidServer.baseUrl, "/auth/request-code", {
    method: "POST",
    body: { email: "bad-email", locale: "ru" }
  });
  assert.equal(invalid.response.status, 400);
  assert.deepEqual(invalid.json, { error: "invalid_email" });

  const cooldownServer = await startTestServer(t, {
    overrides: {
      createPendingCodeImpl: async () => ({ ok: false, reason: "cooldown" })
    }
  });
  const cooldown = await requestJson(cooldownServer.baseUrl, "/auth/request-code", {
    method: "POST",
    body: { email: "person@example.com", locale: "ru" }
  });
  assert.equal(cooldown.response.status, 429);
  assert.equal(cooldown.json.error, "cooldown");

  const rateLimitedServer = await startTestServer(t, {
    overrides: {
      createPendingCodeImpl: async () => ({ ok: false, reason: "rate_limit" })
    }
  });
  const rateLimited = await requestJson(rateLimitedServer.baseUrl, "/auth/request-code", {
    method: "POST",
    body: { email: "person@example.com", locale: "ru" }
  });
  assert.equal(rateLimited.response.status, 429);
  assert.equal(rateLimited.json.error, "rate_limit");

  let emailSent = false;
  const authTestModeServer = await startTestServer(t, {
    authTestMode: true,
    overrides: {
      sendLoginCodeEmailImpl: async () => {
        emailSent = true;
      }
    }
  });
  const authTestMode = await requestJson(authTestModeServer.baseUrl, "/auth/request-code", {
    method: "POST",
    body: { email: "person@example.com", locale: "ru" }
  });
  assert.equal(authTestMode.response.status, 200);
  assert.equal(authTestMode.json.ok, true);
  assert.equal(emailSent, false);

  const emailUnavailableServer = await startTestServer(t, {
    overrides: {
      sendLoginCodeEmailImpl: async () => {
        throw new Error("smtp_down");
      }
    }
  });
  const emailUnavailable = await requestJson(emailUnavailableServer.baseUrl, "/auth/request-code", {
    method: "POST",
    body: { email: "person@example.com", locale: "en" }
  });
  assert.equal(emailUnavailable.response.status, 503);
  assert.deepEqual(emailUnavailable.json, { error: "email_unavailable" });
});

test("index routes map auth verify-code branches and set cookies on success", async (t) => {
  const invalidPayloadServer = await startTestServer(t);
  const invalidPayload = await requestJson(invalidPayloadServer.baseUrl, "/auth/verify-code", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    body: { email: "", code: "" }
  });
  assert.equal(invalidPayload.response.status, 400);
  assert.deepEqual(invalidPayload.json, { error: "invalid_payload" });

  const expiredServer = await startTestServer(t, {
    overrides: {
      verifyCodeImpl: async () => ({ ok: false, reason: "expired" })
    }
  });
  const expired = await requestJson(expiredServer.baseUrl, "/auth/verify-code", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    body: { email: "person@example.com", code: "123456" }
  });
  assert.equal(expired.response.status, 400);
  assert.deepEqual(expired.json, { error: "expired" });

  const maxAttemptsServer = await startTestServer(t, {
    overrides: {
      verifyCodeImpl: async () => ({ ok: false, reason: "max_attempts" })
    }
  });
  const maxAttempts = await requestJson(maxAttemptsServer.baseUrl, "/auth/verify-code", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    body: { email: "person@example.com", code: "123456" }
  });
  assert.equal(maxAttempts.response.status, 429);
  assert.equal(maxAttempts.json.error, "max_attempts");

  const invalidServer = await startTestServer(t, {
    overrides: {
      verifyCodeImpl: async () => ({ ok: false, reason: "invalid" })
    }
  });
  const invalid = await requestJson(invalidServer.baseUrl, "/auth/verify-code", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    body: { email: "person@example.com", code: "123456" }
  });
  assert.equal(invalid.response.status, 400);
  assert.deepEqual(invalid.json, { error: "invalid" });

  const forbiddenOriginServer = await startTestServer(t);
  const forbiddenOrigin = await requestJson(forbiddenOriginServer.baseUrl, "/auth/verify-code", {
    method: "POST",
    origin: "https://evil.example",
    body: { email: "person@example.com", code: "123456" }
  });
  assert.equal(forbiddenOrigin.response.status, 403);
  assert.deepEqual(forbiddenOrigin.json, { error: "forbidden_origin" });

  const successServer = await startTestServer(t);
  const success = await requestJson(successServer.baseUrl, "/auth/verify-code", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    body: { email: "person@example.com", code: "123456" }
  });
  assert.equal(success.response.status, 200);
  assert.deepEqual(success.json, {
    ok: true,
    user: { email: "person@example.com" }
  });
  const setCookie = success.response.headers.get("set-cookie");
  assert.ok(setCookie.includes("session="));
  assert.ok(setCookie.includes("csrf="));
});

test("index routes cover google auth not-configured, invalid token, and success", async (t) => {
  t.mock.method(console, "error", () => {});

  const missingConfigServer = await startTestServer(t, {
    googleClientId: "",
    googleAuthClient: null
  });
  const missingConfig = await requestJson(missingConfigServer.baseUrl, "/auth/google", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    body: { idToken: "token" }
  });
  assert.equal(missingConfig.response.status, 503);
  assert.deepEqual(missingConfig.json, { error: "google_auth_not_configured" });

  const invalidTokenServer = await startTestServer(t, {
    googleAuthClient: {
      verifyIdToken: async () => {
        throw new Error("bad_token");
      }
    }
  });
  const invalidToken = await requestJson(invalidTokenServer.baseUrl, "/auth/google", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    body: { idToken: "bad-token" }
  });
  assert.equal(invalidToken.response.status, 401);
  assert.deepEqual(invalidToken.json, { error: "invalid_google_token" });

  const successServer = await startTestServer(t, {
    googleAuthClient: {
      verifyIdToken: async () => ({
        getPayload: () => ({
          email: "GoogleUser@example.com",
          email_verified: true
        })
      })
    }
  });
  const success = await requestJson(successServer.baseUrl, "/auth/google", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    body: { idToken: "good-token" }
  });
  assert.equal(success.response.status, 200);
  assert.deepEqual(success.json, {
    ok: true,
    user: { email: "googleuser@example.com" }
  });
});

test("index routes cover logout and csrf enforcement on protected mutations", async (t) => {
  let revokedSessionId = null;
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      revokeSessionImpl: async (sessionId) => {
        revokedSessionId = sessionId;
      }
    }
  });

  const missingCsrf = await requestJson(baseUrl, "/auth/logout", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE
  });
  assert.equal(missingCsrf.response.status, 403);
  assert.deepEqual(missingCsrf.json, { error: "csrf_invalid" });

  const success = await requestJson(baseUrl, "/auth/logout", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN
  });
  assert.equal(success.response.status, 200);
  assert.deepEqual(success.json, { ok: true });
  assert.equal(revokedSessionId, SESSION_ID);
});

test("passkey registration routes require auth, store challenge, and save verified passkey", async (t) => {
  let storedChallenge: any = null;
  let insertedPasskey: any = null;
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      insertPasskeyChallengeImpl: async (input) => {
        storedChallenge = input;
      },
      consumePasskeyChallengeImpl: async ({ id, kind }) => (
        id === "challenge-1" && kind === "registration"
          ? {
            id,
            kind,
            challenge: "registration-challenge",
            profileEmail: "person@example.com"
          }
          : null
      ),
      insertPasskeyImpl: async (input) => {
        insertedPasskey = input;
        return {
          id: "passkey-1",
          profileEmail: input.profileEmail,
          credentialId: input.credentialId,
          credentialPublicKey: input.credentialPublicKey,
          counter: input.counter,
          deviceType: input.deviceType,
          backedUp: input.backedUp,
          transports: input.transports,
          name: input.name,
          lastUsedAt: null,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString()
        };
      }
    }
  });

  const unauthorized = await requestJson(baseUrl, "/auth/passkeys/register/options", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN
  });
  assert.equal(unauthorized.response.status, 401);

  const options = await requestJson(baseUrl, "/auth/passkeys/register/options", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN
  });
  assert.equal(options.response.status, 200);
  assert.equal(options.json.options.challenge, "registration-challenge");
  assert.equal(storedChallenge.kind, "registration");
  assert.equal(storedChallenge.profileEmail, "person@example.com");
  assert.ok(options.response.headers.get("set-cookie")?.includes("passkey_challenge="));

  const missingChallenge = await requestJson(baseUrl, "/auth/passkeys/register/verify", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { response: { id: "credential-1" } }
  });
  assert.equal(missingChallenge.response.status, 400);
  assert.deepEqual(missingChallenge.json, { error: "passkey_registration_failed" });

  const verified = await requestJson(baseUrl, "/auth/passkeys/register/verify", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: `${AUTH_COOKIE}; passkey_challenge=challenge-1`,
    csrfToken: CSRF_TOKEN,
    body: { response: { id: "credential-1" } }
  });
  assert.equal(verified.response.status, 200);
  assert.equal(insertedPasskey.profileEmail, "person@example.com");
  assert.equal(insertedPasskey.credentialId, "credential-1");
  assert.equal(verified.json.passkey.credentialPublicKey, undefined);
});

test("passkey authentication routes store challenge, reject unknown credentials, and create app session", async (t) => {
  let storedChallenge: any = null;
  let updatedAuth: any = null;
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      insertPasskeyChallengeImpl: async (input) => {
        storedChallenge = input;
      },
      consumePasskeyChallengeImpl: async ({ id, kind }) => (
        id === "challenge-1" && kind === "authentication"
          ? {
            id,
            kind,
            challenge: "authentication-challenge",
            profileEmail: null
          }
          : null
      ),
      updatePasskeyAuthenticationImpl: async (input) => {
        updatedAuth = input;
        return null;
      }
    }
  });

  const options = await requestJson(baseUrl, "/auth/passkeys/authenticate/options", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN
  });
  assert.equal(options.response.status, 200);
  assert.equal(options.json.options.challenge, "authentication-challenge");
  assert.equal(storedChallenge.kind, "authentication");
  assert.equal(storedChallenge.profileEmail, null);
  assert.ok(options.response.headers.get("set-cookie")?.includes("passkey_challenge="));

  const unknown = await requestJson(baseUrl, "/auth/passkeys/authenticate/verify", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: "passkey_challenge=challenge-1",
    body: { response: { id: "unknown" } }
  });
  assert.equal(unknown.response.status, 400);
  assert.deepEqual(unknown.json, { error: "passkey_login_failed" });

  const success = await requestJson(baseUrl, "/auth/passkeys/authenticate/verify", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: "passkey_challenge=challenge-1",
    body: { response: { id: "credential-1" } }
  });
  assert.equal(success.response.status, 200);
  assert.deepEqual(success.json, { ok: true, user: { email: "person@example.com" } });
  assert.equal(updatedAuth.credentialId, "credential-1");
  assert.equal(updatedAuth.counter, 2);
  const setCookie = success.response.headers.get("set-cookie");
  assert.ok(setCookie?.includes("session="));
  assert.ok(setCookie?.includes("csrf="));
});

test("passkey list and delete routes expose metadata and scope deletion to current user", async (t) => {
  let deleteInput: any = null;
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      listPasskeysImpl: async () => [{
        id: "passkey-1",
        profileEmail: "person@example.com",
        credentialId: "credential-1",
        credentialPublicKey: "secret-public-key",
        counter: 0,
        deviceType: "multiDevice",
        backedUp: true,
        transports: ["internal"],
        name: "Laptop",
        lastUsedAt: null,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString()
      }],
      deletePasskeyByIdForEmailImpl: async (input) => {
        deleteInput = input;
        return input.email === "person@example.com" && input.passkeyId === "passkey-1";
      }
    }
  });

  const list = await requestJson(baseUrl, "/auth/passkeys", {
    cookie: AUTH_COOKIE
  });
  assert.equal(list.response.status, 200);
  assert.deepEqual(list.json.passkeys[0], {
    id: "passkey-1",
    name: "Laptop",
    deviceType: "multiDevice",
    backedUp: true,
    transports: ["internal"],
    createdAt: new Date(0).toISOString(),
    lastUsedAt: null
  });

  const deleted = await requestJson(baseUrl, "/auth/passkeys/passkey-1", {
    method: "DELETE",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN
  });
  assert.equal(deleted.response.status, 200);
  assert.deepEqual(deleteInput, { email: "person@example.com", passkeyId: "passkey-1" });

  const missing = await requestJson(baseUrl, "/auth/passkeys/other-passkey", {
    method: "DELETE",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN
  });
  assert.equal(missing.response.status, 404);
});

test("index routes cover profile read endpoints", async (t) => {
  const { baseUrl } = await startTestServer(t);

  const status = await requestJson(baseUrl, "/profile/status", {
    cookie: AUTH_COOKIE
  });
  assert.equal(status.response.status, 200);
  assert.deepEqual(status.json, { ok: true, hasProfile: true });

  const profile = await requestJson(baseUrl, "/profile/me", {
    cookie: AUTH_COOKIE
  });
  assert.equal(profile.response.status, 200);
  assert.equal(profile.json.ok, true);
  assert.equal(profile.json.profile.email, "person@example.com");
  assert.equal(profile.json.profile.activeCapsuleId, "capsule-1");
  assert.equal(profile.json.profile.locale, "en");
  assert.equal(profile.json.profile.theme, "system");
  assert.equal(profile.json.profile.llm, "openai:gpt-5.4");
  assert.equal(profile.json.profile.image_llm, "openai:gpt-image-2");
  assert.equal(profile.json.profile.fullname, null);

  const wardrobeFilters = await requestJson(baseUrl, "/wardrobe/filters", {
    cookie: AUTH_COOKIE
  });
  assert.deepEqual(wardrobeFilters.json, {
    ok: true,
    formalityLevels: ["casual", "formal"],
    styles: ["minimalistic", "sporty"],
    occasions: ["office", "date_night"],
    seasons: ["spring", "summer"],
    audience: ["man", "woman", "any"],
    patterns: ["striped", "plain"]
  });
});

test("index routes cover profile initialize branches", async (t) => {
  const invalidServer = await startTestServer(t);
  const invalid = await requestJson(invalidServer.baseUrl, "/profile/initialize", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: {
      locale: "de"
    }
  });
  assert.equal(invalid.response.status, 400);
  assert.deepEqual(invalid.json, { error: "invalid_payload" });

  const existsServer = await startTestServer(t, {
    overrides: {
      createProfileImpl: async () => null
    }
  });
  const exists = await requestJson(existsServer.baseUrl, "/profile/initialize", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: {
      locale: "en"
    }
  });
  assert.equal(exists.response.status, 409);
  assert.deepEqual(exists.json, { error: "profile_exists" });

  const successServer = await startTestServer(t);
  const success = await requestJson(successServer.baseUrl, "/profile/initialize", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: {
      locale: "en"
    }
  });
  assert.equal(success.response.status, 200);
  assert.equal(success.json.ok, true);
  assert.equal(success.json.profile.locale, "en");
});

test("index routes cover profile update, locale update, and delete branches", async (t) => {
  const notFoundUpdateServer = await startTestServer(t, {
    overrides: {
      updateProfileImpl: async () => null,
      updateProfileLocaleImpl: async () => null,
      deleteProfileImpl: async () => false
    }
  });

  const updateNotFound = await requestJson(notFoundUpdateServer.baseUrl, "/profile/me", {
    method: "PATCH",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: {
      locale: "en",
      theme: "system",
      llm: "openai:gpt-5.4",
      image_llm: "openai:gpt-image-2",
      fullname: null
    }
  });
  assert.equal(updateNotFound.response.status, 404);
  assert.deepEqual(updateNotFound.json, { error: "not_found" });

  const invalidProfilePayload = await requestJson(notFoundUpdateServer.baseUrl, "/profile/me", {
    method: "PATCH",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: {
      locale: "en",
      theme: "sepia",
      llm: "openai:gpt-5.4",
      image_llm: "openai:gpt-image-2",
      fullname: "Ada"
    }
  });
  assert.equal(invalidProfilePayload.response.status, 400);
  assert.deepEqual(invalidProfilePayload.json, { error: "invalid_payload" });

  const invalidLocale = await requestJson(notFoundUpdateServer.baseUrl, "/profile/locale", {
    method: "PATCH",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { locale: "de" }
  });
  assert.equal(invalidLocale.response.status, 400);
  assert.deepEqual(invalidLocale.json, { error: "invalid_payload" });

  const localeNotFound = await requestJson(notFoundUpdateServer.baseUrl, "/profile/locale", {
    method: "PATCH",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { locale: "ru" }
  });
  assert.equal(localeNotFound.response.status, 404);
  assert.deepEqual(localeNotFound.json, { error: "not_found" });

  const deleteNotFound = await requestJson(notFoundUpdateServer.baseUrl, "/profile/me", {
    method: "DELETE",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN
  });
  assert.equal(deleteNotFound.response.status, 404);
  assert.deepEqual(deleteNotFound.json, { error: "not_found" });

  const successServer = await startTestServer(t);
  const updateSuccess = await requestJson(successServer.baseUrl, "/profile/me", {
    method: "PATCH",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: {
      locale: "ru",
      theme: "dark",
      llm: "claude:claude-opus-4-7",
      image_llm: "gemini:gemini-3-pro-image-preview",
      fullname: "  Ada Lovelace  "
    }
  });
  assert.equal(updateSuccess.response.status, 200);
  assert.equal(updateSuccess.json.ok, true);
  assert.equal(updateSuccess.json.profile.locale, "ru");
  assert.equal(updateSuccess.json.profile.theme, "dark");
  assert.equal(updateSuccess.json.profile.llm, "claude:claude-opus-4-7");
  assert.equal(updateSuccess.json.profile.image_llm, "gemini:gemini-3-pro-image-preview");
  assert.equal(updateSuccess.json.profile.fullname, "Ada Lovelace");

  const localeSuccess = await requestJson(successServer.baseUrl, "/profile/locale", {
    method: "PATCH",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { locale: "ru" }
  });
  assert.equal(localeSuccess.response.status, 200);
  assert.equal(localeSuccess.json.profile.locale, "ru");

  const deleteSuccess = await requestJson(successServer.baseUrl, "/profile/me", {
    method: "DELETE",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN
  });
  assert.equal(deleteSuccess.response.status, 200);
  assert.deepEqual(deleteSuccess.json, { ok: true });
});

test("index routes cover wardrobe handlers and search endpoints", async (t) => {
  let wardrobeCalled = false;
  let fullRegenerateCalled = false;
  let regenerateCalled = false;
  let pdfLocale = null;

  const { baseUrl } = await startTestServer(t, {
    overrides: {
      streamCapsuleEventsImpl: async (_req, res, { snapshot }) => {
        wardrobeCalled = true;
        res.json({ ok: true, snapshot });
      },
      regenerateCapsuleWardrobeHandler: async (_req, res) => {
        fullRegenerateCalled = true;
        res.status(202).json({ ok: true, status: "pending", items: [] });
      },
      regenerateSelectedCapsuleItemsHandler: async (_req, res) => {
        regenerateCalled = true;
        res.json({ ok: true, items: [{ id: "2" }] });
      },
      buildWardrobePdfInChildImpl: async (_products, locale) => {
        pdfLocale = locale;
        return Buffer.from("pdf");
      }
    }
  });

  const searchOptions = await requestJson(baseUrl, "/search/options", {
    cookie: AUTH_COOKIE
  });
  assert.equal(searchOptions.response.status, 200);
  assert.equal(searchOptions.json.ok, true);
  assert.deepEqual(searchOptions.json.audience, ["woman", "man", "all"]);

  const savedSearch = await requestJson(baseUrl, "/search/me", {
    cookie: AUTH_COOKIE
  });
  assert.equal(savedSearch.response.status, 200);
  assert.deepEqual(savedSearch.json, {
    ok: true,
    search: { query: "coat", page: 1 }
  });

  const invalidSearch = await requestJson(baseUrl, "/search/run", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { query: "coat" }
  });
  assert.equal(invalidSearch.response.status, 200);
  assert.equal(invalidSearch.json.ok, true);

  const searchStats = await requestJson(baseUrl, "/search/stats", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { category: ["top"] }
  });
  assert.equal(searchStats.response.status, 200);
  assert.deepEqual(searchStats.json, {
    ok: true,
    total: 3,
    stats: { category: [{ value: "top", count: 3 }] },
    priceBuckets: []
  });

  const wardrobe = await requestJson(baseUrl, "/capsules/capsule-1/events", {
    cookie: AUTH_COOKIE
  });
  assert.equal(wardrobe.response.status, 200);
  assert.equal(wardrobeCalled, true);
  assert.equal(wardrobe.json.snapshot.status, "ready");

  const fullRegenerate = await requestJson(baseUrl, "/capsules/capsule-1/regenerate", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN
  });
  assert.equal(fullRegenerate.response.status, 202);
  assert.equal(fullRegenerateCalled, true);

  const regenerate = await requestJson(baseUrl, "/capsules/capsule-1/regenerate-selected", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { itemUrls: ["https://example.com/1"] }
  });
  assert.equal(regenerate.response.status, 200);
  assert.equal(regenerateCalled, true);

  const outfitSetImage = await requestJson(baseUrl, "/capsules/capsule-1/outfit-sets/0/image", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN
  });
  assert.equal(outfitSetImage.response.status, 202);
  assert.deepEqual(outfitSetImage.json, { ok: true, status: "pending" });

  const removedWardrobeRoute = await requestJson(baseUrl, "/capsules/capsule-1/items", {
    cookie: AUTH_COOKIE
  });
  assert.equal(removedWardrobeRoute.response.status, 404);

  const pdf = await requestJson(baseUrl, "/capsules/capsule-1/pdf", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN
  });
  assert.equal(pdf.response.status, 200);
  assert.equal(pdfLocale, "en");
  assert.equal(
    pdf.response.headers.get("content-disposition"),
    `attachment; filename="New-capsule.pdf"; filename*=UTF-8''${encodeURIComponent("New capsule.pdf")}`
  );
});

test("capsule events initial snapshot includes pending outfit set image indexes", async (t) => {
  let streamedSnapshot = null;
  const { baseUrl } = await startTestServer(t, {
    overrides: {
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
            wardrobe: {
              items: [{ id: "top-1", category: "top" }],
              outfitSets: [{ itemIds: ["top-1", "bottom-1", "bag-1"] }]
            },
            rejectedUrls: []
          }
        },
        saved: null,
        status: "new",
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString()
      }),
      getOutfitSetImageJobImpl: () => ({
        status: "pending",
        pendingSetIndexes: [0]
      }),
      streamCapsuleEventsImpl: async (_req, res, { snapshot }) => {
        streamedSnapshot = snapshot;
        res.json({ ok: true, snapshot });
      }
    }
  });

  const response = await requestJson(baseUrl, "/capsules/capsule-1/events", {
    cookie: AUTH_COOKIE
  });

  assert.equal(response.response.status, 200);
  assert.deepEqual(streamedSnapshot?.pendingImageSetIndexes, [0]);
});

test("capsule creation only accepts name and filters and initializes server-owned data", async (t) => {
  let receivedPayload = null;
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      createCapsuleImpl: async (_email, payload) => {
        receivedPayload = payload;
        return { id: "capsule-2", draft: payload.draft, saved: null, status: "new" };
      }
    }
  });

  const result = await requestJson(baseUrl, "/capsules", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: {
      name: "Spring edit",
      filters: {
        formalityLevel: "casual",
        style: "minimalistic",
        occasions: ["office", "", null],
        season: ["spring"],
        audience: "woman",
        color: "red",
        pattern: "striped"
      }
    }
  });

  assert.equal(result.response.status, 201);
  assert.deepEqual(receivedPayload, {
    name: "Spring edit",
    draft: {
      filters: {
        formalityLevel: "casual",
        style: "minimalistic",
        occasions: ["office"],
        season: ["spring"],
        audience: "woman",
        color: "red",
        pattern: "striped",
        text: ""
      },
      data: {
        wardrobe: null,
        rejectedUrls: []
      }
    },
    saved: null,
    setActive: true
  });
});

test("capsule creation rejects client-supplied state-bearing fields", async (t) => {
  const { baseUrl } = await startTestServer(t);

  const result = await requestJson(baseUrl, "/capsules", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: {
      name: "Spring edit",
      draft: {
        filters: { audience: "woman" },
        data: {
          wardrobe: { items: [{ url: "https://malicious.example/item" }] },
          rejectedUrls: ["https://malicious.example/rejected"]
        }
      }
    }
  });

  assert.equal(result.response.status, 400);
  assert.deepEqual(result.json, { error: "invalid_payload" });
});

test("filters patch only accepts filters and resets draft data", async (t) => {
  let receivedDraft = null;
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      updateCapsuleSnapshotImpl: async (_email, _id, draft) => {
        receivedDraft = draft;
        return { id: "capsule-1", draft, saved: null, status: "new" };
      }
    }
  });

  const result = await requestJson(baseUrl, "/capsules/capsule-1/filters", {
    method: "PATCH",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: {
      filters: {
        formalityLevel: "casual",
        style: "minimalistic",
        occasions: ["office", "", null],
        season: ["spring"],
        audience: "woman",
        color: "red",
        pattern: "striped",
        text: "  Prefer natural fabrics  ",
        ignoredField: "ignored"
      }
    }
  });

  assert.equal(result.response.status, 200);
  assert.deepEqual(receivedDraft, {
    filters: {
      formalityLevel: "casual",
      style: "minimalistic",
      occasions: ["office"],
      season: ["spring"],
      audience: "woman",
      color: "red",
      pattern: "striped",
      text: "Prefer natural fabrics"
    },
    data: {
      wardrobe: null,
      rejectedUrls: []
    }
  });
});

test("filters patch can trigger regenerate via query flag after saving filters", async (t) => {
  const calls = [];
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      updateCapsuleSnapshotImpl: async (_email, _id, draft) => {
        calls.push({ type: "update", draft });
        return { id: "capsule-1", draft, saved: null, status: "new" };
      },
      regenerateCapsuleWardrobeHandler: async (req, res) => {
        calls.push({ type: "regenerate", query: req.query });
        return res.status(202).json({ ok: true, status: "pending" });
      }
    }
  });

  const result = await requestJson(baseUrl, "/capsules/capsule-1/filters?regenerate=true", {
    method: "PATCH",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: {
      filters: {
        audience: "woman",
        season: ["summer"]
      }
    }
  });

  assert.equal(result.response.status, 202);
  assert.deepEqual(calls, [
    {
      type: "update",
      draft: {
        filters: {
          formalityLevel: "",
          style: null,
          occasions: [],
          audience: "woman",
          season: ["summer"],
          color: null,
          pattern: "solid",
          text: ""
        },
        data: {
          wardrobe: null,
          rejectedUrls: []
        }
      }
    },
    {
      type: "regenerate",
      query: {
        regenerate: "true"
      }
    }
  ]);
});

test("rejected urls patch validates against current capsule wardrobe", async (t) => {
  let receivedDraft = null;
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      updateCapsuleSnapshotImpl: async (_email, _id, draft) => {
        receivedDraft = draft;
        return { id: "capsule-1", draft, saved: null, status: "new" };
      }
    }
  });

  const result = await requestJson(baseUrl, "/capsules/capsule-1/rejected-urls", {
    method: "PATCH",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: {
      rejectedUrls: ["https://example.com/1", "https://example.com/1"]
    }
  });

  assert.equal(result.response.status, 200);
  assert.deepEqual(receivedDraft, {
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
      wardrobe: {
        items: [{ url: "https://example.com/1" }],
        outfitSets: [],
        reasoning: null,
        rawSelectionText: null,
        swimwearReasoning: null,
        swimwearRawSelectionText: null
      },
      rejectedUrls: ["https://example.com/1"]
    }
  });
});

test("rejected urls patch rejects unknown urls and missing wardrobe", async (t) => {
  const { baseUrl } = await startTestServer(t);

  const invalid = await requestJson(baseUrl, "/capsules/capsule-1/rejected-urls", {
    method: "PATCH",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: {
      rejectedUrls: ["https://example.com/unknown"]
    }
  });

  assert.equal(invalid.response.status, 400);
  assert.deepEqual(invalid.json, { error: "invalid_payload" });

  const noWardrobeServer = await startTestServer(t, {
    overrides: {
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
            wardrobe: null,
            rejectedUrls: []
          }
        },
        saved: null,
        status: "new"
      })
    }
  });

  const notFound = await requestJson(noWardrobeServer.baseUrl, "/capsules/capsule-1/rejected-urls", {
    method: "PATCH",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: {
      rejectedUrls: ["https://example.com/1"]
    }
  });

  assert.equal(notFound.response.status, 404);
  assert.deepEqual(notFound.json, { error: "not_found" });
});

test("index routes map search and health dependency failures", async (t) => {
  t.mock.method(console, "error", () => {});

  const failingSearchServer = await startTestServer(t, {
    overrides: {
      runSavedSearchImpl: async () => {
        const error = new Error("invalid_payload");
        (error as ErrorWithCode).code = "invalid_payload";
        throw error;
      },
      checkDatabaseConnectionImpl: async () => {
        throw new Error("db_down");
      }
    }
  });

  const invalidSearch = await requestJson(failingSearchServer.baseUrl, "/search/run", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { query: "coat" }
  });
  assert.equal(invalidSearch.response.status, 400);
  assert.deepEqual(invalidSearch.json, { error: "invalid_payload" });

  const failingHealth = await requestJson(failingSearchServer.baseUrl, "/healthall");
  assert.equal(failingHealth.response.status, 503);
  assert.deepEqual(failingHealth.json, { ok: false });

  const failingAuthServer = await startTestServer(t, {
    overrides: {
      getSessionImpl: async () => {
        throw new Error("session_store_down");
      }
    }
  });
  const authFailure = await requestJson(failingAuthServer.baseUrl, "/profile/status", {
    cookie: AUTH_COOKIE
  });
  assert.equal(authFailure.response.status, 503);
  assert.deepEqual(authFailure.json, { error: "service_unavailable" });
});
