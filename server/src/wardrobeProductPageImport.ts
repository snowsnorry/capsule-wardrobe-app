import { createHash } from "node:crypto";
import { getSafeServerFetchUrl } from "./serverUrlSecurity.js";
import { buildWardrobeR2ImageKey } from "./r2Storage.js";
import {
  PRODUCT_PAGE_HTML_MAX_BYTES,
  PRODUCT_PAGE_IMAGE_MAX_BYTES,
  downloadWardrobeProductPageImage,
  fetchProductPageHtmlWithImpers,
  type ProductPageImageDownloadResult,
} from "./wardrobeProductPageFetch.js";

const WARDROBE_PRODUCT_PAGE_MAX_URLS = 5;

function normalizeWardrobeProductPageUploadUrls(
  value: unknown,
): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  if (value.length === 0 || value.length > WARDROBE_PRODUCT_PAGE_MAX_URLS) {
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

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

function parseHtmlTagAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const attributePattern =
    /([^\s"'=<>`]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

  for (const match of tag.matchAll(attributePattern)) {
    const name = String(match[1] || "")
      .trim()
      .toLowerCase();
    const value = decodeHtmlAttribute(
      String(match[2] ?? match[3] ?? match[4] ?? "").trim(),
    );
    if (name) {
      attributes[name] = value;
    }
  }

  return attributes;
}

function resolveProductPageImageUrl(value: unknown, baseUrl: string): string {
  const rawValue = String(value || "").trim();
  if (!rawValue) {
    return "";
  }

  try {
    return getSafeServerFetchUrl(new URL(rawValue, baseUrl).toString());
  } catch {
    return "";
  }
}

function extractOpenGraphImageUrl(html: string, baseUrl: string): string {
  const source = String(html || "");
  for (const match of source.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = parseHtmlTagAttributes(match[0]);
    const property = String(attributes.property || attributes.name || "")
      .trim()
      .toLowerCase();
    if (property !== "og:image" && property !== "og:image:url") {
      continue;
    }

    const imageUrl = resolveProductPageImageUrl(attributes.content, baseUrl);
    if (imageUrl) {
      return imageUrl;
    }
  }

  return "";
}

function buildRemoteWardrobeImageSourceKey({
  email,
  image,
}: {
  email: string;
  image: Pick<ProductPageImageDownloadResult, "buffer">;
}) {
  const digest = createHash("sha256")
    .update(Buffer.from(image.buffer))
    .digest("hex");
  return buildWardrobeR2ImageKey({ email, digest });
}

export {
  PRODUCT_PAGE_HTML_MAX_BYTES,
  PRODUCT_PAGE_IMAGE_MAX_BYTES,
  buildRemoteWardrobeImageSourceKey,
  downloadWardrobeProductPageImage,
  extractOpenGraphImageUrl,
  fetchProductPageHtmlWithImpers,
  normalizeWardrobeProductPageUploadUrls,
  parseHtmlTagAttributes,
};
