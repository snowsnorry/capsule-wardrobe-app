import sharp from "sharp";
import { IMAGE_DOWNLOAD_CONCURRENCY } from "./imagePipeline.js";
import { logWarn } from "../logger.js";
import type {
  PromptImageDownloadResult,
  PromptImageItemLike,
  PromptImageTimings,
} from "./types.js";
import {
  MAX_SOURCE_IMAGE_PIXELS,
  addTiming,
  getErrorMessage,
  getMetadataDimensions,
  getOriginalImageUrl,
  getRequestSignal,
  mapWithConcurrency,
  normalizeDownloadedImage,
  nowMs,
  readImageFromLocalCache,
  resolveSourceImageUrl,
} from "./promptImagesShared.js";

function getDownloadIdentity(item: PromptImageItemLike) {
  return {
    id: String(item?.id ?? ""),
    category: item?.category ?? "",
    imageUrl: resolveSourceImageUrl(item?.image_url),
    originalImageUrl: getOriginalImageUrl(item?.image_url),
  };
}

function buildSkippedDownloadResult(
  identity,
  reason,
): PromptImageDownloadResult {
  return {
    ...identity,
    source: null,
    status: "skipped",
    reason,
    mimeType: null,
    buffer: null,
    width: null,
    height: null,
  };
}

async function buildCachedDownloadResult(
  identity,
  cachedImage,
  includeOriginalMimeType = false,
) {
  const metadata = await sharp(cachedImage.buffer)
    .metadata()
    .catch(() => ({}));
  const { width, height } = getMetadataDimensions(metadata);
  return {
    ...identity,
    source: "cache",
    cachePath: cachedImage.cachePath,
    status: "downloaded",
    reason: null,
    mimeType: cachedImage.mimeType,
    buffer: cachedImage.buffer,
    originalMimeType: includeOriginalMimeType
      ? cachedImage.mimeType
      : undefined,
    width,
    height,
  };
}

async function fetchImageResponse(imageUrl) {
  const response = await fetch(imageUrl, {
    signal: getRequestSignal(),
  });

  if (!response.ok) {
    throw new Error(`http_${response.status}`);
  }

  return response;
}

function getDownloadFailureReason(error) {
  return error instanceof Error && error.name === "TimeoutError"
    ? "timeout"
    : getErrorMessage(error, "download_failed");
}

function logDownloadFailure(identity, reason) {
  logWarn(
    "[prompt-images][asset-download-failed]",
    JSON.stringify({
      id: identity.id,
      category: identity.category,
      imageUrl: identity.imageUrl,
      reason,
    }),
  );
}

async function downloadProductImageAsset(
  item: PromptImageItemLike,
): Promise<PromptImageDownloadResult> {
  const identity = getDownloadIdentity(item);

  if (!identity.imageUrl) {
    return buildSkippedDownloadResult(identity, "missing_image_url");
  }

  try {
    const cachedImage = await readImageFromLocalCache(item?.image_url);
    if (cachedImage?.buffer) {
      return buildCachedDownloadResult(identity, cachedImage, true);
    }

    const response = await fetchImageResponse(identity.imageUrl);
    const mimeType =
      String(response.headers.get("content-type") || "").toLowerCase() ||
      "application/octet-stream";
    const sourceBuffer = Buffer.from(await response.arrayBuffer());
    const normalized = await normalizeDownloadedImage(sourceBuffer);

    return {
      ...identity,
      source: "download",
      status: "downloaded",
      reason: null,
      mimeType: normalized.mimeType,
      buffer: normalized.buffer,
      originalMimeType: mimeType,
      width: normalized.width,
      height: normalized.height,
    };
  } catch (error) {
    const reason = getDownloadFailureReason(error);
    logDownloadFailure(identity, reason);
    return buildSkippedDownloadResult(identity, reason);
  }
}

async function downloadPromptImageAsset(
  item: PromptImageItemLike,
  timings: PromptImageTimings | null = null,
): Promise<PromptImageDownloadResult> {
  const identity = getDownloadIdentity(item);

  if (!identity.imageUrl) {
    return buildSkippedDownloadResult(identity, "missing_image_url");
  }

  try {
    const cacheLookupStartedAt = nowMs();
    const cachedImage = await readImageFromLocalCache(item?.image_url);
    addTiming(timings, "cacheLookupMs", cacheLookupStartedAt);
    if (cachedImage?.buffer) {
      const inspectStartedAt = nowMs();
      const cachedResult = await buildCachedDownloadResult(
        identity,
        cachedImage,
      );
      addTiming(timings, "sourceInspectMs", inspectStartedAt);
      return cachedResult;
    }

    const fetchStartedAt = nowMs();
    const response = await fetchImageResponse(identity.imageUrl);
    addTiming(timings, "networkFetchMs", fetchStartedAt);

    const sourceBuffer = Buffer.from(await response.arrayBuffer());
    const inspectStartedAt = nowMs();
    const metadata = await sharp(sourceBuffer, {
      failOn: "none",
      limitInputPixels: MAX_SOURCE_IMAGE_PIXELS,
    })
      .metadata()
      .catch(() => ({}));
    addTiming(timings, "sourceInspectMs", inspectStartedAt);
    const { width, height } = getMetadataDimensions(metadata);

    return {
      ...identity,
      source: "download",
      status: "downloaded",
      reason: null,
      mimeType:
        String(response.headers.get("content-type") || "").toLowerCase() ||
        "application/octet-stream",
      buffer: sourceBuffer,
      width,
      height,
    };
  } catch (error) {
    const reason = getDownloadFailureReason(error);
    logDownloadFailure(identity, reason);
    return buildSkippedDownloadResult(identity, reason);
  }
}

async function downloadProductImageAssets(items: PromptImageItemLike[] = []) {
  const downloadResults = await mapWithConcurrency(
    items,
    IMAGE_DOWNLOAD_CONCURRENCY,
    (item) => downloadProductImageAsset(item),
  );

  return Object.fromEntries(
    downloadResults
      .filter(
        (result) =>
          result.status === "downloaded" && result.id && result.buffer,
      )
      .map((result) => [
        result.id,
        {
          buffer: result.buffer,
          mimeType: result.mimeType,
          source: result.source,
          imageUrl: result.imageUrl,
          originalImageUrl: result.originalImageUrl,
          width: result.width,
          height: result.height,
        },
      ]),
  );
}

export {
  downloadProductImageAsset,
  downloadPromptImageAsset,
  downloadProductImageAssets,
};
