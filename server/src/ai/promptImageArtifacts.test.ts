import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import {
  getNormalizedPromptImageTimings,
  normalizeManifestCategory,
  saveDebugArtifacts,
  stitchCategoryImagesVertically,
  stripCategoryBuffer
} from "./promptImageArtifacts.js";

test("stripCategoryBuffer and normalizeManifestCategory coerce missing category fields", () => {
  assert.deepEqual(stripCategoryBuffer({ buffer: Buffer.from("ignored"), items: "bad" } as never), {
    category: "",
    mimeType: "image/jpeg",
    filename: "",
    totalItems: 0,
    cachedCount: 0,
    downloadedCount: 0,
    skippedCount: 0,
    items: []
  });

  assert.deepEqual(
    normalizeManifestCategory({
      category: "top",
      mimeType: "image/png",
      filename: "top.png",
      totalItems: 2,
      cachedCount: 1,
      downloadedCount: 1,
      skippedCount: 0,
      items: [{ id: "top-1" }]
    }),
    {
      category: "top",
      mimeType: "image/png",
      filename: "top.png",
      totalItems: 2,
      cachedCount: 1,
      downloadedCount: 1,
      skippedCount: 0,
      items: [{ id: "top-1" }]
    }
  );
});

test("stitchCategoryImagesVertically returns null for empty or unreadable category files", async () => {
  const dir = await mkdtemp(join(tmpdir(), "prompt-artifacts-"));
  try {
    const invalidFile = join(dir, "invalid.jpg");
    await writeFile(invalidFile, "not an image");

    assert.equal(await stitchCategoryImagesVertically([]), null);
    assert.equal(await stitchCategoryImagesVertically([{ file: invalidFile, totalItems: 1 }]), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("stitchCategoryImagesVertically builds a stitched jpeg and saveDebugArtifacts writes manifest", async () => {
  const dir = await mkdtemp(join(tmpdir(), "prompt-artifacts-"));
  try {
    const topFile = join(dir, "top.jpg");
    const bottomFile = join(dir, "bottom.jpg");
    await sharp({ create: { width: 4, height: 3, channels: 3, background: "#112233" } }).jpeg().toFile(topFile);
    await sharp({ create: { width: 6, height: 2, channels: 3, background: "#445566" } }).jpeg().toFile(bottomFile);

    const stitched = await stitchCategoryImagesVertically([
      { file: topFile, totalItems: 2 },
      { file: bottomFile, totalItems: 1 }
    ]);

    assert.equal(stitched?.category, "all-categories");
    assert.equal(stitched?.totalItems, 3);
    assert.equal(stitched?.categoryCount, 2);

    await saveDebugArtifacts({
      categories: [{
        category: "top",
        filename: "top.jpg",
        totalItems: 2,
        cachedCount: 1,
        downloadedCount: 1,
        skippedCount: 0,
        items: [{ id: "top-1" }]
      }],
      stitched,
      cachedCount: 1,
      downloadedCount: 1,
      skippedCount: 0,
      debugOutputDir: pathToFileURL(`${dir}/`)
    });

    const manifest = JSON.parse(await readFile(join(dir, "manifest.json"), "utf8"));
    assert.equal(manifest.outputDir.replace(/\/$/, ""), dir);
    assert.equal(manifest.stitched.categoryCount, 2);
    assert.equal(manifest.categories[0].category, "top");
    assert.ok(manifest.files.some((file: string) => file.endsWith("categories-stitched.jpg")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("saveDebugArtifacts requires output dir and timings merge defaults", async () => {
  await assert.rejects(
    () => saveDebugArtifacts({
      categories: [],
      cachedCount: 0,
      downloadedCount: 0,
      skippedCount: 0,
      debugOutputDir: null
    }),
    /debugOutputDir is required/
  );

  assert.equal(getNormalizedPromptImageTimings({ networkFetchMs: 12 }).networkFetchMs, 12);
  assert.equal(getNormalizedPromptImageTimings(null).cacheLookupMs, 0);
});
