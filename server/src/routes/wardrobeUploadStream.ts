import { logError } from "../logger.js";
import {
  hasRequiredUploadedWardrobeMetadata,
  normalizeWardrobeImageAnalysisMetadata,
} from "../wardrobeImageAnalysis.js";

function writeWardrobeUploadEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function openWardrobeUploadEventStream(res) {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
}

function resolveUploadedImageUrl(item) {
  return String(item?.raw_image_url || item?.image_url || "").trim();
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
}) {
  if (!hasRequiredUploadedWardrobeMetadata(metadata)) {
    const updated = await context.updateUploadedWardrobeItemMetadataImpl({
      email,
      embedding: null,
      id,
      imageUrl,
      metadata,
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
    processingStatus,
  });
  return { processingStatus, updated };
}

// Upload processing deliberately keeps metadata and image cleanup in one ordered flow.
// eslint-disable-next-line complexity
async function processUploadedWardrobeItemMetadata({
  context,
  email,
  filterItem,
  item,
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

    const analysis = await context.analyzeWardrobeImageUrlImpl({ imageUrl });
    const metadata = analysis.hasMetadata
      ? analysis.metadata
      : normalizeWardrobeImageAnalysisMetadata(null);

    metadataAccepted = true;
    advanceWardrobeUploadProgress(progress, {
      completedSteps: 1,
      metadataProcessed: analysis.hasMetadata ? 1 : 0,
    });
    writeWardrobeUploadEvent(res, "progress", progress);

    const cleanup = await context.cleanupUploadedWardrobeItemImageImpl({
      email,
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
    const { processingStatus, updated } =
      await updateUploadedItemWithReviewableMetadata({
        context,
        email,
        id,
        imageUrl: cleanImageUrl,
        metadata,
      });

    advanceWardrobeUploadProgress(progress, {
      completedSteps: 1,
      failed: processingStatus === "failed" ? 1 : 0,
      imageProcessed: 1,
    });
    writeWardrobeUploadEvent(res, "progress", progress);
    return filterItem(
      updated || { ...item, processing_status: processingStatus },
    );
  } catch (error) {
    logError("[wardrobe/items/upload][metadata]", { id, imageUrl }, error);
    const updated = await markUploadedItemFailed({ context, email, id });
    advanceWardrobeUploadProgress(progress, {
      completedSteps: metadataAccepted ? 1 : 2,
      failed: 1,
    });
    writeWardrobeUploadEvent(res, "progress", progress);
    return filterItem(updated || { ...item, processing_status: "failed" });
  }
}

export {
  openWardrobeUploadEventStream,
  processUploadedWardrobeItemMetadata,
  writeWardrobeUploadEvent,
};
