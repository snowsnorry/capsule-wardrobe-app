import { describe, expect, test, vi } from "vitest";
import { createAppDependencies } from "./appDependencies.js";
import { generateOutfitReport } from "./ai/outfitReportService.js";

vi.mock("./ai/outfitReportService.js", () => ({
  generateOutfitReport: vi.fn(async () => ({
    schemaVersion: 1,
    itemsHash: "items-hash",
  })),
}));

describe("createAppDependencies outfit report wiring", () => {
  test("passes store lookup helpers into the report workflow", async () => {
    const deps = createAppDependencies();

    await deps.generateOutfitReportImpl("person@example.com", "outfit-1");

    expect(generateOutfitReport).toHaveBeenCalledWith(
      "person@example.com",
      "outfit-1",
      expect.objectContaining({
        getProductsByUrlsForEmailImpl: expect.any(Function),
        listWardrobeItemsByUrlsImpl: expect.any(Function),
        updateOutfitReportImpl: expect.any(Function),
      }),
    );
  });

  test("keeps injected dependencies ahead of production defaults", () => {
    const sendLoginCodeEmailImpl = vi.fn();
    const mcpOAuthConfig = { issuer: "https://test.example.com" };

    const deps = createAppDependencies({
      authTestMode: true,
      googleAuthClient: null,
      googleClientId: null,
      mcpOAuthConfig,
      sendLoginCodeEmailImpl,
    });

    expect(deps.authTestMode).toBe(true);
    expect(deps.googleAuthClient).toBeNull();
    expect(deps.googleClientId).toBeNull();
    expect(deps.mcpOAuthConfig).toBe(mcpOAuthConfig);
    expect(deps.sendLoginCodeEmailImpl).toBe(sendLoginCodeEmailImpl);
  });
});
