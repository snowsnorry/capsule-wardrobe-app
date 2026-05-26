import { createHash } from "node:crypto";
import type { RequestOptions, Response as ImpersResponse } from "impers";
import { getSafeServerFetchUrl } from "./serverUrlSecurity.js";
import { downloadProductImageAssets } from "./ai/promptImageDownloads.js";
import { buildWardrobeR2ImageKey } from "./r2Storage.js";

const WARDROBE_PRODUCT_PAGE_MAX_URLS = 5;
const PRODUCT_PAGE_HTML_MAX_CHARS = 200_000;
const PRODUCT_PAGE_FETCH_TIMEOUT_SECONDS = 30;
const PRODUCT_PAGE_IMAGE_ID = "product-page-image";

type ImpersGet = (
  url: string,
  options?: RequestOptions,
) => Promise<ImpersResponse>;

type ProductPageFetchResult = {
  html: string;
  url: string;
};

type ProductPageImageDownloadResult = {
  buffer: Buffer;
  imageUrl: string;
  mimeType: string;
  originalName: string;
};

async function defaultImpersGet(url: string, options?: RequestOptions) {
  const impers = await import("impers");
  return impers.get(url, options);
}

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

function getImpersContentType(response: ImpersResponse): string {
  const responseLike = response as ImpersResponse & {
    contentType?: string | null;
    headers?: { get?: (name: string) => unknown };
  };
  return String(
    responseLike.contentType ||
      responseLike.headers?.get?.("content-type") ||
      "",
  ).toLowerCase();
}

function assertProductPageHtmlResponse(response: ImpersResponse) {
  if (!response.ok) {
    throw new Error(`product_page_fetch_failed_${response.status}`);
  }

  const contentType = getImpersContentType(response);
  if (
    contentType &&
    !contentType.includes("text/html") &&
    !contentType.includes("application/xhtml+xml") &&
    !contentType.includes("text/plain")
  ) {
    throw new Error("product_page_not_html");
  }
}

function truncateProductPageHtml(html: string): string {
  return String(html || "").slice(0, PRODUCT_PAGE_HTML_MAX_CHARS);
}

async function fetchProductPageHtmlWithImpers({
  getImpl = defaultImpersGet,
  url,
}: {
  getImpl?: ImpersGet;
  url: string;
}): Promise<ProductPageFetchResult> {
  const safeUrl = getSafeServerFetchUrl(url);
  if (!safeUrl) {
    throw new Error("invalid_product_page_url");
  }

  const response = await getImpl(safeUrl, {
    allowRedirects: true,
    impersonate: "chrome",
    maxRedirects: 5,
    timeout: PRODUCT_PAGE_FETCH_TIMEOUT_SECONDS,
  });
  assertProductPageHtmlResponse(response);

  const finalUrl = getSafeServerFetchUrl(response.url) || safeUrl;
  const html = truncateProductPageHtml(response.text);
  if (!html.trim()) {
    throw new Error("product_page_empty_html");
  }

  return {
    html,
    url: finalUrl,
  };
}

function getImageOriginalName(imageUrl: string): string {
  try {
    const filename = new URL(imageUrl).pathname
      .split("/")
      .filter(Boolean)
      .pop();
    return filename || "product-page-image.jpg";
  } catch {
    return "product-page-image.jpg";
  }
}

async function downloadWardrobeProductPageImage({
  imageUrl,
}: {
  imageUrl: string;
}): Promise<ProductPageImageDownloadResult> {
  const assets = await downloadProductImageAssets([
    {
      category: "uploaded",
      id: PRODUCT_PAGE_IMAGE_ID,
      imageUrl,
    },
  ]);
  const asset = assets[PRODUCT_PAGE_IMAGE_ID];
  if (!asset?.buffer) {
    throw new Error("product_page_image_download_failed");
  }

  return {
    buffer: Buffer.from(asset.buffer),
    imageUrl,
    mimeType: String(asset.mimeType || "image/jpeg"),
    originalName: getImageOriginalName(imageUrl),
  };
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
  WARDROBE_PRODUCT_PAGE_MAX_URLS,
  buildRemoteWardrobeImageSourceKey,
  downloadWardrobeProductPageImage,
  extractOpenGraphImageUrl,
  fetchProductPageHtmlWithImpers,
  normalizeWardrobeProductPageUploadUrls,
  parseHtmlTagAttributes,
};
export type { ProductPageFetchResult, ProductPageImageDownloadResult };
