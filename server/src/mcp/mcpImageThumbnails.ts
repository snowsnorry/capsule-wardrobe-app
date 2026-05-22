import { createHash } from "node:crypto";

import { getSafeHttpUrl } from "../../../shared/urlSecurity.js";
import { THUMBNAIL_ASSET_BASE_URL } from "../appConfig.js";

type McpImageThumbnailOptions = {
  source?: unknown;
  thumbnailAssetBaseUrl?: string;
};

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function replaceImageUrlSuffix(imageUrl: string, suffix: string) {
  const url = new URL(imageUrl);
  const pathSegments = url.pathname.split("/");
  const filename = pathSegments.pop() || "";
  const lastDotIndex = filename.lastIndexOf(".");
  const basename =
    lastDotIndex > 0 ? filename.slice(0, lastDotIndex) : filename;
  pathSegments.push(`${basename}${suffix}.webp`);
  url.pathname = pathSegments.join("/");
  url.search = "";
  url.hash = "";
  return url.toString();
}

function normalizeThumbnailAssetBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function buildMcpImageThumbnailUrl(
  originalImageUrl: unknown,
  options: McpImageThumbnailOptions = {},
): string | null {
  const original = String(originalImageUrl ?? "").trim();
  if (!getSafeHttpUrl(original)) {
    return null;
  }

  if (options.source === "uploaded") {
    return replaceImageUrlSuffix(original, "_640");
  }

  const thumbnailAssetBaseUrl = normalizeThumbnailAssetBaseUrl(
    options.thumbnailAssetBaseUrl || THUMBNAIL_ASSET_BASE_URL,
  );
  return `${thumbnailAssetBaseUrl}/${sha256Hex(original)}_640.webp`;
}

export { buildMcpImageThumbnailUrl, normalizeThumbnailAssetBaseUrl, sha256Hex };
