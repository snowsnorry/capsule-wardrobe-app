import { mkdtemp, rm } from "node:fs/promises";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import multer from "multer";
import { fileTypeFromFile } from "file-type";
import { resolveImageLlmProvider } from "../ai/imageLlm.js";
import { logError } from "../logger.js";
import { filterWardrobeItemForDisplay } from "../wardrobeItemDisplay.js";
import {
  WARDROBE_UPLOAD_FIELD_NAME,
  WARDROBE_UPLOAD_MAX_FILE_SIZE_BYTES,
  WARDROBE_UPLOAD_MAX_FILES,
  isAllowedWardrobeUploadMimeType,
} from "../wardrobeUploadImagesCore.js";
import {
  advanceWardrobeUploadProgress,
  markSavedWardrobeUploadSourcesFailed,
  processPreparedUploadedWardrobeItemMetadata,
  writeWardrobeUploadEvent,
} from "./wardrobeUploadStream.js";
import {
  enqueueRouteJob,
  sendJobEnqueueError,
  sendQueuedJob,
} from "./jobRouteResponses.js";
import {
  cleanupStagedUploadFiles,
  hydrateStagedUploadFiles,
  stageUploadFile,
  type StagedUploadFile,
} from "../jobs/stagedUploadStorage.js";

function createWardrobeUploadMiddleware(uploadDir: string) {
  return multer({
    storage: multer.diskStorage({
      destination: uploadDir,
    }),
    limits: {
      fileSize: WARDROBE_UPLOAD_MAX_FILE_SIZE_BYTES,
      files: WARDROBE_UPLOAD_MAX_FILES,
      parts: WARDROBE_UPLOAD_MAX_FILES + 1,
    },
    fileFilter: (_req, file, callback) => {
      if (isAllowedWardrobeUploadMimeType(file.mimetype)) {
        callback(null, true);
        return;
      }

      callback(new Error("invalid_image"));
    },
  }).array(WARDROBE_UPLOAD_FIELD_NAME, WARDROBE_UPLOAD_MAX_FILES);
}

function runWardrobeUploadMiddleware(req, res, uploadDir) {
  const wardrobeUpload = createWardrobeUploadMiddleware(uploadDir);
  return new Promise<boolean>((resolve) => {
    wardrobeUpload(req, res, (error) => {
      if (!error) {
        resolve(true);
        return;
      }

      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          res.status(413).json({ error: "file_too_large" });
          resolve(false);
          return;
        }

        if (
          error.code === "LIMIT_FILE_COUNT" ||
          error.code === "LIMIT_PART_COUNT" ||
          error.code === "LIMIT_UNEXPECTED_FILE"
        ) {
          res.status(400).json({ error: "too_many_files" });
          resolve(false);
          return;
        }
      }

      if (error?.message === "invalid_image") {
        res.status(400).json({ error: "invalid_image" });
        resolve(false);
        return;
      }

      logError("wardrobe.items.upload.parse.failed", error);
      res.status(400).json({ error: "invalid_payload" });
      resolve(false);
    });
  });
}

async function getValidatedWardrobeUploadFiles(files) {
  const images = [];

  for (const file of files) {
    const filePath = String(file?.path || "").trim();
    if (!filePath) {
      throw new Error("invalid_image");
    }
    const detectedType = await fileTypeFromFile(filePath);
    if (!isAllowedWardrobeUploadMimeType(detectedType?.mime)) {
      throw new Error("invalid_image");
    }

    images.push({
      filePath,
      mimeType: detectedType.mime,
      originalName: String(file.originalname || "wardrobe-image"),
    });
  }

  return images;
}

async function getWardrobeUploadImageLlm(context, email) {
  const profile = await context.getProfileImpl(email);
  return resolveImageLlmProvider(profile).imageLlm;
}

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

