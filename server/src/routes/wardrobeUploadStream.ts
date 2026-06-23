import { logError } from "../logger.js";
import {
  hasRequiredUploadedWardrobeMetadata,
  normalizeWardrobeImageAnalysisMetadata,
} from "../wardrobeImageAnalysis.js";
import { incrementWardrobeUploadMetric } from "../wardrobeUploadProcessingMetrics.js";

function writeWardrobeUploadEvent(res, event, data) {
  if (!isWardrobeUploadResponseWritable(res)) {
    return false;
  }

  try {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    return true;
  } catch {
    return false;
  }
}

function openWardrobeUploadEventStream(res) {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
}

function isWardrobeUploadResponseWritable(res) {
  return !res.destroyed && !res.writableEnded;
}

function createWardrobeUploadAbortState(req, res) {
  const controller = new AbortController();
  let disposed = false;

  const abort = () => {
    if (disposed || controller.signal.aborted) {
      return;
    }
    incrementWardrobeUploadMetric("uploadAbortCount");
    controller.abort();
  };
  const onRequestAborted = () => abort();
  const onResponseClose = () => {
    if (!res.writableEnded) {
      abort();
    }
  };

  req.on("aborted", onRequestAborted);
  res.on("close", onResponseClose);

  return {
    signal: controller.signal,
    isAborted: () => controller.signal.aborted,
    dispose: () => {
      disposed = true;
      req.removeListener("aborted", onRequestAborted);
      res.removeListener("close", onResponseClose);
    },
  };
}

function resolveUploadedImageUrl(item) {
  return String(item?.rawImageUrl || item?.imageUrl || "").trim();
}

async function markUploadedItemFailed({ context, email, id }) {
  if (!id) {
    return null;
  }

  return context
    .updateUploadedWardrobeItemMetadataImpl({
      email,
      id,
      metadata: null,
      processingStatus: "failed",
    })
    .catch((updateError) => {
      logError("[wardrobe/items/upload][metadata-status]", updateError);
      return null;
    });
}

async function markSavedWardrobeUploadSourcesFailed({
  context,
  email,
  sourceSaves,
}) {
  const savedSources = Array.from(sourceSaves?.values?.() || []);
  await Promise.all(
    savedSources.map(async (savedSource) => {
      const result = (await savedSource) as {
        error?: unknown;
        item?: { id?: unknown } | null;
      };
      if (result?.error) {
        return;
      }

      const id = String(result?.item?.id || "").trim();
      if (!id) {
        return;
      }

      await markUploadedItemFailed({ context, email, id });
    }),
  );
}

function advanceWardrobeUploadProgress(progress, updates) {
  Object.entries(updates).forEach(([key, value]) => {
    progress[key] = (Number(progress[key]) || 0) + Number(value || 0);
  });
}

async function updateUploadedItemWithReviewableMetadata({
  context,
  email,
  id,
  imageUrl,
  metadata,
  ownedR2ImageKeys = [],
}) {
  if (!hasRequiredUploadedWardrobeMetadata(metadata)) {
    const updated = await context.updateUploadedWardrobeItemMetadataImpl({
      email,
      embedding: null,
      id,
      imageUrl,
      metadata,
      ownedR2ImageKeys,
      processingStatus: "needs_review",
    });
    return { processingStatus: "needs_review", updated };
  }

  let embedding: number[] | null = null;
  let processingStatus = "ready";
  try {
    embedding = await context.createUploadedWardrobeItemEmbeddingImpl(metadata);
  } catch (embeddingError) {
    logError(
      "[wardrobe/items/upload][embedding]",
      { id, imageUrl },
      embeddingError,
    );
    processingStatus = "failed";
  }

  const updated = await context.updateUploadedWardrobeItemMetadataImpl({
    email,
    embedding,
    id,
    imageUrl,
    metadata,
    ownedR2ImageKeys,
    processingStatus,
  });
  return { processingStatus, updated };
}

