import { expect, test, vi } from "vitest";
import {
  AUTH_COOKIE,
  requestJson,
  startTestServer,
} from "../test/serverRouteTestUtils.js";

test("app bootstrap returns profile, sidebar lists, filters, and wardrobe count", async (t) => {
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      countCapsulesImpl: async () => 12,
      countOutfitsImpl: async () => 8,
      countWardrobeItemsImpl: async () => 42,
      listRecentCapsulesImpl: async (_email, limit, offset) => [
        { id: "capsule-1", name: `Capsule ${limit}:${offset}` },
      ],
      listRecentOutfitsImpl: async (_email, limit, offset) => [
        {
          id: "outfit-1",
          name: `Outfit ${limit}:${offset}`,
          effective: { items: [] },
        },
      ],
    },
  });

  const bootstrap = await requestJson(baseUrl, "/app/bootstrap", {
    cookie: AUTH_COOKIE,
  });

  expect(bootstrap.response.status).toBe(200);
  expect(bootstrap.json).toMatchObject({
    ok: true,
    hasProfile: true,
    profile: { email: "person@example.com", locale: "en" },
    activeCapsule: null,
    activeSnapshot: null,
    capsulePagination: { limit: 10, offset: 0, total: 12, hasMore: true },
    outfitPagination: { limit: 10, offset: 0, total: 8, hasMore: false },
    wardrobeCount: 42,
    wardrobeFilters: {
      formalityLevels: ["casual", "formal"],
      styles: ["minimalistic", "sporty"],
      occasions: ["office", "date_night"],
      seasons: ["spring", "summer"],
      audience: ["man", "woman", "any"],
      patterns: ["striped", "plain"],
    },
  });
  expect(bootstrap.json.capsules).toEqual([
    expect.objectContaining({ id: "capsule-1" }),
  ]);
  expect(bootstrap.json.outfits).toEqual([
    expect.objectContaining({ id: "outfit-1" }),
  ]);
});

test("app bootstrap skips sidebar lookups when profile is missing", async (t) => {
  const lookup = vi.fn();
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      getProfileImpl: async () => null,
      countCapsulesImpl: lookup,
      countOutfitsImpl: lookup,
      countWardrobeItemsImpl: lookup,
      listRecentCapsulesImpl: lookup,
      listRecentOutfitsImpl: lookup,
    },
  });

  const bootstrap = await requestJson(baseUrl, "/app/bootstrap", {
    cookie: AUTH_COOKIE,
  });

  expect(bootstrap.response.status).toBe(200);
  expect(bootstrap.json).toEqual({
    ok: true,
    hasProfile: false,
    profile: null,
    activeCapsule: null,
    activeSnapshot: null,
    capsules: [],
    capsulePagination: null,
    outfits: [],
    outfitPagination: null,
    wardrobeFilters: null,
    wardrobeCount: 0,
  });
  expect(lookup).not.toHaveBeenCalled();
});

test("app bootstrap tolerates optional sidebar failures", async (t) => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      countOutfitsImpl: async () => {
        throw new Error("outfit_count_down");
      },
      countWardrobeItemsImpl: async () => {
        throw new Error("wardrobe_count_down");
      },
      listRecentOutfitsImpl: async () => {
        throw new Error("outfit_list_down");
      },
    },
  });

  const bootstrap = await requestJson(baseUrl, "/app/bootstrap", {
    cookie: AUTH_COOKIE,
  });
  expect(bootstrap.response.status).toBe(200);
  expect(bootstrap.json).toMatchObject({
    ok: true,
    outfits: [],
    outfitPagination: { limit: 10, offset: 0, total: 0, hasMore: false },
    wardrobeCount: null,
  });
});

test("app bootstrap maps critical failures and old bootstrap endpoints are gone", async (t) => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      listRecentCapsulesImpl: async () => {
        throw new Error("capsule_store_down");
      },
    },
  });

  const failure = await requestJson(baseUrl, "/app/bootstrap", {
    cookie: AUTH_COOKIE,
  });
  expect(failure.response.status).toBe(503);
  expect(failure.json).toEqual({ error: "service_unavailable" });

  const capsuleBootstrap = await requestJson(baseUrl, "/capsules/bootstrap", {
    cookie: AUTH_COOKIE,
  });
  expect(capsuleBootstrap.response.status).toBe(404);

  const outfitBootstrap = await requestJson(baseUrl, "/outfits/bootstrap", {
    cookie: AUTH_COOKIE,
  });
  expect(outfitBootstrap.response.status).toBe(404);
});
