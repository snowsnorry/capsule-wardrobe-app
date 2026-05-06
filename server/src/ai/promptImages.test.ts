import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPromptDebugImages,
  buildPromptDebugImagesInChild,
  downloadProductImageAssets,
  groupPromptImageItemsByCategory,
  preparePdfImageAssets,
  resolveSourceImageUrl
} from "./promptImages.js";

test("promptImages barrel exposes prompt image module entrypoints", () => {
  assert.equal(typeof buildPromptDebugImages, "function");
  assert.equal(typeof buildPromptDebugImagesInChild, "function");
  assert.equal(typeof downloadProductImageAssets, "function");
  assert.equal(typeof groupPromptImageItemsByCategory, "function");
  assert.equal(typeof preparePdfImageAssets, "function");
  assert.equal(resolveSourceImageUrl("https://example.com/image.jpg?w={width}"), "https://example.com/image.jpg?w=1000");
});
