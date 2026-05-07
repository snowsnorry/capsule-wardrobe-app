import { test, expect } from "vitest";
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
  expect(invalid.response.status).toBe(400);
  expect(invalid.json).toEqual({ error: "invalid_payload" });

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
  expect(exists.response.status).toBe(409);
  expect(exists.json).toEqual({ error: "profile_exists" });

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
  expect(success.response.status).toBe(200);
  expect(success.json.ok).toBe(true);
  expect(success.json.profile.locale).toBe("en");
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
  expect(updateNotFound.response.status).toBe(404);
  expect(updateNotFound.json).toEqual({ error: "not_found" });

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
  expect(invalidProfilePayload.response.status).toBe(400);
  expect(invalidProfilePayload.json).toEqual({ error: "invalid_payload" });

  const invalidLocale = await requestJson(notFoundUpdateServer.baseUrl, "/profile/locale", {
    method: "PATCH",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { locale: "de" }
  });
  expect(invalidLocale.response.status).toBe(400);
  expect(invalidLocale.json).toEqual({ error: "invalid_payload" });

  const localeNotFound = await requestJson(notFoundUpdateServer.baseUrl, "/profile/locale", {
    method: "PATCH",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { locale: "ru" }
  });
  expect(localeNotFound.response.status).toBe(404);
  expect(localeNotFound.json).toEqual({ error: "not_found" });

  const deleteNotFound = await requestJson(notFoundUpdateServer.baseUrl, "/profile/me", {
    method: "DELETE",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN
  });
  expect(deleteNotFound.response.status).toBe(404);
  expect(deleteNotFound.json).toEqual({ error: "not_found" });

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
  expect(updateSuccess.response.status).toBe(200);
  expect(updateSuccess.json.ok).toBe(true);
  expect(updateSuccess.json.profile.locale).toBe("ru");
  expect(updateSuccess.json.profile.theme).toBe("dark");
  expect(updateSuccess.json.profile.llm).toBe("claude:claude-opus-4-7");
  expect(updateSuccess.json.profile.image_llm).toBe("gemini:gemini-3-pro-image-preview");
  expect(updateSuccess.json.profile.fullname).toBe("Ada Lovelace");

  const localeSuccess = await requestJson(successServer.baseUrl, "/profile/locale", {
    method: "PATCH",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { locale: "ru" }
  });
  expect(localeSuccess.response.status).toBe(200);
  expect(localeSuccess.json.profile.locale).toBe("ru");

  const deleteSuccess = await requestJson(successServer.baseUrl, "/profile/me", {
    method: "DELETE",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN
  });
  expect(deleteSuccess.response.status).toBe(200);
  expect(deleteSuccess.json).toEqual({ ok: true });
});
