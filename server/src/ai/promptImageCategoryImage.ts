import sharp from "sharp";
import { logWarn } from "../logger.js";
import type {
  PromptDebugImageCategory,
  PromptImageDownloadResult,
  PromptImageItemLike,
  PromptImageTimings,
} from "./types.js";
import {
  CATEGORY_COLLAGE_JPEG_QUALITY,
  addTiming,
  buildPromptTileCompositeInput,
  getErrorMessage,
  GRID_COLUMNS,
  GRID_ROWS,
  GRID_WIDTH,
  HEADER_HEIGHT,
  TILE_SIZE,
  BACKGROUND_COLOR,
  nowMs,
} from "./promptImagesShared.js";
import { createCategoryOverlaySvg } from "./promptImageCategoryOverlay.js";

type CategoryImageEntry = {
  item: PromptImageItemLike;
  result: PromptImageDownloadResult;
  slotIndex: number;
};
type CategoryImageComposite = Awaited<
  ReturnType<typeof buildPromptTileCompositeInput>
> & {
  left: number;
  top: number;
};

function getCategoryGridGeometry(entryCount: number, compactRows: boolean) {
  const gridRows = compactRows
    ? Math.max(1, Math.ceil(entryCount / GRID_COLUMNS))
    : GRID_ROWS;
  return {
    gridRows,
    gridHeight: gridRows * TILE_SIZE,
  };
}

function buildManifestEntry(
  entry: CategoryImageEntry,
): NonNullable<PromptDebugImageCategory["items"]>[number] {
  return {
    slotIndex: entry.slotIndex,
    id: entry.result.id,
    source: entry.result.source,
    imageUrl: entry.result.imageUrl,
    originalImageUrl: entry.result.originalImageUrl,
    status: entry.result.status,
    reason: entry.result.reason,
  };
}

function handleCategoryTileBuildError({
  category,
  entry,
  error,
}: {
  category: string;
  entry: CategoryImageEntry;
  error: unknown;
}) {
  const reason =
    error instanceof Error && error.name === "TimeoutError"
      ? "timeout"
      : getErrorMessage(error, "tile_build_failed");

  logWarn(
    "[prompt-images][tile-build-failed]",
    JSON.stringify({
      id: entry.result.id,
      category,
      imageUrl: entry.result.imageUrl,
      reason,
    }),
  );

  entry.result.status = "skipped";
  entry.result.reason = reason;
}

async function buildCategoryEntryComposite({
  category,
  entry,
  timings,
}: {
  category: string;
  entry: CategoryImageEntry;
  timings?: PromptImageTimings | null;
}): Promise<CategoryImageComposite | null> {
  if (!entry.result.buffer) {
    return null;
  }

  try {
    const tileStartedAt = nowMs();
    const tile = await buildPromptTileCompositeInput(entry.result.buffer, {
      autoRotate: entry.result.source !== "cache",
    });
    addTiming(timings, "tileBuildMs", tileStartedAt);
    const row = Math.floor(entry.slotIndex / GRID_COLUMNS);
    const column = entry.slotIndex % GRID_COLUMNS;
    return {
      ...tile,
      left: column * TILE_SIZE,
      top: HEADER_HEIGHT + row * TILE_SIZE,
    };
  } catch (error) {
    handleCategoryTileBuildError({ category, entry, error });
    return null;
  }
}

async function buildCategoryImageParts({
  category,
  entries,
  timings,
}: {
  category: string;
  entries: CategoryImageEntry[];
  timings?: PromptImageTimings | null;
}) {
  const composites: CategoryImageComposite[] = [];
  const manifestEntries: NonNullable<PromptDebugImageCategory["items"]> = [];

  for (const entry of entries) {
    const composite = await buildCategoryEntryComposite({
      category,
      entry,
      timings,
    });
    if (composite) {
      composites.push(composite);
    }
    manifestEntries.push(buildManifestEntry(entry));
  }

  return { composites, manifestEntries };
}

async function buildCategoryImage({
  category,
  entries,
  compactRows = false,
  timings = null,
}: {
  category: string;
  entries: CategoryImageEntry[];
  compactRows?: boolean;
  timings?: PromptImageTimings | null;
}): Promise<{
  buffer: Buffer;
  mimeType: string;
  manifestEntries: NonNullable<PromptDebugImageCategory["items"]>;
}> {
  const { gridHeight, gridRows } = getCategoryGridGeometry(
    entries.length,
    compactRows,
  );
  const { composites, manifestEntries } = await buildCategoryImageParts({
    category,
    entries,
    timings,
  });
  const overlaySvg = createCategoryOverlaySvg(category, entries, {
    gridHeight,
    gridRows,
  });

  const collageStartedAt = nowMs();
  const buffer = await sharp({
    create: {
      width: GRID_WIDTH,
      height: HEADER_HEIGHT + gridHeight,
      channels: 3,
      background: BACKGROUND_COLOR,
    },
  })
    .composite([...composites, { input: overlaySvg, left: 0, top: 0 }])
    .jpeg({
      quality: CATEGORY_COLLAGE_JPEG_QUALITY,
      mozjpeg: false,
      progressive: false,
    })
    .toBuffer();
  addTiming(timings, "collageEncodeMs", collageStartedAt);

  return {
    buffer,
    mimeType: "image/jpeg",
    manifestEntries,
  };
}

export { buildCategoryImage, type CategoryImageEntry };
