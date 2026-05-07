import { test, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MAX_ITEMS_PER_CATEGORY,
  groupPromptImageItemsByCategory,
  resolveSourceImageUrl,
  resolveStorageImagesDir,
} from "./promptImagesShared.js";
import { createCategoryOverlaySvg } from "./promptImageCategoryOverlay.js";
import { createItems } from "../test/promptImageFixtures.js";
import type { PromptImageDownloadResult } from "./types.js";

function createDownloadResult(
  overrides: Partial<PromptImageDownloadResult> = {},
): PromptImageDownloadResult {
  return {
    id: "item-1",
    category: "top",
    source: "download",
    imageUrl: "https://example.com/item-1.jpg",
    originalImageUrl: "https://example.com/item-1.jpg",
    status: "downloaded",
    reason: null,
    mimeType: "image/jpeg",
    buffer: Buffer.from("image"),
    width: 100,
    height: 100,
    ...overrides,
  };
}

test("groupPromptImageItemsByCategory preserves order and caps each category at 10 items", () => {
  const groups = groupPromptImageItemsByCategory([
    ...createItems("top", MAX_ITEMS_PER_CATEGORY + 2),
    ...createItems("bottom", 3),
  ]);

  expect([...groups.keys()]).toEqual(["top", "bottom"]);
  expect(groups.get("top")?.length).toBe(MAX_ITEMS_PER_CATEGORY);
  expect(groups.get("top")?.[0]?.id).toBe("top-1");
  expect(groups.get("top")?.[9]?.id).toBe("top-10");
  expect(groups.get("bottom")?.length).toBe(3);
});

test("resolveSourceImageUrl rejects localhost and literal IP hosts for server-side fetches", () => {
  expect(resolveSourceImageUrl("https://example.com/image.jpg?w={width}")).toBe(
    "https://example.com/image.jpg?w=1000",
  );
  expect(resolveSourceImageUrl("https://localhost/image.jpg")).toBe("");
  expect(resolveSourceImageUrl("https://cdn.localhost/image.jpg")).toBe("");
  expect(resolveSourceImageUrl("http://127.0.0.1/image.jpg")).toBe("");
  expect(resolveSourceImageUrl("http://10.0.0.15/image.jpg")).toBe("");
  expect(resolveSourceImageUrl("http://169.254.169.254/latest/meta-data")).toBe(
    "",
  );
  expect(resolveSourceImageUrl("http://[::1]/image.jpg")).toBe("");
  expect(
    resolveSourceImageUrl("https://[2606:4700:4700::1111]/image.jpg"),
  ).toBe("");
});

test("resolveSourceImageUrl only allows http and https schemes", () => {
  expect(resolveSourceImageUrl("https://example.com/image.jpg?w={width}")).toBe(
    "https://example.com/image.jpg?w=1000",
  );
  expect(resolveSourceImageUrl("http://example.com/image.jpg")).toBe(
    "http://example.com/image.jpg",
  );
  expect(resolveSourceImageUrl("javascript:alert(1)")).toBe("");
  expect(resolveSourceImageUrl("data:image/png;base64,abc")).toBe("");
  expect(resolveSourceImageUrl("file:///etc/passwd")).toBe("");
});

test("resolveStorageImagesDir points dist builds at the repository storage cache", () => {
  const distModuleUrl = new URL(
    "../../dist/server/src/ai/promptImages.js",
    import.meta.url,
  ).href;
  const expectedStorageDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../storage/images",
  );

  expect(resolveStorageImagesDir(distModuleUrl)).toBe(expectedStorageDir);
});

test("createCategoryOverlaySvg escapes category and item labels and skips blank ids", () => {
  const svg = createCategoryOverlaySvg("tops & <shirts>", [
    {
      item: { id: "item-1 & <tag>" },
      result: createDownloadResult({ id: "item-1 & <tag>" }),
      slotIndex: 0,
    },
    {
      item: { id: "" },
      result: createDownloadResult({ id: "" }),
      slotIndex: 1,
    },
  ]).toString("utf8");

  expect(svg).toContain("Category: tops &amp; &lt;shirts&gt;");
  expect(svg).toContain("item-1 &amp; &lt;tag&gt;");
  expect(svg).not.toContain("slotIndex");
});
