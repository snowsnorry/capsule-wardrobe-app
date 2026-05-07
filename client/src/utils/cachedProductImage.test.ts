import { describe, expect, test, vi } from "vitest";
import { buildCachedProductImageUrl, sha256Hex } from "./cachedProductImage";

vi.mock("../api/config", () => ({
  API_BASE_URL: "https://api.example.test"
}));

describe("cachedProductImage", () => {
  test("builds stable cached image URLs for safe HTTP URLs", async () => {
    const digest = await sha256Hex("https://example.com/image.jpg");

    await expect(buildCachedProductImageUrl(" https://example.com/image.jpg ")).resolves.toBe(
      `https://api.example.test/images/${digest}.jpg`
    );
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
  });

  test("rejects unsafe and blank image URLs", async () => {
    await expect(buildCachedProductImageUrl("javascript:alert(1)")).resolves.toBe("");
    await expect(buildCachedProductImageUrl(null)).resolves.toBe("");
  });
});