// Upload processing deliberately keeps metadata and image cleanup in one ordered flow.
// eslint-disable-next-line complexity
async function processUploadedWardrobeItemMetadata({
  analyzeItemMetadata = null,
  context,
  email,
  filterItem,
  item,
  cleanupGeneratedImagePortraitCanvas = false,
  processUploadedImage = null,
  sourceImage = null,
  sourceImageKey = null,
  progress,
  res,
}) {
  const id = String(item?.id || "").trim();
  const imageUrl = resolveUploadedImageUrl(item);
  let metadataAccepted = false;

  try {
    if (!id || !imageUrl) {
      throw new Error("invalid_uploaded_item");
    }

    const analysis =
      typeof analyzeItemMetadata === "function"
        ? await analyzeItemMetadata({ imageUrl, item, sourceImage })
        : await context.analyzeWardrobeImageUrlImpl({ imageUrl });
    const metadata = analysis.hasMetadata
      ? analysis.metadata
      : normalizeWardrobeImageAnalysisMetadata(null);

    metadataAccepted = true;
    advanceWardrobeUploadProgress(progress, {
      completedSteps: 1,
      metadataProcessed: analysis.hasMetadata ? 1 : 0,
    });
    writeWardrobeUploadEvent(res, "progress", progress);

    const cleanup =
      typeof processUploadedImage === "function"
        ? await processUploadedImage({
            email,
            imageUrl,
            item,
            sourceImage,
            sourceImageKey,
          })
        : await context.cleanupUploadedWardrobeItemImageImpl({
            email,
            ...(cleanupGeneratedImagePortraitCanvas
              ? { ensurePortraitCanvas: true }
              : {}),
            imageUrl,
            sourceBuffer: sourceImage?.buffer,
            sourceFilename: sourceImage?.originalName,
            sourceKey: sourceImageKey,
            sourceMimeType: sourceImage?.mimeType,
          });
    const cleanImageUrl = String(cleanup?.cleanImage?.url || "").trim();
    if (!cleanImageUrl) {
      throw new Error("wardrobe_image_cleanup_missing_url");
    }
    const ownedR2ImageKeys = [
      cleanup?.cleanImage?.key,
      ...(Array.isArray(cleanup?.thumbnails)
        ? cleanup.thumbnails.map((thumbnail) => thumbnail?.key)
        : []),
    ];
    const { processingStatus, updated } =
      await updateUploadedItemWithReviewableMetadata({
        context,
        email,
        id,
        imageUrl: cleanImageUrl,
        metadata,
        ownedR2ImageKeys,
      });

    advanceWardrobeUploadProgress(progress, {
      completedSteps: 1,
      failed: processingStatus === "failed" ? 1 : 0,
      imageProcessed: 1,
    });
    writeWardrobeUploadEvent(res, "progress", progress);
    return filterItem(updated || { ...item, processingStatus });
  } catch (error) {
    logError("[wardrobe/items/upload][metadata]", { id, imageUrl }, error);
    const updated = await markUploadedItemFailed({ context, email, id });
    advanceWardrobeUploadProgress(progress, {
      completedSteps: metadataAccepted ? 1 : 2,
      failed: 1,
    });
    writeWardrobeUploadEvent(res, "progress", progress);
    return filterItem(updated || { ...item, processingStatus: "failed" });
  }
}

async function processPreparedUploadedWardrobeItemMetadata({
  context,
  email,
  filterItem,
  item,
  processingResult,
  progress,
  res,
}) {
  const errorMessage =
    String(processingResult?.message || "").trim() ||
    "wardrobe_upload_processing_failed";

  return processUploadedWardrobeItemMetadata({
    analyzeItemMetadata: () => {
      if (processingResult?.analysis) {
        return processingResult.analysis;
      }
      throw new Error(errorMessage);
    },
    context,
    email,
    filterItem,
    item,
    processUploadedImage: () => {
      if (processingResult?.cleanup) {
        return processingResult.cleanup;
      }
      throw new Error(errorMessage);
    },
    progress,
    res,
  });
}

export {
  advanceWardrobeUploadProgress,
  createWardrobeUploadAbortState,
  markSavedWardrobeUploadSourcesFailed,
  openWardrobeUploadEventStream,
  processPreparedUploadedWardrobeItemMetadata,
  processUploadedWardrobeItemMetadata,
  writeWardrobeUploadEvent,
};
