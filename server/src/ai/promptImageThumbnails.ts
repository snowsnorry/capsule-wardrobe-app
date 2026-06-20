import { createHash } from "node:crypto";

import { getSafeHttpUrl } from "../../../shared/urlSecurity.js";
import { THUMBNAIL_ASSET_BASE_URL } from "../appConfig.js";

const PROMPT_IMAGE_THUMBNAIL_WIDTH = 320;

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeThumbnailAssetBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function replaceImageUrlSuffix(imageUrl: string, suffix: string) {
  try {
    const url = new URL(imageUrl);
    const pathSegments = url.pathname.split("/");
    const filename = pathSegments.pop() || "";
    const lastDotIndex = filename.lastIndexOf(".");
    const basename =
      lastDotIndex > 0 ? filename.slice(0, lastDotIndex) : filename;
    if (!basename) {
      return null;
    }

    pathSegments.push(`${basename}${suffix}.webp`);
    url.pathname = pathSegments.join("/");
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function buildPromptImageThumbnailUrl(
  originalImageUrl: unknown,
  source: unknown,
): string | null {
  const original = String(originalImageUrl ?? "").trim();
  if (!getSafeHttpUrl(original)) {
    return null;
  }

  if (source === "uploaded") {
    return replaceImageUrlSuffix(original, `_${PROMPT_IMAGE_THUMBNAIL_WIDTH}`);
  }

  const thumbnailAssetBaseUrl = normalizeThumbnailAssetBaseUrl(
    THUMBNAIL_ASSET_BASE_URL,
  );
  return `${thumbnailAssetBaseUrl}/${sha256Hex(original)}_${PROMPT_IMAGE_THUMBNAIL_WIDTH}.webp`;
}

export {
  PROMPT_IMAGE_THUMBNAIL_WIDTH,
  buildPromptImageThumbnailUrl,
  normalizeThumbnailAssetBaseUrl,
  sha256Hex,
};
