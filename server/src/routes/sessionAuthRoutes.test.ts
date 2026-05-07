import { test, expect, vi } from "vitest";
import {
  AUTH_COOKIE,
  CSRF_TOKEN,
  SESSION_ID,
  TEST_CLIENT_ORIGIN,
  requestJson,
  startTestServer,
} from "../test/serverRouteTestUtils.js";

test("session status requires auth and returns current user", async (t) => {
  const { baseUrl } = await startTestServer(t);

  const unauthorized = await requestJson(baseUrl, "/auth/me");
  expect(unauthorized.response.status).toBe(401);
  expect(unauthorized.json).toEqual({ error: "unauthorized" });

  const authorized = await requestJson(baseUrl, "/auth/me", {
    cookie: AUTH_COOKIE,
  });
  expect(authorized.response.status).toBe(200);
  expect(authorized.json).toEqual({
    ok: true,
    user: { email: "person@example.com" },
  });
});

test("session auth request-code route maps validation and delivery branches", async (t) => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});

  const invalidServer = await startTestServer(t);
  const invalid = await requestJson(
    invalidServer.baseUrl,
    "/auth/request-code",
    {
      method: "POST",
      body: { email: "bad-email", locale: "ru" },
    },
  );
  expect(invalid.response.status).toBe(400);
  expect(invalid.json).toEqual({ error: "invalid_email" });

  const cooldownServer = await startTestServer(t, {
    overrides: {
      createPendingCodeImpl: async () => ({ ok: false, reason: "cooldown" }),
    },
  });
  const cooldown = await requestJson(
    cooldownServer.baseUrl,
    "/auth/request-code",
    {
      method: "POST",
      body: { email: "person@example.com", locale: "ru" },
    },
  );
  expect(cooldown.response.status).toBe(429);
  expect(cooldown.json.error).toBe("cooldown");

  const rateLimitedServer = await startTestServer(t, {
    overrides: {
      createPendingCodeImpl: async () => ({ ok: false, reason: "rate_limit" }),
    },
  });
  const rateLimited = await requestJson(
    rateLimitedServer.baseUrl,
    "/auth/request-code",
    {
      method: "POST",
      body: { email: "person@example.com", locale: "ru" },
    },
  );
  expect(rateLimited.response.status).toBe(429);
  expect(rateLimited.json.error).toBe("rate_limit");

  let emailSent = false;
  const authTestModeServer = await startTestServer(t, {
    authTestMode: true,
    overrides: {
      sendLoginCodeEmailImpl: async () => {
        emailSent = true;
      },
    },
  });
  const authTestMode = await requestJson(
    authTestModeServer.baseUrl,
    "/auth/request-code",
    {
      method: "POST",
      body: { email: "person@example.com", locale: "ru" },
    },
  );
  expect(authTestMode.response.status).toBe(200);
  expect(authTestMode.json.ok).toBe(true);
  expect(emailSent).toBe(false);

  const emailUnavailableServer = await startTestServer(t, {
    overrides: {
      sendLoginCodeEmailImpl: async () => {
        throw new Error("smtp_down");
      },
    },
  });
  const emailUnavailable = await requestJson(
    emailUnavailableServer.baseUrl,
    "/auth/request-code",
    {
      method: "POST",
      body: { email: "person@example.com", locale: "en" },
    },
  );
  expect(emailUnavailable.response.status).toBe(503);
  expect(emailUnavailable.json).toEqual({ error: "email_unavailable" });
});

