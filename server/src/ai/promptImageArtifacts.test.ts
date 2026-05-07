import { test, expect } from "vitest";
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
  expect(stripCategoryBuffer({ buffer: Buffer.from("ignored"), items: "bad" } as never)).toEqual({
    category: "",
    mimeType: "image/jpeg",
    filename: "",
    totalItems: 0,
    cachedCount: 0,
    downloadedCount: 0,
    skippedCount: 0,
    items: []
  });

  expect(normalizeManifestCategory({
      category: "top",
      mimeType: "image/png",
      filename: "top.png",
      totalItems: 2,
      cachedCount: 1,
      downloadedCount: 1,
      skippedCount: 0,
      items: [{ id: "top-1" }]
    })).toEqual({
      category: "top",
      mimeType: "image/png",
      filename: "top.png",
      totalItems: 2,
      cachedCount: 1,
      downloadedCount: 1,
      skippedCount: 0,
      items: [{ id: "top-1" }]
    });
});

test("stitchCategoryImagesVertically returns null for empty or unreadable category files", async () => {
  const dir = await mkdtemp(join(tmpdir(), "prompt-artifacts-"));
  try {
    const invalidFile = join(dir, "invalid.jpg");
    await writeFile(invalidFile, "not an image");

    expect(await stitchCategoryImagesVertically([])).toBe(null);
    expect(await stitchCategoryImagesVertically([{ file: invalidFile, totalItems: 1 }])).toBe(null);
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

    expect(stitched?.category).toBe("all-categories");
    expect(stitched?.totalItems).toBe(3);
    expect(stitched?.categoryCount).toBe(2);

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
    expect(manifest.outputDir.replace(/\/$/, "")).toBe(dir);
    expect(manifest.stitched.categoryCount).toBe(2);
    expect(manifest.categories[0].category).toBe("top");
    expect(manifest.files.some((file: string) => file.endsWith("categories-stitched.jpg"))).toBeTruthy();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("saveDebugArtifacts requires output dir and timings merge defaults", async () => {
  await expect(() => saveDebugArtifacts({
      categories: [],
      cachedCount: 0,
      downloadedCount: 0,
      skippedCount: 0,
      debugOutputDir: null
    })).rejects.toThrow(/debugOutputDir is required/);

  expect(getNormalizedPromptImageTimings({ networkFetchMs: 12 }).networkFetchMs).toBe(12);
  expect(getNormalizedPromptImageTimings(null).cacheLookupMs).toBe(0);
});
