import { THUMBNAIL_ASSET_BASE_URL } from "../api/config";
import { getSafeHttpUrl } from "../../../shared/urlSecurity.js";

const PRODUCT_IMAGE_THUMBNAIL_SIZES =
  "(max-width: 600px) calc((100vw - 48px) / 2), 285px";

type ProductImageThumbnailOptions = {
  sizes?: string;
  source?: unknown;
};

type ProductImageThumbnails = {
  src: string;
  srcSet: string;
  sizes: string;
};

type MobileThumbnailColumns = 1 | 2 | 3;

function buildProductImageThumbnailSizes({
  isMobile = false,
  mobileColumns = 2,
}: {
  isMobile?: boolean;
  mobileColumns?: MobileThumbnailColumns;
} = {}): string {
  if (!isMobile) {
    return PRODUCT_IMAGE_THUMBNAIL_SIZES;
  }

  if (mobileColumns === 1) {
    return "(max-width: 600px) 100vw, 285px";
  }

  if (mobileColumns === 3) {
    return "(max-width: 600px) 33.333vw, 285px";
  }

  return "(max-width: 600px) 50vw, 285px";
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return bytesToHex(new Uint8Array(digest));
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

function buildUploadedProductImageThumbnails(
  imageUrl: string,
  options: ProductImageThumbnailOptions = {},
): ProductImageThumbnails {
  const image320 = replaceImageUrlSuffix(imageUrl, "_320");
  const image480 = replaceImageUrlSuffix(imageUrl, "_480");
  const image640 = replaceImageUrlSuffix(imageUrl, "_640");

  return {
    src: image640,
    srcSet: `${image320} 320w, ${image480} 480w, ${image640} 640w`,
    sizes: options.sizes || PRODUCT_IMAGE_THUMBNAIL_SIZES,
  };
}

async function buildProductImageThumbnails(
  originalImageUrl: unknown,
  options: ProductImageThumbnailOptions = {},
): Promise<ProductImageThumbnails | null> {
  const original = String(originalImageUrl ?? "").trim();
  if (!getSafeHttpUrl(original)) {
    return null;
  }

  if (options.source === "uploaded") {
    return buildUploadedProductImageThumbnails(original, options);
  }

  const digest = await sha256Hex(original);
  const image320 = `${THUMBNAIL_ASSET_BASE_URL}/${digest}_320.webp`;
  const image480 = `${THUMBNAIL_ASSET_BASE_URL}/${digest}_480.webp`;
  const image640 = `${THUMBNAIL_ASSET_BASE_URL}/${digest}_640.webp`;

  return {
    src: image640,
    srcSet: `${image320} 320w, ${image480} 480w, ${image640} 640w`,
    sizes: options.sizes || PRODUCT_IMAGE_THUMBNAIL_SIZES,
  };
}

export {
  PRODUCT_IMAGE_THUMBNAIL_SIZES,
  buildProductImageThumbnailSizes,
  buildProductImageThumbnails,
  buildUploadedProductImageThumbnails,
  sha256Hex,
};
export type { ProductImageThumbnails };
