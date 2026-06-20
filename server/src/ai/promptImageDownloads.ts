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

type DownloadIdentity = Pick<
  PromptImageDownloadResult,
  "category" | "id" | "imageUrl" | "originalImageUrl"
>;

type PromptImageDownloadCandidate = {
  cacheKey: string;
  imageUrl: string;
  originalImageUrl: string;
};

function getDownloadIdentity(item: PromptImageItemLike) {
  return {
    id: String(item?.id ?? ""),
    category: item?.category ?? "",
    imageUrl: resolveSourceImageUrl(item?.imageUrl),
    originalImageUrl: getOriginalImageUrl(item?.imageUrl),
  };
}

function addPromptImageDownloadCandidate(
  candidates: PromptImageDownloadCandidate[],
  candidate: PromptImageDownloadCandidate,
) {
  if (
    !candidate.imageUrl ||
    candidates.some((entry) => entry.imageUrl === candidate.imageUrl)
  ) {
    return;
  }

  candidates.push(candidate);
}

function getPromptImageDownloadCandidates(
  item: PromptImageItemLike,
  identity: DownloadIdentity,
) {
  const candidates: PromptImageDownloadCandidate[] = [];
  const fallbackOriginalImageUrl =
    identity.originalImageUrl || getOriginalImageUrl(item?.imageUrl);
  const thumbnailImageUrl = resolveSourceImageUrl(item?.thumbnailUrl);
  const thumbnailOriginalImageUrl = getOriginalImageUrl(item?.thumbnailUrl);

  addPromptImageDownloadCandidate(candidates, {
    cacheKey: thumbnailOriginalImageUrl,
    imageUrl: thumbnailImageUrl,
    originalImageUrl: fallbackOriginalImageUrl,
  });
  addPromptImageDownloadCandidate(candidates, {
    cacheKey: fallbackOriginalImageUrl,
    imageUrl: identity.imageUrl,
    originalImageUrl: fallbackOriginalImageUrl,
  });

  return candidates;
}

function buildSkippedDownloadResult(
  identity: DownloadIdentity,
  reason: string,
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
  identity: DownloadIdentity,
  cachedImage,
  includeOriginalMimeType = false,
): Promise<PromptImageDownloadResult> {
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

async function inspectPromptImageMetadata(buffer: Buffer | Uint8Array) {
  const metadata = await sharp(buffer, {
    failOn: "none",
    limitInputPixels: MAX_SOURCE_IMAGE_PIXELS,
  }).metadata();
  return getMetadataDimensions(metadata);
}

async function buildCachedPromptDownloadResult(
  identity: DownloadIdentity,
  cachedImage,
): Promise<PromptImageDownloadResult> {
  const { width, height } = await inspectPromptImageMetadata(
    cachedImage.buffer,
  );
  return {
    ...identity,
    source: "cache",
    cachePath: cachedImage.cachePath,
    status: "downloaded",
    reason: null,
    mimeType: cachedImage.mimeType,
    buffer: cachedImage.buffer,
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
    const cachedImage = await readImageFromLocalCache(item?.imageUrl);
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
  const candidates = getPromptImageDownloadCandidates(item, identity);

  if (candidates.length === 0) {
    return buildSkippedDownloadResult(identity, "missing_image_url");
  }

  let lastIdentity = identity;
  let lastReason = "download_failed";
  for (const candidate of candidates) {
    const candidateIdentity = {
      ...identity,
      imageUrl: candidate.imageUrl,
      originalImageUrl: candidate.originalImageUrl,
    };
    lastIdentity = candidateIdentity;

    try {
      const cacheLookupStartedAt = nowMs();
      const cachedImage = await readImageFromLocalCache(candidate.cacheKey);
      addTiming(timings, "cacheLookupMs", cacheLookupStartedAt);
      if (cachedImage?.buffer) {
        const inspectStartedAt = nowMs();
        const cachedResult = await buildCachedPromptDownloadResult(
          candidateIdentity,
          cachedImage,
        );
        addTiming(timings, "sourceInspectMs", inspectStartedAt);
        return cachedResult;
      }

      const fetchStartedAt = nowMs();
      const response = await fetchImageResponse(candidate.imageUrl);
      addTiming(timings, "networkFetchMs", fetchStartedAt);

      const sourceBuffer = Buffer.from(await response.arrayBuffer());
      const inspectStartedAt = nowMs();
      const { width, height } = await inspectPromptImageMetadata(sourceBuffer);
      addTiming(timings, "sourceInspectMs", inspectStartedAt);

      return {
        ...candidateIdentity,
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
      lastReason = reason;
      logDownloadFailure(candidateIdentity, reason);
    }
  }

  return buildSkippedDownloadResult(lastIdentity, lastReason);
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

export { downloadPromptImageAsset, downloadProductImageAssets };
