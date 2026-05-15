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

async function processUploadedWardrobeItemMetadata({
  context,
  email,
  filterItem,
  item,
  progress,
  res,
}) {
  const id = String(item?.id || "").trim();
  const imageUrl = resolveUploadedImageUrl(item);

  try {
    if (!id || !imageUrl) {
      throw new Error("invalid_uploaded_item");
    }

    const analysis = await context.analyzeWardrobeImageUrlImpl({ imageUrl });
    const processingStatus = analysis.hasMetadata
      ? "metadata_processed"
      : "failed";
    const updated = await context.updateUploadedWardrobeItemMetadataImpl({
      email,
      id,
      metadata: analysis.hasMetadata ? analysis.metadata : null,
      processingStatus,
    });

    progress[analysis.hasMetadata ? "metadataProcessed" : "failed"] += 1;
    writeWardrobeUploadEvent(res, "progress", progress);
    return filterItem(
      updated || { ...item, processing_status: processingStatus },
    );
  } catch (error) {
    logError("[wardrobe/items/upload][metadata]", { id, imageUrl }, error);
    const updated = await markUploadedItemFailed({ context, email, id });
    progress.failed += 1;
    writeWardrobeUploadEvent(res, "progress", progress);
    return filterItem(updated || { ...item, processing_status: "failed" });
  }
}

export {
  openWardrobeUploadEventStream,
  processUploadedWardrobeItemMetadata,
  writeWardrobeUploadEvent,
};
