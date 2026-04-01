import { beforeEach, describe, expect, test, vi } from "vitest";

const requestApi = vi.hoisted(() => ({
  request: vi.fn(),
  requestJson: vi.fn()
}));

vi.mock("./request.js", () => requestApi);
vi.mock("./config.js", () => ({
  API_BASE_URL: "https://api.example.test"
}));

import {
  createCapsule,
  updateCapsuleFilters,
  updateCapsuleRejectedUrls
} from "./capsules.js";

describe("capsules api", () => {
  beforeEach(() => {
    requestApi.request.mockReset();
    requestApi.requestJson.mockReset();
    requestApi.requestJson.mockResolvedValue({});
  });

  test("createCapsule only sends name and filters", async () => {
    await createCapsule({
      name: "Spring edit",
      filters: {
        locale: "en",
        audience: "woman"
      },
      draft: {
        filters: { locale: "ru" },
        data: {
          wardrobe: { items: [{ url: "https://example.com/1" }] },
          rejectedUrls: ["https://example.com/1"]
        }
      },
      saved: {
        filters: { locale: "ru" }
      }
    });

    expect(requestApi.requestJson).toHaveBeenCalledWith(
      "https://api.example.test/capsules",
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Spring edit",
          filters: {
            locale: "en",
            audience: "woman"
          }
        })
      }
    );
  });

  test("capsule mutation helpers use explicit filters and rejected urls routes", async () => {
    await updateCapsuleFilters("capsule-1", { locale: "en" });
    await updateCapsuleRejectedUrls("capsule-1", ["https://example.com/1"]);

    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      1,
      "https://api.example.test/capsules/capsule-1/filters",
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters: { locale: "en" }
        })
      }
    );

    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      2,
      "https://api.example.test/capsules/capsule-1/rejected-urls",
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rejectedUrls: ["https://example.com/1"]
        })
      }
    );
  });
});
