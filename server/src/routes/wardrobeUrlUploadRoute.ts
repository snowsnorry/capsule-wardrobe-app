import { logError } from "../logger.js";
import { resolveImageLlmProvider } from "../ai/imageLlm.js";
import { filterWardrobeItemForDisplay } from "../wardrobeItemDisplay.js";
import { normalizeWardrobeImageUploadUrls } from "../wardrobeImageUrlImport.js";
import {
  advanceWardrobeUploadProgress,
  markSavedWardrobeUploadSourcesFailed,
  processPreparedUploadedWardrobeItemMetadata,
  writeWardrobeUploadEvent,
} from "./wardrobeUploadStream.js";
import { enqueueRouteJob, sendQueuedJob } from "./jobRouteResponses.js";

function createWardrobeUploadProgress(total) {
  return {
    total,
    uploaded: 0,
    completedSteps: 0,
    metadataProcessed: 0,
    imageProcessed: 0,
    failed: 0,
  };
}

function resolveSourceSaveResult(result) {
  if (result?.error) {
    throw result.error;
  }
  return result?.item || null;
}

async function saveWardrobeImageUrlUploadedItem({ context, email, source }) {
  const items = await context.saveUploadedWardrobeItemsImpl({
    email,
    items: [
      {
        imageUrl: source.imageUrl,
        ownedR2ImageKeys: [source.sourceImageKey],
        rawImageUrl: source.rawImageUrl,
        url: source.productPageUrl,
      },
    ],
  });
  return Array.isArray(items) ? items[0] || null : null;
}

async function saveWardrobeImageUrlUploadedItemWithProgress({
  context,
  email,
  progress,
  res,
  source,
}) {
  const item = await saveWardrobeImageUrlUploadedItem({
    context,
    email,
    source,
  });
  if (!item) {
    throw new Error("wardrobe_upload_url_uploaded_item_missing");
  }

  advanceWardrobeUploadProgress(progress, {
    completedSteps: 1,
    uploaded: 1,
  });
  writeWardrobeUploadEvent(res, "progress", progress);
  return item;
}

function scheduleWardrobeUrlSourceSave({
  context,
  email,
  event,
  progress,
  res,
  sourceSaves,
}) {
  if (
    event?.event !== "source-uploaded" ||
    !event.source ||
    sourceSaves.has(event.inputIndex)
  ) {
    return;
  }

  const savePromise = saveWardrobeImageUrlUploadedItemWithProgress({
    context,
    email,
    progress,
    res,
    source: event.source,
  })
    .then((item) => ({ error: null, item }))
    .catch((error) => ({ error, item: null }));
  sourceSaves.set(event.inputIndex, savePromise);
}

async function getWardrobeUploadImageLlm(context, email) {
  const profile = await context.getProfileImpl(email);
  return resolveImageLlmProvider(profile).imageLlm;
}

async function getSavedWardrobeUrlSourceItem({
  context,
  email,
  progress,
  processingResult,
  res,
  sourceSaves,
}) {
  const savedResult = sourceSaves.get(processingResult.inputIndex);
  if (savedResult) {
    return resolveSourceSaveResult(await savedResult);
  }

  return saveWardrobeImageUrlUploadedItemWithProgress({
    context,
    email,
    progress,
    res,
    source: processingResult.source,
  });
}

async function processWardrobeUploadUrlResult({
  context,
  email,
  progress,
  processingResult,
  res,
  sourceSaves,
}) {
  const source = processingResult?.source || null;
  if (!source) {
    logError("[wardrobe/items/upload-url][item]", {
      error: processingResult?.message || "wardrobe_upload_url_failed",
    });
    advanceWardrobeUploadProgress(progress, {
      completedSteps: 3,
      failed: 1,
    });
    writeWardrobeUploadEvent(res, "progress", progress);
    return null;
  }

  try {
    const item = await getSavedWardrobeUrlSourceItem({
      context,
      email,
      progress,
      processingResult,
      res,
      sourceSaves,
    });

    return processPreparedUploadedWardrobeItemMetadata({
      context,
      email,
      filterItem: filterWardrobeItemForDisplay,
      item: filterWardrobeItemForDisplay(item),
      processingResult,
      progress,
      res,
    });
  } catch (error) {
    logError("[wardrobe/items/upload-url][item]", { source }, error);
    advanceWardrobeUploadProgress(progress, {
      completedSteps: 3,
      failed: 1,
    });
    writeWardrobeUploadEvent(res, "progress", progress);
    return null;
  }
}

function registerWardrobeUrlUploadRoute(app, context) {
  app.post(
    "/wardrobe/items/upload-url",
    context.requireTrustedOrigin,
    context.requireAuth,
    context.requireCsrf,
    async (req, res) => {
      const urls = normalizeWardrobeImageUploadUrls(req.body?.urls);
      if (!urls) {
        return res.status(400).json({ error: "invalid_payload" });
      }

      try {
        const job = await enqueueRouteJob(context, {
          kind: "personalItemUploadUrls",
          profileEmail: req.user.email,
          entity: { type: "wardrobe", id: null },
          dedupeKey: `personalItemUploadUrls:${urls.join("|")}`,
          phase: "queued",
          payload: { urls },
          progressLabel: "Uploading Personal items",
          progressTotal: urls.length,
        });
        return sendQueuedJob(res, job);
      } catch (error) {
        logError("[wardrobe/items/upload-url]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );
}

async function processQueuedWardrobeUrlUpload({
  context,
  email,
  urls,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any;
  email: string;
  urls: string[];
}) {
  const sourceSaves = new Map();
  const progress = createWardrobeUploadProgress(urls.length);
  const res = createQueuedUploadResponseSink();
  try {
    const imageLlm = await getWardrobeUploadImageLlm(context, email);
    const processingResults =
      await context.processWardrobeUploadUrlsInChildImpl({
        email,
        imageLlm,
        onEvent: (event) => {
          scheduleWardrobeUrlSourceSave({
            context,
            email,
            event,
            progress,
            res,
            sourceSaves,
          });
        },
        signal: undefined,
        urls,
      });
    const processedItems = [];

    for (const processingResult of processingResults) {
      const item = await processWardrobeUploadUrlResult({
        context,
        email,
        progress,
        processingResult,
        res,
        sourceSaves,
      });
      if (item) {
        processedItems.push(item);
      }
    }

    const likedUrls = await context.listLikedItemUrlsImpl(email);
    return {
      ok: true,
      ...progress,
      items: context.annotateLikedItems(processedItems, likedUrls),
    };
  } catch (error) {
    await markSavedWardrobeUploadSourcesFailed({
      context,
      email,
      sourceSaves,
    });
    throw error;
  }
}

function createQueuedUploadResponseSink() {
  return {
    destroyed: false,
    writableEnded: false,
    write: () => true,
  };
}

export { processQueuedWardrobeUrlUpload, registerWardrobeUrlUploadRoute };
