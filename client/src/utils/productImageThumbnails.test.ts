import { describe, expect, test, vi } from "vitest";
import {
  PRODUCT_IMAGE_THUMBNAIL_SIZES,
  buildProductImageThumbnailSizes,
  buildProductImageThumbnails,
  sha256Hex,
} from "./productImageThumbnails";

vi.mock("../api/config", () => ({
  THUMBNAIL_ASSET_BASE_URL: "https://assets.example.test/thumbnails",
}));

describe("productImageThumbnails", () => {
  test("builds stable thumbnail image URLs for safe HTTP URLs", async () => {
    const digest = await sha256Hex("https://example.com/image.jpg");

    await expect(
      buildProductImageThumbnails(" https://example.com/image.jpg "),
    ).resolves.toEqual({
      src: `https://assets.example.test/thumbnails/${digest}_640.webp`,
      srcSet: `https://assets.example.test/thumbnails/${digest}_320.webp 320w, https://assets.example.test/thumbnails/${digest}_480.webp 480w, https://assets.example.test/thumbnails/${digest}_640.webp 640w`,
      sizes: PRODUCT_IMAGE_THUMBNAIL_SIZES,
    });
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
  });

  test("rejects unsafe and blank image URLs", async () => {
    await expect(
      buildProductImageThumbnails("javascript:alert(1)"),
    ).resolves.toBeNull();
    await expect(buildProductImageThumbnails(null)).resolves.toBeNull();
  });

  test("builds image sizes for card column layouts", () => {
    expect(buildProductImageThumbnailSizes()).toBe(
      PRODUCT_IMAGE_THUMBNAIL_SIZES,
    );
    expect(
      buildProductImageThumbnailSizes({ isMobile: true, mobileColumns: 1 }),
    ).toBe("(max-width: 600px) 100vw, 285px");
    expect(
      buildProductImageThumbnailSizes({ isMobile: true, mobileColumns: 2 }),
    ).toBe("(max-width: 600px) 50vw, 285px");
    expect(
      buildProductImageThumbnailSizes({ isMobile: true, mobileColumns: 3 }),
    ).toBe("(max-width: 600px) 33.333vw, 285px");
  });
});
