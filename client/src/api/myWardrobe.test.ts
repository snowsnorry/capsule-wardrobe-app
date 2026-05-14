import { beforeEach, describe, expect, test, vi } from "vitest";

const requestApi = vi.hoisted(() => ({
  getCachedJson: vi.fn(),
  requestJson: vi.fn(),
}));

vi.mock("./request", () => requestApi);
vi.mock("./config", () => ({
  API_BASE_URL: "https://api.example.test",
}));

import {
  fetchMyWardrobeItems,
  getWardrobeItemsUrl,
  removeCatalogItemFromMyWardrobe,
  saveCatalogItemToMyWardrobe,
} from "./myWardrobe";

describe("my wardrobe api", () => {
  beforeEach(() => {
    requestApi.getCachedJson.mockReset();
    requestApi.getCachedJson.mockResolvedValue({ ok: true, items: [] });
    requestApi.requestJson.mockReset();
    requestApi.requestJson.mockResolvedValue({ ok: true, items: [] });
  });

  test("builds list URLs with optional source filters", () => {
    expect(getWardrobeItemsUrl()).toBe(
      "https://api.example.test/wardrobe/items",
    );
    expect(getWardrobeItemsUrl({ source: "uploaded" })).toBe(
      "https://api.example.test/wardrobe/items?source=uploaded",
    );
  });

  test("fetches my wardrobe items", async () => {
    await fetchMyWardrobeItems({ source: "from_catalog" });

    expect(requestApi.getCachedJson).toHaveBeenCalledWith(
      "https://api.example.test/wardrobe/items?source=from_catalog",
      {
        credentials: "include",
      },
    );
    expect(requestApi.requestJson).not.toHaveBeenCalled();
  });

  test("saves catalog items to my wardrobe", async () => {
    await saveCatalogItemToMyWardrobe("https://example.com/1");

    expect(requestApi.requestJson).toHaveBeenCalledWith(
      "https://api.example.test/wardrobe/items/from-catalog",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url: "https://example.com/1" }),
      },
    );
  });

  test("removes catalog items from my wardrobe", async () => {
    await removeCatalogItemFromMyWardrobe("https://example.com/1");

    expect(requestApi.requestJson).toHaveBeenCalledWith(
      "https://api.example.test/wardrobe/items/from-catalog",
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url: "https://example.com/1" }),
      },
    );
  });
});
