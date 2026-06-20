import { expect, test } from "vitest";

import {
  buildPromptImageThumbnailUrl,
  sha256Hex,
} from "./promptImageThumbnails.js";

test("buildPromptImageThumbnailUrl builds catalog 320px thumbnail URLs", () => {
  const original = "https://images.example.com/catalog/item.jpg?color=blue";
  const digest = sha256Hex(original);

  expect(buildPromptImageThumbnailUrl(original, "from_catalog")).toBe(
    `https://assets.capsule-wardrobe.org/thumbnails/${digest}_320.webp`,
  );
});

test("buildPromptImageThumbnailUrl builds colocated uploaded 320px thumbnail URLs", () => {
  expect(
    buildPromptImageThumbnailUrl(
      "https://images.example.com/wardrobe/profile/item_clean.png?v=123#main",
      "uploaded",
    ),
  ).toBe("https://images.example.com/wardrobe/profile/item_clean_320.webp");
});

test("buildPromptImageThumbnailUrl rejects unsafe or empty URLs", () => {
  expect(buildPromptImageThumbnailUrl("javascript:alert(1)", "uploaded")).toBe(
    null,
  );
  expect(buildPromptImageThumbnailUrl("", "from_catalog")).toBe(null);
  expect(buildPromptImageThumbnailUrl(null, "from_catalog")).toBe(null);
});
