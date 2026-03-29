import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";

const { createApp } = await import("./index.js");

const TEST_CLIENT_ORIGIN = "https://client.example";
const SESSION_ID = "session-123";
const CSRF_TOKEN = "csrf-123";
const AUTH_COOKIE = `session=${SESSION_ID}; csrf=${CSRF_TOKEN}`;

function createDependencies(overrides = {}) {
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
    sendLoginCodeEmailImpl: async () => {},
    createProfileImpl: async (_email, payload) => ({ id: "profile-1", ...payload }),
    deleteProfileImpl: async () => true,
    getFormalityLevelsImpl: async () => ["casual", "formal"],
    getStylesImpl: async () => ["minimalistic", "sporty"],
    getOccasionsImpl: async () => ["office", "date_night"],
    getSeasonsImpl: async () => ["spring", "summer"],
    getAudienceOptionsImpl: () => ["man", "woman", "any"],
    getPatternOptionsImpl: async () => ["striped", "plain"],
    getProfileImpl: async () => ({
      formalityLevel: "casual",
      style: "minimalistic",
      occasions: ["office"],
      season: ["spring"],
      audience: "woman",
      color: null,
      pattern: null,
      locale: "en"
    }),
    hasProfileImpl: async () => true,
    updateProfileImpl: async (_email, payload) => ({ id: "profile-1", ...payload }),
    updateProfileLocaleImpl: async (_email, locale) => ({ id: "profile-1", locale }),
    getSearchOptionsImpl: async () => ({ brands: [{ value: "zara", label: "Zara" }] }),
    getSavedSearchImpl: async () => ({ query: "coat", page: 1 }),
    runSavedSearchImpl: async (_email, payload) => ({ items: [{ id: "1" }], total: 1, search: payload }),
    getWardrobeItemsHandler: async (_req, res) => res.json({ ok: true, status: "ready", items: [] }),
    regenerateSelectedWardrobeItemsHandler: async (_req, res) => res.json({ ok: true, items: [] }),
    downloadWardrobePdfHandler: async (_req, res) => res.status(202).json({ status: "pending", pollAfterMs: 50 }),
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
} = {}) {
  const deps = createDependencies(overrides);
  const app = createApp({
    nodeEnv,
    clientOrigin: TEST_CLIENT_ORIGIN,
    authTestMode,
    googleClientId,
    googleAuthClient,
    ...deps
  });

  const server = await new Promise((resolve) => {
    const nextServer = app.listen(0, "127.0.0.1", () => resolve(nextServer));
  });

  testContext.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  return {
    deps,
    baseUrl: `http://127.0.0.1:${server.address().port}`
  };
}

async function requestJson(baseUrl, pathname, {
  method = "GET",
  body,
  cookie,
  csrfToken,
  origin,
  headers = {}
} = {}) {
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
  assert.equal(profile.json.profile.formalityLevel, "casual");

  const formality = await requestJson(baseUrl, "/profile/formality-levels", {
    cookie: AUTH_COOKIE
  });
  assert.deepEqual(formality.json, { ok: true, items: ["casual", "formal"] });

  const styles = await requestJson(baseUrl, "/profile/styles", {
    cookie: AUTH_COOKIE
  });
  assert.deepEqual(styles.json, { ok: true, items: ["minimalistic", "sporty"] });

  const occasions = await requestJson(baseUrl, "/profile/occasions", {
    cookie: AUTH_COOKIE
  });
  assert.deepEqual(occasions.json, { ok: true, items: ["office", "date_night"] });

  const seasons = await requestJson(baseUrl, "/profile/seasons", {
    cookie: AUTH_COOKIE
  });
  assert.deepEqual(seasons.json, { ok: true, items: ["spring", "summer"] });

  const audience = await requestJson(baseUrl, "/profile/audience", {
    cookie: AUTH_COOKIE
  });
  assert.deepEqual(audience.json, { ok: true, items: ["man", "woman", "any"] });

  const patterns = await requestJson(baseUrl, "/profile/patterns", {
    cookie: AUTH_COOKIE
  });
  assert.deepEqual(patterns.json, { ok: true, items: ["striped", "plain"] });
});

test("index routes cover profile initialize branches", async (t) => {
  const invalidServer = await startTestServer(t);
  const invalid = await requestJson(invalidServer.baseUrl, "/profile/initialize", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: {
      formalityLevel: "unknown",
      style: null,
      occasions: ["office"],
      season: ["spring"],
      audience: "woman",
      color: null,
      pattern: null,
      locale: "en"
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
      formalityLevel: "casual",
      style: "minimalistic",
      occasions: ["office"],
      season: ["spring"],
      audience: "woman",
      color: null,
      pattern: "striped",
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
      formalityLevel: "casual",
      style: "minimalistic",
      occasions: ["office"],
      season: ["spring"],
      audience: "woman",
      color: null,
      pattern: "striped",
      locale: "en"
    }
  });
  assert.equal(success.response.status, 200);
  assert.equal(success.json.ok, true);
  assert.equal(success.json.profile.pattern, "striped");
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
      formalityLevel: "casual",
      style: "minimalistic",
      occasions: ["office"],
      season: ["spring"],
      audience: "woman",
      color: null,
      pattern: "striped",
      locale: "en"
    }
  });
  assert.equal(updateNotFound.response.status, 404);
  assert.deepEqual(updateNotFound.json, { error: "not_found" });

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
      formalityLevel: "casual",
      style: "minimalistic",
      occasions: ["office"],
      season: ["spring"],
      audience: "woman",
      color: null,
      pattern: "striped",
      locale: "en"
    }
  });
  assert.equal(updateSuccess.response.status, 200);
  assert.equal(updateSuccess.json.ok, true);

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
  let regenerateCalled = false;
  let pdfCalled = false;

  const { baseUrl } = await startTestServer(t, {
    overrides: {
      getWardrobeItemsHandler: async (_req, res) => {
        wardrobeCalled = true;
        res.json({ ok: true, status: "ready", items: [] });
      },
      regenerateSelectedWardrobeItemsHandler: async (_req, res) => {
        regenerateCalled = true;
        res.json({ ok: true, items: [{ id: "2" }] });
      },
      downloadWardrobePdfHandler: async (_req, res) => {
        pdfCalled = true;
        res.status(202).json({ status: "pending", pollAfterMs: 10 });
      }
    }
  });

  const searchOptions = await requestJson(baseUrl, "/search/options", {
    cookie: AUTH_COOKIE
  });
  assert.equal(searchOptions.response.status, 200);
  assert.equal(searchOptions.json.ok, true);

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

  const wardrobe = await requestJson(baseUrl, "/wardrobe/items", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { force: false }
  });
  assert.equal(wardrobe.response.status, 200);
  assert.equal(wardrobeCalled, true);

  const regenerate = await requestJson(baseUrl, "/wardrobe/items/regenerate-selected", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { itemIds: ["1"] }
  });
  assert.equal(regenerate.response.status, 200);
  assert.equal(regenerateCalled, true);

  const pdf = await requestJson(baseUrl, "/wardrobe/items/pdf", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { locale: "en" }
  });
  assert.equal(pdf.response.status, 202);
  assert.equal(pdfCalled, true);
});

test("index routes map search and health dependency failures", async (t) => {
  const failingSearchServer = await startTestServer(t, {
    overrides: {
      runSavedSearchImpl: async () => {
        const error = new Error("invalid_payload");
        error.code = "invalid_payload";
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
