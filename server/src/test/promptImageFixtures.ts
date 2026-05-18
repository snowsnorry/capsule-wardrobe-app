import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import type { TestContext } from "vitest";
import { buildLocalImageCachePath } from "../ai/promptImagesShared.js";

function assertCategoryHasBufferProperty(
  category: unknown,
): asserts category is { buffer: Buffer | Uint8Array | null | undefined } {
  if (!category || typeof category !== "object") {
    throw new Error("Expected category object");
  }
}

async function createFixtureBuffer(color: string) {
  return sharp({
    create: {
      width: 640,
      height: 320,
      channels: 3,
      background: color,
    },
  })
    .png()
    .toBuffer();
}

async function withTempDir(
  testContext: TestContext,
  prefix = "prompt-images-",
) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), prefix));
  testContext.onTestFinished(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });
  return tempDir;
}

async function withCachedImage(
  testContext: TestContext,
  imageUrl: string,
  buffer: Buffer | Uint8Array,
) {
  const cachePath = buildLocalImageCachePath(imageUrl);
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, buffer);
  testContext.onTestFinished(async () => {
    await rm(cachePath, { force: true });
  });
  return cachePath;
}

function createItems(
  category: string,
  count: number,
  imageUrlFactory = (index: number) =>
    `https://example.com/${category}-${index}.png`,
) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${category}-${index + 1}`,
    category,
    imageUrl: imageUrlFactory(index + 1),
  }));
}

export {
  assertCategoryHasBufferProperty,
  createFixtureBuffer,
  createItems,
  withCachedImage,
  withTempDir,
};
