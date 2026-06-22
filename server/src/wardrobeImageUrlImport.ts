import { createHash } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import {
  guardedServerFetchBuffer,
  type GuardedDnsLookup,
  type GuardedNodeRequest,
} from "./guardedServerFetch.js";
import { buildWardrobeR2ImageKey } from "./r2Storage.js";
import { getSafeServerFetchUrl } from "./serverUrlSecurity.js";
import {
  assertBufferUnderLimit,
  assertContentLengthUnderLimit,
} from "./wardrobeUploadByteLimits.js";
import {
  WARDROBE_UPLOAD_MAX_FILE_SIZE_BYTES,
  isAllowedWardrobeUploadMimeType,
} from "./wardrobeUploadImagesCore.js";

const WARDROBE_IMAGE_URL_MAX_URLS = 5;
const WARDROBE_IMAGE_URL_MAX_BYTES = WARDROBE_UPLOAD_MAX_FILE_SIZE_BYTES;
const WARDROBE_IMAGE_URL_FETCH_TIMEOUT_MS = 30_000;

type WardrobeImageUrlDownloadResult = {
  buffer: Buffer;
  imageUrl: string;
  mimeType: string;
  originalName: string;
};

function normalizeWardrobeImageUploadUrls(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  if (value.length === 0 || value.length > WARDROBE_IMAGE_URL_MAX_URLS) {
    return null;
  }

  const urls: string[] = [];
  for (const entry of value) {
    const url = getSafeServerFetchUrl(entry);
    if (!url) {
      return null;
    }
    urls.push(url);
  }

  return urls;
}

function getImageOriginalName(imageUrl: string): string {
  try {
    const filename = new URL(imageUrl).pathname
      .split("/")
      .filter(Boolean)
      .pop();
    return filename || "wardrobe-image-url.jpg";
  } catch {
    return "wardrobe-image-url.jpg";
  }
}

function buildRemoteWardrobeImageSourceKey({
  email,
  image,
}: {
  email: string;
  image: Pick<WardrobeImageUrlDownloadResult, "buffer">;
}) {
  const digest = createHash("sha256")
    .update(Buffer.from(image.buffer))
    .digest("hex");
  return buildWardrobeR2ImageKey({ email, digest });
}

async function downloadWardrobeImageUrl({
  imageUrl,
  lookupImpl,
  requestImpl,
}: {
  imageUrl: string;
  lookupImpl?: GuardedDnsLookup;
  requestImpl?: GuardedNodeRequest;
}): Promise<WardrobeImageUrlDownloadResult> {
  const safeImageUrl = getSafeServerFetchUrl(imageUrl);
  if (!safeImageUrl) {
    throw new Error("invalid_image_url");
  }

  const response = await guardedServerFetchBuffer({
    errorCode: "image_url_too_large",
    lookupImpl,
    maxBytes: WARDROBE_IMAGE_URL_MAX_BYTES,
    requestImpl,
    timeoutMs: WARDROBE_IMAGE_URL_FETCH_TIMEOUT_MS,
    url: safeImageUrl,
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`image_url_fetch_failed_${response.status}`);
  }
  assertContentLengthUnderLimit({
    errorCode: "image_url_too_large",
    headers: response.headers,
    maxBytes: WARDROBE_IMAGE_URL_MAX_BYTES,
  });
  const buffer = assertBufferUnderLimit(
    response.buffer,
    WARDROBE_IMAGE_URL_MAX_BYTES,
    "image_url_too_large",
  );
  const detectedType = await fileTypeFromBuffer(buffer);
  if (!isAllowedWardrobeUploadMimeType(detectedType?.mime)) {
    throw new Error("image_url_invalid");
  }

  return {
    buffer,
    imageUrl: response.url,
    mimeType: detectedType.mime,
    originalName: getImageOriginalName(response.url),
  };
}

export {
  WARDROBE_IMAGE_URL_MAX_BYTES,
  buildRemoteWardrobeImageSourceKey,
  downloadWardrobeImageUrl,
  normalizeWardrobeImageUploadUrls,
};
export type { WardrobeImageUrlDownloadResult };
