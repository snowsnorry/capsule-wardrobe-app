import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MAX_ITEMS_PER_CATEGORY,
  groupPromptImageItemsByCategory,
  resolveSourceImageUrl,
  resolveStorageImagesDir
} from "./promptImagesShared.js";
import { createItems } from "../test/promptImageFixtures.js";

test("groupPromptImageItemsByCategory preserves order and caps each category at 10 items", () => {
  const groups = groupPromptImageItemsByCategory([
    ...createItems("top", MAX_ITEMS_PER_CATEGORY + 2),
    ...createItems("bottom", 3)
  ]);

  assert.deepEqual([...groups.keys()], ["top", "bottom"]);
  assert.equal(groups.get("top")?.length, MAX_ITEMS_PER_CATEGORY);
  assert.equal(groups.get("top")?.[0]?.id, "top-1");
  assert.equal(groups.get("top")?.[9]?.id, "top-10");
  assert.equal(groups.get("bottom")?.length, 3);
});

test("resolveSourceImageUrl rejects localhost and literal IP hosts for server-side fetches", () => {
  assert.equal(resolveSourceImageUrl("https://example.com/image.jpg?w={width}"), "https://example.com/image.jpg?w=1000");
  assert.equal(resolveSourceImageUrl("https://localhost/image.jpg"), "");
  assert.equal(resolveSourceImageUrl("https://cdn.localhost/image.jpg"), "");
  assert.equal(resolveSourceImageUrl("http://127.0.0.1/image.jpg"), "");
  assert.equal(resolveSourceImageUrl("http://10.0.0.15/image.jpg"), "");
  assert.equal(resolveSourceImageUrl("http://169.254.169.254/latest/meta-data"), "");
  assert.equal(resolveSourceImageUrl("http://[::1]/image.jpg"), "");
  assert.equal(resolveSourceImageUrl("https://[2606:4700:4700::1111]/image.jpg"), "");
});

test("resolveSourceImageUrl only allows http and https schemes", () => {
  assert.equal(resolveSourceImageUrl("https://example.com/image.jpg?w={width}"), "https://example.com/image.jpg?w=1000");
  assert.equal(resolveSourceImageUrl("http://example.com/image.jpg"), "http://example.com/image.jpg");
  assert.equal(resolveSourceImageUrl("javascript:alert(1)"), "");
  assert.equal(resolveSourceImageUrl("data:image/png;base64,abc"), "");
  assert.equal(resolveSourceImageUrl("file:///etc/passwd"), "");
});

test("resolveStorageImagesDir points dist builds at the repository storage cache", () => {
  const distModuleUrl = new URL("../../dist/server/src/ai/promptImages.js", import.meta.url).href;
  const expectedStorageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../storage/images");

  assert.equal(
    resolveStorageImagesDir(distModuleUrl),
    expectedStorageDir
  );
});
