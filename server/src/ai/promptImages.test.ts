import { test, expect } from "vitest";
import {
  buildPromptDebugImages,
  buildPromptDebugImagesInChild,
  downloadProductImageAssets,
  groupPromptImageItemsByCategory,
  preparePdfImageAssets,
  resolveSourceImageUrl,
} from "./promptImages.js";

test("promptImages barrel exposes prompt image module entrypoints", () => {
  expect(typeof buildPromptDebugImages).toBe("function");
  expect(typeof buildPromptDebugImagesInChild).toBe("function");
  expect(typeof downloadProductImageAssets).toBe("function");
  expect(typeof groupPromptImageItemsByCategory).toBe("function");
  expect(typeof preparePdfImageAssets).toBe("function");
  expect(resolveSourceImageUrl("https://example.com/image.jpg?w={width}")).toBe(
    "https://example.com/image.jpg?w=1000",
  );
});
