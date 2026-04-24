import { beforeEach, describe, expect, test, vi } from "vitest";

const requestApi = vi.hoisted(() => ({
  request: vi.fn(),
  requestJson: vi.fn()
}));

vi.mock("./request", () => requestApi);
vi.mock("./config", () => ({
  API_BASE_URL: "https://api.example.test"
}));

import {
  createCapsule,
  fetchSharedCapsule,
  importSharedCapsule,
  shareCapsule,
  updateCapsuleFilters,
  updateCapsuleRejectedUrls
} from "./capsules";

describe("capsules api", () => {
  beforeEach(() => {
    requestApi.request.mockReset();
    requestApi.requestJson.mockReset();
    requestApi.requestJson.mockResolvedValue({});
    window.history.replaceState({}, "", "/");
  });

  test("createCapsule only sends name and filters", async () => {
    await createCapsule({
      name: "Spring edit",
      filters: {
        audience: "woman"
      },
      draft: {
        filters: { audience: "man" },
        data: {
          wardrobe: { items: [{ url: "https://example.com/1" }] },
          rejectedUrls: ["https://example.com/1"]
        }
      },
      saved: {
        filters: { audience: "man" }
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
            audience: "woman"
          }
        })
      }
    );
  });

  test("capsule mutation helpers use explicit filters and rejected urls routes", async () => {
    await updateCapsuleFilters("capsule-1", { audience: "woman" });
    await updateCapsuleRejectedUrls("capsule-1", ["https://example.com/1"]);

    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      1,
      "https://api.example.test/capsules/capsule-1/filters",
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters: { audience: "woman" }
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

  test("updateCapsuleFilters appends only regenerate query flag when requested", async () => {
    await updateCapsuleFilters("capsule-1", { audience: "woman" }, { regenerate: true });

    expect(requestApi.requestJson).toHaveBeenCalledWith(
      "https://api.example.test/capsules/capsule-1/filters?regenerate=true",
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters: { audience: "woman" }
        })
      }
    );
  });

  test("share helpers use capsule and shared-capsule routes", async () => {
    await shareCapsule("capsule-1");
    await fetchSharedCapsule("share/1");
    await importSharedCapsule("share/1");

    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      1,
      "https://api.example.test/capsules/capsule-1/share",
      {
        method: "POST",
        credentials: "include"
      }
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      2,
      "https://api.example.test/shared-capsules/share%2F1",
      {
        credentials: "include"
      }
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      3,
      "https://api.example.test/shared-capsules/share%2F1/import",
      {
        method: "POST",
        credentials: "include"
      }
    );
  });
});
