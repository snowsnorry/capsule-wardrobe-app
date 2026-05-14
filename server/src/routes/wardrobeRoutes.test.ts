import { test, expect, vi } from "vitest";
import {
  AUTH_COOKIE,
  CSRF_TOKEN,
  TEST_CLIENT_ORIGIN,
  requestJson,
  startTestServer,
} from "../test/serverRouteTestUtils.js";

test("wardrobe routes list and save user wardrobe items", async (t) => {
  const calls: unknown[] = [];
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      listWardrobeItemsImpl: async (payload) => {
        calls.push({ type: "list", payload });
        return [
          {
            id: "wardrobe-1",
            url: "https://example.com/1",
            source: "from_catalog",
          },
        ];
      },
      saveWardrobeItemFromCatalogImpl: async (payload) => {
        calls.push({ type: "save", payload });
        return {
          id: "wardrobe-1",
          url: payload.url,
          source: "from_catalog",
        };
      },
      deleteWardrobeItemFromCatalogImpl: async (payload) => {
        calls.push({ type: "delete", payload });
        return true;
      },
    },
  });

  const list = await requestJson(
    baseUrl,
    "/wardrobe/items?source=from_catalog",
    {
      cookie: AUTH_COOKIE,
    },
  );
  expect(list.response.status).toBe(200);
  expect(list.json).toEqual({
    ok: true,
    items: [
      {
        id: "wardrobe-1",
        url: "https://example.com/1",
        source: "from_catalog",
      },
    ],
  });

  const save = await requestJson(baseUrl, "/wardrobe/items/from-catalog", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { url: "https://example.com/1" },
  });
  expect(save.response.status).toBe(201);
  expect(save.json).toEqual({
    ok: true,
    item: {
      id: "wardrobe-1",
      url: "https://example.com/1",
      source: "from_catalog",
    },
  });

  const deleted = await requestJson(baseUrl, "/wardrobe/items/from-catalog", {
    method: "DELETE",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { url: "https://example.com/1" },
  });
  expect(deleted.response.status).toBe(200);
  expect(deleted.json).toEqual({ ok: true, removed: true });

  expect(calls).toEqual([
    {
      type: "list",
      payload: { email: "person@example.com", source: "from_catalog" },
    },
    {
      type: "save",
      payload: { email: "person@example.com", url: "https://example.com/1" },
    },
    {
      type: "delete",
      payload: { email: "person@example.com", url: "https://example.com/1" },
    },
  ]);
});

test("wardrobe routes validate source and catalog item payloads", async (t) => {
  const { baseUrl } = await startTestServer(t);

  const invalidSource = await requestJson(
    baseUrl,
    "/wardrobe/items?source=other",
    {
      cookie: AUTH_COOKIE,
    },
  );
  expect(invalidSource.response.status).toBe(400);
  expect(invalidSource.json).toEqual({ error: "invalid_payload" });

  const invalidSave = await requestJson(
    baseUrl,
    "/wardrobe/items/from-catalog",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: { url: "ftp://example.com/1" },
    },
  );
  expect(invalidSave.response.status).toBe(400);
  expect(invalidSave.json).toEqual({ error: "invalid_payload" });

  const invalidDelete = await requestJson(
    baseUrl,
    "/wardrobe/items/from-catalog",
    {
      method: "DELETE",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: { url: "ftp://example.com/1" },
    },
  );
  expect(invalidDelete.response.status).toBe(400);
  expect(invalidDelete.json).toEqual({ error: "invalid_payload" });
});

test("wardrobe routes map missing products and service failures", async (t) => {
  vi.spyOn(console, "error").mockImplementation(() => {});

  const notFoundServer = await startTestServer(t, {
    overrides: {
      saveWardrobeItemFromCatalogImpl: async () => null,
    },
  });
  const notFound = await requestJson(
    notFoundServer.baseUrl,
    "/wardrobe/items/from-catalog",
    {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: { url: "https://example.com/missing" },
    },
  );
  expect(notFound.response.status).toBe(404);
  expect(notFound.json).toEqual({ error: "not_found" });

  const failingListServer = await startTestServer(t, {
    overrides: {
      listWardrobeItemsImpl: async () => {
        throw new Error("wardrobe_down");
      },
    },
  });
  const listFailure = await requestJson(
    failingListServer.baseUrl,
    "/wardrobe/items",
    {
      cookie: AUTH_COOKIE,
    },
  );
  expect(listFailure.response.status).toBe(503);
  expect(listFailure.json).toEqual({ error: "service_unavailable" });

  const failingDeleteServer = await startTestServer(t, {
    overrides: {
      deleteWardrobeItemFromCatalogImpl: async () => {
        throw new Error("wardrobe_down");
      },
    },
  });
  const deleteFailure = await requestJson(
    failingDeleteServer.baseUrl,
    "/wardrobe/items/from-catalog",
    {
      method: "DELETE",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN,
      body: { url: "https://example.com/1" },
    },
  );
  expect(deleteFailure.response.status).toBe(503);
  expect(deleteFailure.json).toEqual({ error: "service_unavailable" });
});
