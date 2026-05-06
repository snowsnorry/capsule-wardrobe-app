import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import type {
  PromptDebugImageCategory,
  PromptDebugImageCategoryManifest,
  PromptDebugImageManifest,
  PromptDebugImageResult,
  PromptDebugImageStitched,
  PromptDebugImageStitchedManifest,
  PromptImageTimings
} from "./types.js";
import {
  BACKGROUND_COLOR,
  CATEGORY_COLLAGE_JPEG_QUALITY,
  STITCHED_COLLAGE_FILENAME,
  createPromptImageTimings,
  getMetadataDimensions,
  type PromptDebugImageCategoryManifestSource,
  type PromptDebugImageCategoryWithFile,
  type PromptDebugImageCategoryWithoutBuffer
} from "./promptImagesShared.js";

function stripCategoryBuffer(category: PromptDebugImageCategory = {}): PromptDebugImageCategoryWithoutBuffer {
  return {
    category: getCategoryString(category.category, ""),
    mimeType: getCategoryString(category.mimeType, "image/jpeg"),
    filename: getCategoryString(category.filename, ""),
    totalItems: getCategoryNumber(category.totalItems),
    cachedCount: getCategoryNumber(category.cachedCount),
    downloadedCount: getCategoryNumber(category.downloadedCount),
    skippedCount: getCategoryNumber(category.skippedCount),
    items: getCategoryItems(category.items)
  };
}

function getCategoryString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function getCategoryNumber(value: unknown): number {
  return Number(value) || 0;
}

function getCategoryItems(value: unknown): PromptDebugImageCategoryWithoutBuffer["items"] {
  return Array.isArray(value) ? value : [];
}

function normalizeManifestCategory(category: PromptDebugImageCategory = {}): PromptDebugImageCategoryManifestSource {
  const stripped = stripCategoryBuffer(category);

  return {
    ...stripped,
    filename: stripped.filename,
    items: stripped.items
  };
}

async function stitchCategoryImagesVertically(categories: PromptDebugImageCategoryWithFile[] = []): Promise<PromptDebugImageStitched | null> {
  const validCategories = categories.filter((category) => category.file.length > 0);
  if (validCategories.length === 0) {
    return null;
  }

  const metadata = await Promise.all(validCategories.map(async (category) => {
    const image = sharp(category.file, {
      failOn: "none",
      limitInputPixels: false
    });
    const info = await image.metadata().catch(() => ({}));
    const { width, height } = getMetadataDimensions(info);
    return {
      width: width || 0,
      height: height || 0
    };
  }));

  const width = Math.max(...metadata.map((entry) => entry.width));
  const height = metadata.reduce((sum, entry) => sum + entry.height, 0);

  if (!width || !height) {
    return null;
  }

  let offsetTop = 0;
  const composites: Array<{ input: string; left: number; top: number }> = validCategories.map((category, index) => {
    const composite = {
      input: category.file,
      left: 0,
      top: offsetTop
    };
    offsetTop += metadata[index].height;
    return composite;
  });

  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: BACKGROUND_COLOR
    }
  })
    .composite(composites)
    .jpeg({
      quality: CATEGORY_COLLAGE_JPEG_QUALITY,
      mozjpeg: false,
      progressive: false
    })
    .toBuffer();

  return {
    category: "all-categories",
    mimeType: "image/jpeg",
    buffer,
    filename: STITCHED_COLLAGE_FILENAME,
    totalItems: validCategories.reduce((sum, category) => sum + (Number(category?.totalItems) || 0), 0),
    categoryCount: validCategories.length
  };
}

async function saveDebugArtifacts({
  categories,
  stitched = null,
  cachedCount,
  downloadedCount,
  skippedCount,
  debugOutputDir
}: {
  categories: PromptDebugImageCategory[];
  stitched?: PromptDebugImageStitched | null;
  cachedCount: number;
  downloadedCount: number;
  skippedCount: number;
  debugOutputDir: string | URL | null;
}) {
  if (!debugOutputDir) {
    throw new Error("debugOutputDir is required when saveDebugArtifacts is enabled");
  }

  const resolvedOutputDir = debugOutputDir instanceof URL
    ? fileURLToPath(debugOutputDir)
    : path.resolve(String(debugOutputDir));

  const files: string[] = [];
  const manifestCategories: PromptDebugImageCategoryManifest[] = [];

  for (const category of categories) {
    const categoryEntry = normalizeManifestCategory(category);
    const categoryFile = path.join(resolvedOutputDir, categoryEntry.filename);
    files.push(categoryFile);
    manifestCategories.push({
      category: categoryEntry.category,
      file: categoryFile,
      totalItems: categoryEntry.totalItems,
      cachedCount: categoryEntry.cachedCount,
      downloadedCount: categoryEntry.downloadedCount,
      skippedCount: categoryEntry.skippedCount,
      items: categoryEntry.items
    });
  }

  let stitchedManifest: PromptDebugImageStitchedManifest | null = null;
  if (stitched?.buffer) {
    const stitchedFile = path.join(resolvedOutputDir, stitched.filename || STITCHED_COLLAGE_FILENAME);
    await writeFile(stitchedFile, stitched.buffer);
    files.push(stitchedFile);
    stitchedManifest = {
      category: stitched.category || "all-categories",
      file: stitchedFile,
      totalItems: Number(stitched.totalItems) || 0,
      categoryCount: Number(stitched.categoryCount) || 0
    };
  }

  const manifest: PromptDebugImageManifest = {
    generatedAt: new Date().toISOString(),
    outputDir: resolvedOutputDir,
    cachedCount,
    downloadedCount,
    skippedCount,
    files,
    stitched: stitchedManifest,
    categories: manifestCategories
  };

  const manifestPath = path.join(resolvedOutputDir, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
}

function getNormalizedPromptImageTimings(timings: PromptDebugImageResult["timings"]): PromptImageTimings {
  return {
    ...createPromptImageTimings(),
    ...(timings || {})
  };
}



export {
  getNormalizedPromptImageTimings,
  normalizeManifestCategory,
  saveDebugArtifacts,
  stitchCategoryImagesVertically,
  stripCategoryBuffer
};