async function saveUploadedFileSource({ context, email, source }) {
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

async function saveUploadedFileSourceWithProgress({
  context,
  email,
  progress,
  res,
  source,
}) {
  const item = await saveUploadedFileSource({
    context,
    email,
    source,
  });
  if (!item) {
    throw new Error("wardrobe_upload_uploaded_item_missing");
  }

  advanceWardrobeUploadProgress(progress, {
    completedSteps: 1,
    uploaded: 1,
  });
  writeWardrobeUploadEvent(res, "progress", progress);
  return item;
}

function scheduleUploadedFileSourceSave({
  context,
  email,
  event,
  progress,
  res,
  sourceSaves,
}) {
  if (
    event?.event !== "source-uploaded" ||
    event.kind !== "file" ||
    !event.source ||
    sourceSaves.has(event.inputIndex)
  ) {
    return;
  }

  const savePromise = saveUploadedFileSourceWithProgress({
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

async function getSavedUploadedFileSourceItem({
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

  return saveUploadedFileSourceWithProgress({
    context,
    email,
    progress,
    res,
    source: processingResult.source,
  });
}

async function processFileUploadResult({
  context,
  email,
  progress,
  processingResult,
  res,
  sourceSaves,
}) {
  const source = processingResult?.source || null;
  if (!source) {
    throw new Error(
      String(processingResult?.message || "wardrobe_upload_source_missing"),
    );
  }

  const item = await getSavedUploadedFileSourceItem({
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
}

async function runFileUploadProcessingWorker({
  abortState,
  context,
  email,
  progress,
  res,
  sourceSaves,
  uploadFiles,
}) {
  const imageLlm = await getWardrobeUploadImageLlm(context, email);
  return context.processWardrobeUploadFilesInChildImpl({
    email,
    files: uploadFiles,
    imageLlm,
    onEvent: (event) => {
      if (!abortState.isAborted()) {
        scheduleUploadedFileSourceSave({
          context,
          email,
          event,
          progress,
          res,
          sourceSaves,
        });
      }
    },
    signal: abortState.signal,
  });
}

function registerWardrobeUploadRoute(app, context) {
  app.post(
    "/wardrobe/items/upload",
    context.requireTrustedOrigin,
    context.requireAuth,
    context.requireCsrf,
    context.uploadEnqueueLimiter,
    async (req, res) => {
      const uploadDir = await mkdtemp(
        path.join(os.tmpdir(), "wardrobe-upload-"),
      );
      const stagedFiles: StagedUploadFile[] = [];

      try {
        const parsed = await runWardrobeUploadMiddleware(req, res, uploadDir);
        if (!parsed) {
          return;
        }

        const files = Array.isArray(req.files) ? req.files : [];
        if (files.length === 0) {
          return res.status(400).json({ error: "invalid_payload" });
        }

        const uploadFiles = await getValidatedWardrobeUploadFiles(files);
        const stagingScopeId = crypto.randomUUID();
        for (const [index, file] of uploadFiles.entries()) {
          stagedFiles.push(
            await stageUploadFile({
              filePath: file.filePath,
              index,
              jobId: stagingScopeId,
              mimeType: file.mimeType,
              originalName: file.originalName,
            }),
          );
        }
        const job = await enqueueRouteJob(context, {
          kind: "personalItemUploadFiles",
          profileEmail: req.user.email,
          entity: { type: "wardrobe", id: null },
          phase: "queued",
          payload: { stagedFiles, stagingScopeId },
          progressLabel: "Uploading Personal items",
          progressTotal: uploadFiles.length,
        });
        return sendQueuedJob(res, job);
      } catch (error) {
        const jobError = sendJobEnqueueError(res, error);
        if (jobError) {
          await cleanupStagedUploadFiles(stagedFiles).catch((cleanupError) => {
            logError(
              "wardrobe.items.upload.staging.cleanup.failed",
              cleanupError,
            );
          });
          return jobError;
        }
        if (error?.message === "invalid_image") {
          return res.status(400).json({ error: "invalid_image" });
        }
        await cleanupStagedUploadFiles(stagedFiles).catch((cleanupError) => {
          logError(
            "wardrobe.items.upload.staging.cleanup.failed",
            cleanupError,
          );
        });
        if (error?.code === "storage_unavailable") {
          return res.status(503).json({ error: "storage_unavailable" });
        }

        logError("wardrobe.items.upload.failed", error);
        return res.status(503).json({ error: "service_unavailable" });
      } finally {
        await rm(uploadDir, { recursive: true, force: true }).catch(() => {});
      }
    },
  );
}

async function processQueuedWardrobeFileUploadImpl({
  context,
  email,
  filterItem = filterWardrobeItemForDisplay,
  signal,
  stagedFiles,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any;
  email: string;
  filterItem?: typeof filterWardrobeItemForDisplay;
  signal?: AbortSignal;
  stagedFiles: StagedUploadFile[];
}) {
  const hydrated = await hydrateStagedUploadFiles(stagedFiles);
  const sourceSaves = new Map();
  const progress = createWardrobeUploadProgress(hydrated.files.length);
  const res = createQueuedUploadResponseSink();
  const abortState = {
    signal,
    isAborted: () => Boolean(signal?.aborted),
  };

  try {
    const processingResults = await runFileUploadProcessingWorker({
      abortState,
      context,
      email,
      progress,
      res,
      sourceSaves,
      uploadFiles: hydrated.files,
    });

    const processedItems = [];
    for (const processingResult of processingResults) {
      const item = await processFileUploadResult({
        context,
        email,
        processingResult,
        progress,
        res,
        sourceSaves,
      });
      processedItems.push(item);
    }

    const likedUrls = await context.listLikedItemUrlsImpl(email);
    return {
      ok: true,
      ...progress,
      items: context.annotateLikedItems(
        processedItems.map(filterItem),
        likedUrls,
      ),
    };
  } catch (error) {
    await markSavedWardrobeUploadSourcesFailed({
      context,
      email,
      sourceSaves,
    });
    throw error;
  } finally {
    await hydrated.cleanup();
    await cleanupStagedUploadFiles(stagedFiles).catch((cleanupError) => {
      logError(
        "wardrobe.items.upload.job.staging.cleanup.failed",
        cleanupError,
      );
    });
  }
}

function createQueuedUploadResponseSink() {
  return {
    destroyed: false,
    writableEnded: false,
    write: () => true,
  };
}

export { processQueuedWardrobeFileUploadImpl, registerWardrobeUploadRoute };
