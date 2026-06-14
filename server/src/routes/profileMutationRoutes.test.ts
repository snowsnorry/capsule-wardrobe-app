import { test, expect, vi } from "vitest";
import {
  AUTH_COOKIE,
  CSRF_TOKEN,
  TEST_CLIENT_ORIGIN,
  requestJson,
  startTestServer,
} from "../test/serverRouteTestUtils.js";
import { buildAccountWardrobeImageKeys } from "./profileMutationHandlers.js";

test("account wardrobe image cleanup keys cover uploaded originals and derivatives only", () => {
  expect(
    buildAccountWardrobeImageKeys([
      {
        source: "uploaded",
        imageUrl: "https://images.example.com/wardrobe/profile/item_clean.png",
        rawImageUrl: "https://images.example.com/wardrobe/profile/item.webp",
      },
      {
        source: "from_catalog",
        imageUrl: "https://images.example.com/catalog/item.jpg",
      },
    ]),
  ).toEqual([
    "wardrobe/profile/item.webp",
    "wardrobe/profile/item_clean.png",
    "wardrobe/profile/item_clean_320.webp",
    "wardrobe/profile/item_clean_480.webp",
    "wardrobe/profile/item_clean_640.webp",
  ]);
});

test("profile initialize route maps validation, conflict, and success branches", async (t) => {
  const invalidServer = await startTestServer(t);
  const invalid = await requestJson(
    invalidServer.baseUrl,
    "/profile/initialize",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: {
        locale: "de",
      },
    },
  );
  expect(invalid.response.status).toBe(400);
  expect(invalid.json).toEqual({ error: "invalid_payload" });

  const existsServer = await startTestServer(t, {
    overrides: {
      createProfileImpl: async () => null,
    },
  });
  const exists = await requestJson(
    existsServer.baseUrl,
    "/profile/initialize",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: {
        locale: "en",
      },
    },
  );
  expect(exists.response.status).toBe(409);
  expect(exists.json).toEqual({ error: "profile_exists" });

  const successServer = await startTestServer(t);
  const success = await requestJson(
    successServer.baseUrl,
    "/profile/initialize",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: {
        locale: "en",
      },
    },
  );
  expect(success.response.status).toBe(200);
  expect(success.json.ok).toBe(true);
  expect(success.json.profile.locale).toBe("en");
});

