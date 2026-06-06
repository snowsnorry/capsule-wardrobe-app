import { expect, test, vi } from "vitest";
import {
  AUTH_COOKIE,
  CSRF_TOKEN,
  TEST_CLIENT_ORIGIN,
  requestJson,
  startTestServer,
} from "../test/serverRouteTestUtils.js";

test("liked item routes require auth, trusted origin, and CSRF", async (t) => {
  const { baseUrl } = await startTestServer(t);

  const unauthenticated = await requestJson(baseUrl, "/liked-items", {
    method: "POST",
    body: { itemUrl: "https://example.com/item" },
    csrfToken: CSRF_TOKEN,
    origin: TEST_CLIENT_ORIGIN,
  });
  expect(unauthenticated.response.status).toBe(401);

  const missingCsrf = await requestJson(baseUrl, "/liked-items", {
    method: "POST",
    body: { itemUrl: "https://example.com/item" },
    cookie: AUTH_COOKIE,
    origin: TEST_CLIENT_ORIGIN,
  });
  expect(missingCsrf.response.status).toBe(403);

  const untrustedOrigin = await requestJson(baseUrl, "/liked-items", {
    method: "POST",
    body: { itemUrl: "https://example.com/item" },
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    origin: "https://evil.example.test",
  });
  expect(untrustedOrigin.response.status).toBe(403);
});

test("liked item routes validate payloads and return response shape", async (t) => {
  const upsertLikedItemImpl = vi.fn(async ({ itemUrl }) => itemUrl);
  const deleteLikedItemImpl = vi.fn(async () => true);
  const { baseUrl } = await startTestServer(t, {
    overrides: { upsertLikedItemImpl, deleteLikedItemImpl },
  });

  const invalid = await requestJson(baseUrl, "/liked-items", {
    method: "POST",
    body: { itemUrl: "ftp://example.com/item" },
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    origin: TEST_CLIENT_ORIGIN,
  });
  expect(invalid.response.status).toBe(400);
  expect(invalid.json).toEqual({ error: "invalid_payload" });

  const liked = await requestJson(baseUrl, "/liked-items", {
    method: "POST",
    body: { itemUrl: "https://example.com/item" },
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    origin: TEST_CLIENT_ORIGIN,
  });
  expect(liked.response.status).toBe(201);
  expect(liked.json).toEqual({
    ok: true,
    itemUrl: "https://example.com/item",
    isLiked: true,
  });
  expect(upsertLikedItemImpl).toHaveBeenCalledWith({
    email: "person@example.com",
    itemUrl: "https://example.com/item",
  });

  const removed = await requestJson(baseUrl, "/liked-items", {
    method: "DELETE",
    body: { itemUrl: "wardrobe://uploaded-1" },
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    origin: TEST_CLIENT_ORIGIN,
  });
  expect(removed.response.status).toBe(200);
  expect(removed.json).toEqual({
    ok: true,
    itemUrl: "wardrobe://uploaded-1",
    isLiked: false,
  });
  expect(deleteLikedItemImpl).toHaveBeenCalledWith({
    email: "person@example.com",
    itemUrl: "wardrobe://uploaded-1",
  });
});
