import test from "node:test";
import assert from "node:assert/strict";
import { AUTH_COOKIE, CSRF_TOKEN, TEST_CLIENT_ORIGIN, requestJson, startTestServer } from "../test/serverRouteTestUtils.js";

test("profile initialize route maps validation, conflict, and success branches", async (t) => {
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

test("profile mutation routes cover update, locale update, and delete branches", async (t) => {
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
      llm: "openai:gpt-5.5",
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
      llm: "openai:gpt-5.5",
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
