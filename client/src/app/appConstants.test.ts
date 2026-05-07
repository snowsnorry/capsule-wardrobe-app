import { afterEach, describe, expect, test, vi } from "vitest";

describe("appConstants", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  test("reads configured Google client id and falls back to empty string", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "google-client");
    await expect(import("./appConstants")).resolves.toMatchObject({
      GOOGLE_CLIENT_ID: "google-client"
    });

    vi.resetModules();
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
    await expect(import("./appConstants")).resolves.toMatchObject({
      GOOGLE_CLIENT_ID: ""
    });
  });
});