test("profile mutation routes cover update, locale update, and delete branches", async (t) => {
  const notFoundUpdateServer = await startTestServer(t, {
    overrides: {
      updateProfileImpl: async () => null,
      updateProfileLocaleImpl: async () => null,
      deleteProfileImpl: async () => false,
    },
  });

  const updateNotFound = await requestJson(
    notFoundUpdateServer.baseUrl,
    "/profile/me",
    {
      method: "PATCH",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: {
        locale: "en",
        theme: "system",
        llm: "openai:gpt-5.5",
        imageLlm: "openai:gpt-image-2",
        fullname: null,
      },
    },
  );
  expect(updateNotFound.response.status).toBe(404);
  expect(updateNotFound.json).toEqual({ error: "not_found" });

  const invalidProfilePayload = await requestJson(
    notFoundUpdateServer.baseUrl,
    "/profile/me",
    {
      method: "PATCH",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: {
        locale: "en",
        theme: "sepia",
        llm: "openai:gpt-5.5",
        imageLlm: "openai:gpt-image-2",
        fullname: "Ada",
      },
    },
  );
  expect(invalidProfilePayload.response.status).toBe(400);
  expect(invalidProfilePayload.json).toEqual({ error: "invalid_payload" });

  const invalidLocale = await requestJson(
    notFoundUpdateServer.baseUrl,
    "/profile/locale",
    {
      method: "PATCH",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: { locale: "de" },
    },
  );
  expect(invalidLocale.response.status).toBe(400);
  expect(invalidLocale.json).toEqual({ error: "invalid_payload" });

  const localeNotFound = await requestJson(
    notFoundUpdateServer.baseUrl,
    "/profile/locale",
    {
      method: "PATCH",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: { locale: "ru" },
    },
  );
  expect(localeNotFound.response.status).toBe(404);
  expect(localeNotFound.json).toEqual({ error: "not_found" });

  const deleteNotFound = await requestJson(
    notFoundUpdateServer.baseUrl,
    "/profile/me",
    {
      method: "DELETE",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
    },
  );
  expect(deleteNotFound.response.status).toBe(404);
  expect(deleteNotFound.json).toEqual({ error: "not_found" });

  const successServer = await startTestServer(t);
  const updateSuccess = await requestJson(
    successServer.baseUrl,
    "/profile/me",
    {
      method: "PATCH",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: {
        locale: "ru",
        theme: "dark",
        llm: "claude:claude-opus-4-7",
        imageLlm: "gemini:gemini-3-pro-image",
        fullname: "  Ada Lovelace  ",
      },
    },
  );
  expect(updateSuccess.response.status).toBe(200);
  expect(updateSuccess.json.ok).toBe(true);
  expect(updateSuccess.json.profile.locale).toBe("ru");
  expect(updateSuccess.json.profile.theme).toBe("dark");
  expect(updateSuccess.json.profile.llm).toBe("claude:claude-opus-4-7");
  expect(updateSuccess.json.profile.imageLlm).toBe("gemini:gemini-3-pro-image");
  expect(updateSuccess.json.profile.fullname).toBe("Ada Lovelace");

  const localeSuccess = await requestJson(
    successServer.baseUrl,
    "/profile/locale",
    {
      method: "PATCH",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: { locale: "ru" },
    },
  );
  expect(localeSuccess.response.status).toBe(200);
  expect(localeSuccess.json.profile.locale).toBe("ru");

  const deleteSuccess = await requestJson(
    successServer.baseUrl,
    "/profile/me",
    {
      method: "DELETE",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
    },
  );
  expect(deleteSuccess.response.status).toBe(200);
  expect(deleteSuccess.json).toEqual({ ok: true });
});

test("profile delete clears auth cookies and cleans uploaded wardrobe images best-effort", async (t) => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const calls: Array<{ type: string; payload?: unknown }> = [];
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      clearAccountTransientStateImpl: (email) => {
        calls.push({ type: "clearTransient", payload: email });
      },
      deleteProfileImpl: async (email) => {
        calls.push({ type: "deleteProfile", payload: email });
        return true;
      },
      deleteR2ObjectsImpl: async (payload) => {
        calls.push({ type: "deleteR2", payload });
        throw new Error("r2_failed");
      },
      listWardrobeItemsImpl: async (payload) => {
        calls.push({ type: "listWardrobe", payload });
        return [
          {
            id: "uploaded-1",
            source: "uploaded",
            imageUrl:
              "https://images.example.com/wardrobe/profile/image_clean.png",
            rawImageUrl:
              "https://images.example.com/wardrobe/profile/image.webp",
          },
          {
            id: "catalog-1",
            source: "from_catalog",
            imageUrl: "https://catalog.example.com/item.jpg",
          },
        ];
      },
    },
  });

  const deleted = await requestJson(baseUrl, "/profile/me", {
    method: "DELETE",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
  });

  expect(deleted.response.status).toBe(200);
  expect(deleted.json).toEqual({ ok: true });
  expect(consoleError).toHaveBeenCalled();
  expect(deleted.response.headers.get("set-cookie")).toContain("session=");
  expect(deleted.response.headers.get("set-cookie")).toContain("csrf=");
  expect(deleted.response.headers.get("set-cookie")).toContain(
    "passkey_challenge=",
  );
  expect(calls).toEqual([
    {
      type: "listWardrobe",
      payload: { email: "person@example.com", source: "uploaded" },
    },
    { type: "deleteProfile", payload: "person@example.com" },
    { type: "clearTransient", payload: "person@example.com" },
    {
      type: "deleteR2",
      payload: {
        keys: [
          "wardrobe/profile/image.webp",
          "wardrobe/profile/image_clean.png",
          "wardrobe/profile/image_clean_320.webp",
          "wardrobe/profile/image_clean_480.webp",
          "wardrobe/profile/image_clean_640.webp",
        ],
      },
    },
  ]);
});
