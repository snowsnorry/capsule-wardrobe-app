import { logError } from "../logger.js";
import { resolveImageLlmProvider } from "../ai/imageLlm.js";
import { filterWardrobeItemForDisplay } from "../wardrobeItemDisplay.js";
import { normalizeWardrobeProductPageUploadUrls } from "../wardrobeProductPageImport.js";
import {
  advanceWardrobeUploadProgress,
  createWardrobeUploadAbortState,
  markSavedWardrobeUploadSourcesFailed,
  openWardrobeUploadEventStream,
  processPreparedUploadedWardrobeItemMetadata,
  writeWardrobeUploadEvent,
} from "./wardrobeUploadStream.js";

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

async function saveWardrobeProductPageUploadedItem({ context, email, source }) {
  const items = await context.saveUploadedWardrobeItemsImpl({
    email,
    items: [
      {
        imageUrl: source.imageUrl,
        rawImageUrl: source.rawImageUrl,
        url: source.productPageUrl,
      },
    ],
  });
  return Array.isArray(items) ? items[0] || null : null;
}

async function saveWardrobeProductPageUploadedItemWithProgress({
  context,
  email,
  progress,
  res,
  source,
}) {
  const item = await saveWardrobeProductPageUploadedItem({
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

  const savePromise = saveWardrobeProductPageUploadedItemWithProgress({
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

  return saveWardrobeProductPageUploadedItemWithProgress({
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

async function markSavedUrlUploadSourcesFailed(context, req, sourceSaves) {
  await markSavedWardrobeUploadSourcesFailed({
    context,
    email: req.user.email,
    sourceSaves,
  });
}

function registerWardrobeUrlUploadRoute(app, context) {
  app.post(
    "/wardrobe/items/upload-url",
    context.requireTrustedOrigin,
    context.requireAuth,
    context.requireCsrf,
    async (req, res) => {
      const urls = normalizeWardrobeProductPageUploadUrls(req.body?.urls);
      if (!urls) {
        return res.status(400).json({ error: "invalid_payload" });
      }

      const abortState = createWardrobeUploadAbortState(req, res);
      const sourceSaves = new Map();
      try {
        openWardrobeUploadEventStream(res);
        const progress = createWardrobeUploadProgress(urls.length);
        const imageLlm = await getWardrobeUploadImageLlm(
          context,
          req.user.email,
        );
        const processingResults =
          await context.processWardrobeUploadUrlsInChildImpl({
            email: req.user.email,
            imageLlm,
            onEvent: (event) => {
              if (!abortState.isAborted()) {
                scheduleWardrobeUrlSourceSave({
                  context,
                  email: req.user.email,
                  event,
                  progress,
                  res,
                  sourceSaves,
                });
              }
            },
            signal: abortState.signal,
            urls,
          });
        if (abortState.isAborted()) {
          await markSavedUrlUploadSourcesFailed(context, req, sourceSaves);
          return;
        }
        const processedItems = [];

        for (const processingResult of processingResults) {
          if (abortState.isAborted()) {
            await markSavedUrlUploadSourcesFailed(context, req, sourceSaves);
            return;
          }
          const item = await processWardrobeUploadUrlResult({
            context,
            email: req.user.email,
            progress,
            processingResult,
            res,
            sourceSaves,
          });
          if (item) {
            processedItems.push(item);
          }
        }

        writeWardrobeUploadEvent(res, "complete", {
          ok: true,
          ...progress,
          items: processedItems,
        });
        return res.end();
      } catch (error) {
        if (abortState.isAborted()) {
          await markSavedUrlUploadSourcesFailed(context, req, sourceSaves);
          return;
        }
        logError("[wardrobe/items/upload-url]", error);
        await markSavedUrlUploadSourcesFailed(context, req, sourceSaves);
        if (res.headersSent) {
          writeWardrobeUploadEvent(res, "fatal", {
            error: "service_unavailable",
          });
          return res.end();
        }
        return res.status(503).json({ error: "service_unavailable" });
      } finally {
        abortState.dispose();
      }
    },
  );
}

export { registerWardrobeUrlUploadRoute };
