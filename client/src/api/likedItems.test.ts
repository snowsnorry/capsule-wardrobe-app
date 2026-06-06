import { beforeEach, describe, expect, test, vi } from "vitest";

const requestApi = vi.hoisted(() => ({
  requestJson: vi.fn(),
}));

vi.mock("./request", () => requestApi);
vi.mock("./config", () => ({
  API_BASE_URL: "https://api.example.test",
}));

import { likeItem, removeItemLike } from "./likedItems";

describe("likedItems api", () => {
  beforeEach(() => {
    requestApi.requestJson.mockReset();
    requestApi.requestJson.mockResolvedValue({});
  });

  test("likeItem posts the canonical item URL", async () => {
    await likeItem("https://example.com/item");

    expect(requestApi.requestJson).toHaveBeenCalledWith(
      "https://api.example.test/liked-items",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ itemUrl: "https://example.com/item" }),
      },
    );
  });

  test("removeItemLike deletes by canonical item URL", async () => {
    await removeItemLike("wardrobe://uploaded-1");

    expect(requestApi.requestJson).toHaveBeenCalledWith(
      "https://api.example.test/liked-items",
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ itemUrl: "wardrobe://uploaded-1" }),
      },
    );
  });
});
