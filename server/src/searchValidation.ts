import type { SearchOptions, SearchPayload } from "./searchTypes.js";

function isAllowedArrayValue(
  values: readonly string[],
  allowedItems: readonly string[],
): boolean {
  return values.every((value) => allowedItems.includes(value));
}

function getAllowedBrandValues(
  brandOptions: SearchOptions["brands"] = [],
): string[] {
  return brandOptions
    .map((item) => (typeof item === "string" ? item : item?.value))
    .filter(Boolean);
}

function getSearchValidationPairs(
  normalized: SearchPayload,
  options: SearchOptions,
): Array<[readonly string[], readonly string[]]> {
  return [
    [normalized.brand, getAllowedBrandValues(options.brands)],
    [normalized.audience, options.audience],
    [normalized.category, options.categories],
    [normalized.formalityLevel, options.formalityLevels],
    [normalized.style, options.styles],
    [normalized.color, options.colors],
    [normalized.pattern, options.patterns],
    [normalized.silhouette, options.silhouettes],
    [normalized.fit, options.fits],
    [normalized.closureType, options.closureTypes],
    [normalized.season, options.seasons],
    [normalized.occasions, options.occasions],
  ];
}

function hasInvalidSearchPriceRange(normalized: SearchPayload): boolean {
  return (
    Number.isNaN(normalized.priceMin) ||
    Number.isNaN(normalized.priceMax) ||
    (normalized.priceMin !== null &&
      normalized.priceMax !== null &&
      normalized.priceMin > normalized.priceMax)
  );
}

function throwInvalidSearchPayload(): never {
  const error = new Error("invalid_payload");
  (error as Error & { code?: string }).code = "invalid_payload";
  throw error;
}

export function assertValidSearchPayload(
  normalized: SearchPayload,
  options: SearchOptions,
): void {
  const hasInvalidFacet = getSearchValidationPairs(normalized, options).some(
    ([values, allowedItems]) => !isAllowedArrayValue(values, allowedItems),
  );

  if (hasInvalidFacet || hasInvalidSearchPriceRange(normalized)) {
    throwInvalidSearchPayload();
  }
}