test("session auth verify-code route maps failures and sets cookies on success", async (t) => {
  const invalidPayloadServer = await startTestServer(t);
  const invalidPayload = await requestJson(
    invalidPayloadServer.baseUrl,
    "/auth/verify-code",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      body: { email: "", code: "" },
    },
  );
  expect(invalidPayload.response.status).toBe(400);
  expect(invalidPayload.json).toEqual({ error: "invalid_payload" });

  const expiredServer = await startTestServer(t, {
    overrides: {
      verifyCodeImpl: async () => ({ ok: false, reason: "expired" }),
    },
  });
  const expired = await requestJson(
    expiredServer.baseUrl,
    "/auth/verify-code",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      body: { email: "person@example.com", code: "123456" },
    },
  );
  expect(expired.response.status).toBe(400);
  expect(expired.json).toEqual({ error: "expired" });

  const maxAttemptsServer = await startTestServer(t, {
    overrides: {
      verifyCodeImpl: async () => ({ ok: false, reason: "max_attempts" }),
    },
  });
  const maxAttempts = await requestJson(
    maxAttemptsServer.baseUrl,
    "/auth/verify-code",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      body: { email: "person@example.com", code: "123456" },
    },
  );
  expect(maxAttempts.response.status).toBe(429);
  expect(maxAttempts.json.error).toBe("max_attempts");

  const invalidServer = await startTestServer(t, {
    overrides: {
      verifyCodeImpl: async () => ({ ok: false, reason: "invalid" }),
    },
  });
  const invalid = await requestJson(
    invalidServer.baseUrl,
    "/auth/verify-code",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      body: { email: "person@example.com", code: "123456" },
    },
  );
  expect(invalid.response.status).toBe(400);
  expect(invalid.json).toEqual({ error: "invalid" });

  const forbiddenOriginServer = await startTestServer(t);
  const forbiddenOrigin = await requestJson(
    forbiddenOriginServer.baseUrl,
    "/auth/verify-code",
    {
      method: "POST",
      origin: "https://evil.example",
      body: { email: "person@example.com", code: "123456" },
    },
  );
  expect(forbiddenOrigin.response.status).toBe(403);
  expect(forbiddenOrigin.json).toEqual({ error: "forbidden_origin" });

  const successServer = await startTestServer(t);
  const success = await requestJson(
    successServer.baseUrl,
    "/auth/verify-code",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      body: { email: "person@example.com", code: "123456" },
    },
  );
  expect(success.response.status).toBe(200);
  expect(success.json).toEqual({
    ok: true,
    user: { email: "person@example.com" },
  });
  const setCookie = success.response.headers.get("set-cookie");
  expect(setCookie.includes("session=")).toBeTruthy();
  expect(setCookie.includes("csrf=")).toBeTruthy();
});

test("google auth route covers not-configured, invalid token, and success", async (t) => {
  vi.spyOn(console, "error").mockImplementation(() => {});

  const missingConfigServer = await startTestServer(t, {
    googleClientId: "",
    googleAuthClient: null,
  });
  const missingConfig = await requestJson(
    missingConfigServer.baseUrl,
    "/auth/google",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      body: { idToken: "token" },
    },
  );
  expect(missingConfig.response.status).toBe(503);
  expect(missingConfig.json).toEqual({ error: "google_auth_not_configured" });

  const invalidTokenServer = await startTestServer(t, {
    googleAuthClient: {
      verifyIdToken: async () => {
        throw new Error("bad_token");
      },
    },
  });
  const invalidToken = await requestJson(
    invalidTokenServer.baseUrl,
    "/auth/google",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      body: { idToken: "bad-token" },
    },
  );
  expect(invalidToken.response.status).toBe(401);
  expect(invalidToken.json).toEqual({ error: "invalid_google_token" });

  const successServer = await startTestServer(t, {
    googleAuthClient: {
      verifyIdToken: async () => ({
        getPayload: () => ({
          email: "GoogleUser@example.com",
          email_verified: true,
        }),
      }),
    },
  });
  const success = await requestJson(successServer.baseUrl, "/auth/google", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    body: { idToken: "good-token" },
  });
  expect(success.response.status).toBe(200);
  expect(success.json).toEqual({
    ok: true,
    user: { email: "googleuser@example.com" },
  });
});

test("logout route enforces csrf and revokes the current session", async (t) => {
  let revokedSessionId = null;
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      revokeSessionImpl: async (sessionId) => {
        revokedSessionId = sessionId;
      },
    },
  });

  const missingCsrf = await requestJson(baseUrl, "/auth/logout", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
  });
  expect(missingCsrf.response.status).toBe(403);
  expect(missingCsrf.json).toEqual({ error: "csrf_invalid" });

  const success = await requestJson(baseUrl, "/auth/logout", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
  });
  expect(success.response.status).toBe(200);
  expect(success.json).toEqual({ ok: true });
  expect(revokedSessionId).toBe(SESSION_ID);
});
