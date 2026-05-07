import { afterEach, describe, expect, test, vi } from "vitest";

describe("api config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  test("uses the default API base without a trailing slash", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    const { API_BASE_URL } = await import("./config");

    expect(API_BASE_URL).toBe("/api");
  });

  test("trims a configured trailing slash", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test/");
    const { API_BASE_URL } = await import("./config");

    expect(API_BASE_URL).toBe("https://api.example.test");
  });
});
