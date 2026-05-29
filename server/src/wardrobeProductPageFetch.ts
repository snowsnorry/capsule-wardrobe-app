import { fileTypeFromBuffer } from "file-type";
import type { RequestOptions, Response as ImpersResponse } from "impers";
import { getSafeServerFetchUrl } from "./serverUrlSecurity.js";
import {
  WARDROBE_UPLOAD_MAX_FILE_SIZE_BYTES,
  isAllowedWardrobeUploadMimeType,
} from "./wardrobeUploadImagesCore.js";
import {
  assertBufferUnderLimit,
  assertContentLengthUnderLimit,
  createByteLimitedCollector,
  type HeaderLike,
} from "./wardrobeUploadByteLimits.js";

const PRODUCT_PAGE_HTML_MAX_CHARS = 200_000;
const PRODUCT_PAGE_HTML_MAX_BYTES = 512 * 1024;
const PRODUCT_PAGE_IMAGE_MAX_BYTES = WARDROBE_UPLOAD_MAX_FILE_SIZE_BYTES;
const PRODUCT_PAGE_FETCH_TIMEOUT_SECONDS = 30;

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

type ProductPageUrlFetchResult =
  | ProductPageFetchResult
  | {
      type: "image";
      image: ProductPageImageDownloadResult;
      url: string;
    };

async function defaultImpersGet(url: string, options?: RequestOptions) {
  const impers = await import("impers");
  return impers.get(url, options);
}

function getImpersContentType(response: ImpersResponse): string {
  const responseLike = response as ImpersResponse & {
    contentType?: string | null;
    headers?: HeaderLike;
  };
  return String(
    responseLike.contentType ||
      responseLike.headers?.get?.("content-type") ||
      "",
  ).toLowerCase();
}

