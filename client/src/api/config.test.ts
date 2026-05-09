import { afterEach, describe, expect, test, vi } from "vitest";

describe("api config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  test("uses the default API base without a trailing slash", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    vi.stubEnv("VITE_THUMBNAIL_ASSET_BASE_URL", "");
    const { API_BASE_URL } = await import("./config");

    expect(API_BASE_URL).toBe("/api");
  });

  test("trims a configured trailing slash", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test/");
    vi.stubEnv(
      "VITE_THUMBNAIL_ASSET_BASE_URL",
      "https://assets.example.test/thumbnails/",
    );
    const { API_BASE_URL, THUMBNAIL_ASSET_BASE_URL } = await import("./config");

    expect(API_BASE_URL).toBe("https://api.example.test");
    expect(THUMBNAIL_ASSET_BASE_URL).toBe(
      "https://assets.example.test/thumbnails",
    );
  });

  test("uses the default thumbnail asset base without a trailing slash", async () => {
    vi.stubEnv("VITE_THUMBNAIL_ASSET_BASE_URL", "");
    const { THUMBNAIL_ASSET_BASE_URL } = await import("./config");

    expect(THUMBNAIL_ASSET_BASE_URL).toBe(
      "https://assets.capsule-wardrobe.org/thumbnails",
    );
  });
});
