import { describe, expect, test } from "vitest";

import {
  buildMcpImageThumbnailUrl,
  normalizeThumbnailAssetBaseUrl,
  sha256Hex,
} from "./mcpImageThumbnails.js";

describe("mcpImageThumbnails", () => {
  test("builds the largest catalog thumbnail URL from the original image URL", () => {
    const digest = sha256Hex("https://example.com/image.jpg");

    expect(
      buildMcpImageThumbnailUrl(" https://example.com/image.jpg ", {
        thumbnailAssetBaseUrl: "https://assets.example.test/thumbnails/",
      }),
    ).toBe(`https://assets.example.test/thumbnails/${digest}_640.webp`);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
  });

  test("builds the largest colocated uploaded thumbnail URL", () => {
    expect(
      buildMcpImageThumbnailUrl(
        "https://images.example.test/wardrobe/profile/item_clean.png?raw=1#view",
        { source: "uploaded" },
      ),
    ).toBe("https://images.example.test/wardrobe/profile/item_clean_640.webp");
  });

  test("rejects unsafe or blank image URLs", () => {
    expect(buildMcpImageThumbnailUrl("javascript:alert(1)")).toBeNull();
    expect(buildMcpImageThumbnailUrl(null)).toBeNull();
  });

  test("normalizes thumbnail asset base URLs", () => {
    expect(
      normalizeThumbnailAssetBaseUrl("https://assets.example.test/thumbnails/"),
    ).toBe("https://assets.example.test/thumbnails");
    expect(
      normalizeThumbnailAssetBaseUrl("https://assets.example.test/thumbnails"),
    ).toBe("https://assets.example.test/thumbnails");
  });
});