function getContentTypeMime(contentType: string): string {
  return String(contentType || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
}

function isProductPageHtmlContentType(contentType: string): boolean {
  const mimeType = getContentTypeMime(contentType);
  return (
    !mimeType ||
    mimeType === "text/html" ||
    mimeType === "application/xhtml+xml" ||
    mimeType === "text/plain"
  );
}

function isDirectWardrobeImageContentType(contentType: string): boolean {
  return isAllowedWardrobeUploadMimeType(getContentTypeMime(contentType));
}

function isBufferLike(value: unknown): value is Buffer | Uint8Array {
  return Buffer.isBuffer(value) || value instanceof Uint8Array;
}

function getProductPageFetchSignal() {
  if (
    typeof AbortSignal !== "undefined" &&
    typeof AbortSignal.timeout === "function"
  ) {
    return AbortSignal.timeout(PRODUCT_PAGE_FETCH_TIMEOUT_SECONDS * 1000);
  }

  return undefined;
}

async function getImpersContentBuffer(
  response: ImpersResponse,
  {
    errorCode,
    maxBytes,
  }: {
    errorCode: string;
    maxBytes: number;
  },
) {
  const responseLike = response as ImpersResponse & {
    aContent?: () => Promise<Buffer | Uint8Array>;
    content?: Buffer | Uint8Array;
    text?: string;
  };

  try {
    const content = responseLike.content;
    if (isBufferLike(content)) {
      return assertBufferUnderLimit(Buffer.from(content), maxBytes, errorCode);
    }
  } catch (error) {
    if (error instanceof Error && error.message === errorCode) {
      throw error;
    }
  }

  if (typeof responseLike.aContent === "function") {
    const content = await responseLike.aContent();
    if (isBufferLike(content)) {
      return assertBufferUnderLimit(Buffer.from(content), maxBytes, errorCode);
    }
  }

  return assertBufferUnderLimit(
    Buffer.from(String(responseLike.text || "")),
    maxBytes,
    errorCode,
  );
}

function assertProductPageResponseOk(response: ImpersResponse) {
  if (!response.ok) {
    throw new Error(`product_page_fetch_failed_${response.status}`);
  }
}

function assertProductPageHtmlContentType(response: ImpersResponse) {
  if (!isProductPageHtmlContentType(getImpersContentType(response))) {
    throw new Error("product_page_not_html");
  }
}

function truncateProductPageHtml(html: string): string {
  return String(html || "").slice(0, PRODUCT_PAGE_HTML_MAX_CHARS);
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

async function buildDirectImageFetchResult({
  buffer,
  finalUrl,
}: {
  buffer: Buffer;
  finalUrl: string;
}): Promise<ProductPageUrlFetchResult> {
  const detectedType = await fileTypeFromBuffer(buffer);
  if (!isAllowedWardrobeUploadMimeType(detectedType?.mime)) {
    throw new Error("product_page_image_invalid");
  }

  return {
    type: "image",
    image: {
      buffer,
      imageUrl: finalUrl,
      mimeType: detectedType.mime,
      originalName: getImageOriginalName(finalUrl),
    },
    url: finalUrl,
  };
}

async function fetchProductPageHtmlWithImpers({
  getImpl = defaultImpersGet,
  url,
}: {
  getImpl?: ImpersGet;
  url: string;
}): Promise<ProductPageUrlFetchResult> {
  const safeUrl = getSafeServerFetchUrl(url);
  if (!safeUrl) {
    throw new Error("invalid_product_page_url");
  }

  const responseBytes = createByteLimitedCollector(
    PRODUCT_PAGE_IMAGE_MAX_BYTES,
    "product_page_response_too_large",
  );
  const response = await getImpl(safeUrl, {
    allowRedirects: true,
    contentCallback: (chunk) => responseBytes.append(chunk),
    impersonate: "chrome",
    maxRedirects: 5,
    stream: true,
    timeout: PRODUCT_PAGE_FETCH_TIMEOUT_SECONDS,
  });
  assertProductPageResponseOk(response);

  const finalUrl = getSafeServerFetchUrl(response.url) || safeUrl;
  const contentType = getImpersContentType(response);
  if (isDirectWardrobeImageContentType(contentType)) {
    assertContentLengthUnderLimit({
      errorCode: "product_page_image_too_large",
      headers: (response as ImpersResponse & { headers?: HeaderLike }).headers,
      maxBytes: PRODUCT_PAGE_IMAGE_MAX_BYTES,
    });
    const buffer = responseBytes.hasChunks
      ? responseBytes.getBuffer()
      : await getImpersContentBuffer(response, {
          errorCode: "product_page_image_too_large",
          maxBytes: PRODUCT_PAGE_IMAGE_MAX_BYTES,
        });
    return buildDirectImageFetchResult({ buffer, finalUrl });
  }

  assertProductPageHtmlContentType(response);
  assertContentLengthUnderLimit({
    errorCode: "product_page_html_too_large",
    headers: (response as ImpersResponse & { headers?: HeaderLike }).headers,
    maxBytes: PRODUCT_PAGE_HTML_MAX_BYTES,
  });
  const htmlBuffer = responseBytes.hasChunks
    ? responseBytes.getBuffer()
    : await getImpersContentBuffer(response, {
        errorCode: "product_page_html_too_large",
        maxBytes: PRODUCT_PAGE_HTML_MAX_BYTES,
      });
  const html = truncateProductPageHtml(
    assertBufferUnderLimit(
      htmlBuffer,
      PRODUCT_PAGE_HTML_MAX_BYTES,
      "product_page_html_too_large",
    ).toString("utf8"),
  );
  if (!html.trim()) {
    throw new Error("product_page_empty_html");
  }

  return {
    html,
    url: finalUrl,
  };
}

async function downloadWardrobeProductPageImage({
  imageUrl,
}: {
  imageUrl: string;
}): Promise<ProductPageImageDownloadResult> {
  const safeImageUrl = getSafeServerFetchUrl(imageUrl);
  if (!safeImageUrl) {
    throw new Error("invalid_product_page_image_url");
  }

  const response = await fetch(safeImageUrl, {
    signal: getProductPageFetchSignal(),
  });
  if (!response.ok) {
    throw new Error(`product_page_image_fetch_failed_${response.status}`);
  }

  assertContentLengthUnderLimit({
    errorCode: "product_page_image_too_large",
    headers: response.headers,
    maxBytes: PRODUCT_PAGE_IMAGE_MAX_BYTES,
  });
  const buffer = await readFetchResponseWithLimit({
    errorCode: "product_page_image_too_large",
    maxBytes: PRODUCT_PAGE_IMAGE_MAX_BYTES,
    response,
  });
  const detectedType = await fileTypeFromBuffer(buffer);
  if (!isAllowedWardrobeUploadMimeType(detectedType?.mime)) {
    throw new Error("product_page_image_invalid");
  }

  return {
    buffer,
    imageUrl: safeImageUrl,
    mimeType: detectedType.mime,
    originalName: getImageOriginalName(safeImageUrl),
  };
}

async function readFetchResponseWithLimit({
  errorCode,
  maxBytes,
  response,
}: {
  errorCode: string;
  maxBytes: number;
  response: Response;
}) {
  const reader = response.body?.getReader();
  if (!reader) {
    const buffer = Buffer.from(await response.arrayBuffer());
    return assertBufferUnderLimit(buffer, maxBytes, errorCode);
  }

  const collector = createByteLimitedCollector(maxBytes, errorCode);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        collector.append(value);
      }
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  }

  return collector.getBuffer();
}

export {
  PRODUCT_PAGE_HTML_MAX_BYTES,
  PRODUCT_PAGE_IMAGE_MAX_BYTES,
  downloadWardrobeProductPageImage,
  fetchProductPageHtmlWithImpers,
};
export type {
  ProductPageFetchResult,
  ProductPageImageDownloadResult,
  ProductPageUrlFetchResult,
};
