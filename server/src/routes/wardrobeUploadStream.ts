import { logError } from "../logger.js";

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
    if (!analysis.hasMetadata) {
      const updated = await context.updateUploadedWardrobeItemMetadataImpl({
        email,
        id,
        metadata: null,
        processingStatus: "failed",
      });
      advanceWardrobeUploadProgress(progress, {
        completedSteps: 2,
        failed: 1,
      });
      writeWardrobeUploadEvent(res, "progress", progress);
      return filterItem(updated || { ...item, processing_status: "failed" });
    }

    metadataAccepted = true;
    advanceWardrobeUploadProgress(progress, {
      completedSteps: 1,
      metadataProcessed: 1,
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
    const updated = await context.updateUploadedWardrobeItemMetadataImpl({
      email,
      id,
      imageUrl: cleanImageUrl,
      metadata: analysis.metadata,
      processingStatus: "ready",
    });

    advanceWardrobeUploadProgress(progress, {
      completedSteps: 1,
      imageProcessed: 1,
    });
    writeWardrobeUploadEvent(res, "progress", progress);
    return filterItem(updated || { ...item, processing_status: "ready" });
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
