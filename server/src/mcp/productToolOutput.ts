import { getSafeHttpUrl } from "../../../shared/urlSecurity.js";

import { buildMcpImageThumbnailUrl } from "./mcpImageThumbnails.js";

export type ProductRowLike = Record<string, unknown>;

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function nullableBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function nullablePrice(value: unknown): number | string | null {
  return typeof value === "number" || typeof value === "string" ? value : null;
}

function nullableStringArray(value: unknown): string[] | null {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string")
    : null;
}

function getPriceDisplay(
  amount: number | string | null,
  currency: string | null,
) {
  if (amount == null) {
    return null;
  }
  return currency ? `${String(amount)} ${currency}` : String(amount);
}

export function toNormalizedProduct(item: ProductRowLike) {
  const amount = nullablePrice(item.price);
  const currency = nullableString(item.currency);
  const category = nullableString(item.category);
  const availability = nullableString(item.availability);
  const season = nullableStringArray(item.season);
  const style = nullableStringArray(item.style);
  const isSavedToWardrobe = nullableBoolean(item.isSavedToWardrobe);

  return {
    id: String(item.id || ""),
    name: String(item.name || ""),
    brand: nullableString(item.brand),
    url: getSafeHttpUrl(item.url),
    description: nullableString(item.description),
    price: {
      amount,
      currency,
      display: getPriceDisplay(amount, currency),
    },
    availability,
    image: buildMcpImageThumbnailUrl(item.imageUrl),
    audience: nullableString(item.audience),
    category,
    attributes: {
      season,
      formalityLevel: nullableStringArray(item.formalityLevel),
      style,
      occasions: nullableStringArray(item.occasions),
      colorBase: nullableStringArray(item.colorBase),
      pattern: nullableString(item.pattern),
      finish: nullableString(item.finish),
      isNeutral: nullableBoolean(item.isNeutral),
      composition: nullableString(item.composition),
      silhouette: nullableString(item.silhouette),
      fit: nullableString(item.fit),
      closureType: nullableStringArray(item.closureType),
      isSavedToWardrobe,
    },
  };
}
