import test from "node:test";
import assert from "node:assert/strict";
import { AUTH_COOKIE, CSRF_TOKEN, SESSION_ID, TEST_CLIENT_ORIGIN, requestJson, startTestServer } from "../test/serverRouteTestUtils.js";

test("session status requires auth and returns current user", async (t) => {
  const { baseUrl } = await startTestServer(t);

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

test("session auth request-code route maps validation and delivery branches", async (t) => {
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

test("session auth verify-code route maps failures and sets cookies on success", async (t) => {
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

test("google auth route covers not-configured, invalid token, and success", async (t) => {
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

test("logout route enforces csrf and revokes the current session", async (t) => {
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
