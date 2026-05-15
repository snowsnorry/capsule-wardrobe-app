import { getSafeHttpUrl } from "../../../../shared/urlSecurity.js";

type ProductDetailItem = {
  id?: string | number | null;
  name?: string | null;
  brand?: string | null;
  category?: string | null;
  url?: string | null;
  imageUrl?: string | null;
  image_url?: string | null;
  rawImageUrl?: string | null;
  raw_image_url?: string | null;
  source?: string | null;
  description?: string | null;
  audience?: string | null;
  color?: string | null;
  colorBase?: unknown;
  color_base?: unknown;
  season?: unknown;
  formalityLevel?: unknown;
  formality_level?: unknown;
  style?: unknown;
  occasions?: unknown;
  closureType?: unknown;
  closure_type?: unknown;
  isNeutral?: unknown;
  is_neutral?: unknown;
  isSavedToWardrobe?: boolean | null;
  is_saved_to_wardrobe?: boolean | null;
  savedToMyWardrobe?: boolean | null;
  [key: string]: unknown;
};

function normalizeArrayValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized ? [normalized] : [];
  }

  return value;
}

function setDefinedDetailValue(
  target: ProductDetailItem,
  key: keyof ProductDetailItem,
  value: unknown,
) {
  if (value !== undefined) {
    target[key as string] = value;
  }
}

function normalizeProductDetailItem(
  item: ProductDetailItem | null,
): ProductDetailItem | null {
  if (!item) {
    return null;
  }

  const normalized: ProductDetailItem = { ...item };
  setDefinedDetailValue(
    normalized,
    "imageUrl",
    item.imageUrl ?? item.image_url,
  );
  setDefinedDetailValue(
    normalized,
    "rawImageUrl",
    item.rawImageUrl ?? item.raw_image_url,
  );
  setDefinedDetailValue(
    normalized,
    "colorBase",
    normalizeArrayValue(item.colorBase ?? item.color_base ?? item.color),
  );
  setDefinedDetailValue(normalized, "season", normalizeArrayValue(item.season));
  setDefinedDetailValue(
    normalized,
    "formalityLevel",
    normalizeArrayValue(item.formalityLevel ?? item.formality_level),
  );
  setDefinedDetailValue(normalized, "style", normalizeArrayValue(item.style));
  setDefinedDetailValue(
    normalized,
    "occasions",
    normalizeArrayValue(item.occasions),
  );
  setDefinedDetailValue(
    normalized,
    "closureType",
    normalizeArrayValue(item.closureType ?? item.closure_type),
  );
  setDefinedDetailValue(
    normalized,
    "isNeutral",
    item.isNeutral ?? item.is_neutral,
  );

  return normalized;
}

function getProductDetailImageUrl(item: ProductDetailItem | null | undefined) {
  return getSafeHttpUrl(item?.imageUrl ?? item?.image_url);
}

function getProductDetailRawImageUrl(
  item: ProductDetailItem | null | undefined,
) {
  return getSafeHttpUrl(item?.rawImageUrl ?? item?.raw_image_url);
}

function hasUploadedProductImageVersions(
  item: ProductDetailItem | null | undefined,
) {
  const imageUrl = getProductDetailImageUrl(item);
  const rawImageUrl = getProductDetailRawImageUrl(item);
  return (
    item?.source === "uploaded" &&
    Boolean(imageUrl) &&
    Boolean(rawImageUrl) &&
    imageUrl !== rawImageUrl
  );
}

export type { ProductDetailItem };
export {
  getProductDetailImageUrl,
  getProductDetailRawImageUrl,
  hasUploadedProductImageVersions,
  normalizeProductDetailItem,
};
