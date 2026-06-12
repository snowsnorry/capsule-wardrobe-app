import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { IMAGE_DOWNLOAD_CONCURRENCY } from "./imagePipeline.js";
import type {
  PromptDebugImageCategory,
  PromptImageItemLike,
  PromptImageTimings,
} from "./types.js";
import {
  addTiming,
  createPromptImageTimings,
  ensureCleanDirectory,
  getErrorMessage,
  mapWithConcurrency,
  nowMs,
  sanitizeFileName,
  groupPromptImageItemsByCategory,
  type PromptDebugImageCategoryWithFile,
} from "./promptImagesShared.js";
import { downloadPromptImageAsset } from "./promptImageDownloads.js";
import { logWarn } from "../logger.js";
import {
  saveDebugArtifacts,
  stitchCategoryImagesVertically,
  stripCategoryBuffer,
} from "./promptImageArtifacts.js";
import { buildCategoryImage } from "./promptImageCategoryImage.js";

async function createIntermediateCollageDirectory({
  debugOutputDir = null,
  saveDebugArtifacts = false,
}: {
  debugOutputDir?: string | URL | null;
  saveDebugArtifacts?: boolean;
} = {}): Promise<{ directory: string; shouldCleanup: boolean }> {
  if (saveDebugArtifacts) {
    if (!debugOutputDir) {
      throw new Error(
        "debugOutputDir is required when saveDebugArtifacts is enabled",
      );
    }

    const resolvedOutputDir =
      debugOutputDir instanceof URL
        ? fileURLToPath(debugOutputDir)
        : path.resolve(String(debugOutputDir));

    await ensureCleanDirectory(resolvedOutputDir);

    return {
      directory: resolvedOutputDir,
      shouldCleanup: false,
    };
  }

  return {
    directory: await mkdtemp(path.join(os.tmpdir(), "prompt-images-")),
    shouldCleanup: true,
  };
}

async function buildPromptDebugImages({
  normalizedItems = [],
  debugOutputDir = null,
  saveDebugArtifacts: shouldSaveDebugArtifacts = false,
}: {
  normalizedItems?: PromptImageItemLike[];
  debugOutputDir?: string | URL | null;
  saveDebugArtifacts?: boolean;
} = {}) {
  const groupedItems = groupPromptImageItemsByCategory(normalizedItems);
  const categories: PromptDebugImageCategoryWithFile[] = [];
  let cachedCount = 0;
  let downloadedCount = 0;
  let skippedCount = 0;
  const timings = createPromptImageTimings();
  const { directory: collageDirectory, shouldCleanup } =
    await createIntermediateCollageDirectory({
      debugOutputDir,
      saveDebugArtifacts: shouldSaveDebugArtifacts,
    });

  try {
    for (const [category, items] of groupedItems.entries()) {
      const categoryResult = await buildPromptDebugImagesForCategory({
        category,
        items,
        downloadConcurrency: IMAGE_DOWNLOAD_CONCURRENCY,
        timings,
      });
      const categoryFile = path.join(
        collageDirectory,
        categoryResult.category.filename,
      );
      await writeFile(categoryFile, categoryResult.category.buffer);
      categories.push({
        ...stripCategoryBuffer(categoryResult.category),
        file: categoryFile,
      });
      cachedCount += categoryResult.cachedCount;
      downloadedCount += categoryResult.downloadedCount;
      skippedCount += categoryResult.skippedCount;
      categoryResult.category.buffer = null;
    }

    const stitched = await stitchCategoryImagesVertically(categories);

    if (shouldSaveDebugArtifacts) {
      try {
        const debugSaveStartedAt = nowMs();
        await saveDebugArtifacts({
          categories,
          stitched,
          cachedCount,
          downloadedCount,
          skippedCount,
          debugOutputDir,
        });
        addTiming(timings, "debugSaveMs", debugSaveStartedAt);
      } catch (error) {
        logWarn(
          "[prompt-images][debug-save-failed]",
          JSON.stringify({ message: getErrorMessage(error) }),
        );
      }
    }

    return {
      categories: categories.map(stripCategoryBuffer),
      stitched,
      cachedCount,
      downloadedCount,
      skippedCount,
      timings,
    };
  } finally {
    if (shouldCleanup) {
      await rm(collageDirectory, { recursive: true, force: true });
    }
  }
}

async function buildPromptDebugImagesForCategory({
  category = "",
  items = [],
  compactRows = false,
  downloadConcurrency = IMAGE_DOWNLOAD_CONCURRENCY,
  timings = null,
}: {
  category?: string;
  items?: PromptImageItemLike[];
  compactRows?: boolean;
  downloadConcurrency?: number;
  timings?: PromptImageTimings | null;
} = {}): Promise<{
  category: PromptDebugImageCategory;
  cachedCount: number;
  downloadedCount: number;
  skippedCount: number;
}> {
  const categoryStartedAt = nowMs();
  const categorySlug = sanitizeFileName(category);
  const downloadResults = await mapWithConcurrency(
    items,
    downloadConcurrency,
    (item) => downloadPromptImageAsset(item, timings),
  );

  let cachedCount = 0;
  let downloadedCount = 0;
  let skippedCount = 0;
  for (const result of downloadResults) {
    if (result.status === "downloaded") {
      if (result.source === "cache") {
        cachedCount += 1;
      } else {
        downloadedCount += 1;
      }
    } else {
      skippedCount += 1;
    }
  }

  const entries = items.map((item, slotIndex) => ({
    item,
    result: downloadResults[slotIndex],
    slotIndex,
  }));

  const { buffer, mimeType, manifestEntries } = await buildCategoryImage({
    category,
    entries,
    compactRows,
    timings,
  });
  addTiming(timings, "categoryBuildMs", categoryStartedAt);

  return {
    category: {
      category,
      mimeType,
      buffer,
      filename: `category-${categorySlug}.jpg`,
      totalItems: items.length,
      cachedCount,
      downloadedCount,
      skippedCount,
      items: manifestEntries,
    },
    cachedCount,
    downloadedCount,
    skippedCount,
  };
}

export { buildPromptDebugImages, buildPromptDebugImagesForCategory };
