import { getSafeHttpUrl } from "../../../../shared/urlSecurity.js";

type ProductDetailItem = {
  id?: string | number | null;
  name?: string | null;
  brand?: string | null;
  category?: string | null;
  url?: string | null;
  imageUrl?: string | null;
  rawImageUrl?: string | null;
  wardrobeId?: string | number | null;
  source?: string | null;
  description?: string | null;
  audience?: string | null;
  color?: string | null;
  colorBase?: unknown;
  season?: unknown;
  formalityLevel?: unknown;
  style?: unknown;
  occasions?: unknown;
  closureType?: unknown;
  isNeutral?: unknown;
  isSavedToWardrobe?: boolean | null;
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
  setDefinedDetailValue(normalized, "imageUrl", item.imageUrl);
  setDefinedDetailValue(normalized, "rawImageUrl", item.rawImageUrl);
  setDefinedDetailValue(
    normalized,
    "colorBase",
    normalizeArrayValue(item.colorBase ?? item.color),
  );
  setDefinedDetailValue(normalized, "season", normalizeArrayValue(item.season));
  setDefinedDetailValue(
    normalized,
    "formalityLevel",
    normalizeArrayValue(item.formalityLevel),
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
    normalizeArrayValue(item.closureType),
  );
  setDefinedDetailValue(normalized, "isNeutral", item.isNeutral);

  return normalized;
}

function getProductDetailImageUrl(item: ProductDetailItem | null | undefined) {
  return getSafeHttpUrl(item?.imageUrl);
}

function getProductDetailRawImageUrl(
  item: ProductDetailItem | null | undefined,
) {
  return getSafeHttpUrl(item?.rawImageUrl);
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
