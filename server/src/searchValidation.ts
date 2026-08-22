import type { SearchOptions, SearchPayload } from "./searchTypes.js";

type SearchPayloadValidationFailure = "facet" | "price";

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

function hasInvalidExactColor(normalized: SearchPayload): boolean {
  return (
    normalized.exactColor !== null &&
    !/^#[0-9a-f]{6}$/.test(normalized.exactColor)
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
  if (getSearchPayloadValidationFailure(normalized, options)) {
    throwInvalidSearchPayload();
  }
}

export function getSearchPayloadValidationFailure(
  normalized: SearchPayload,
  options: SearchOptions,
): SearchPayloadValidationFailure | null {
  const hasInvalidFacet = getSearchValidationPairs(normalized, options).some(
    ([values, allowedItems]) => !isAllowedArrayValue(values, allowedItems),
  );

  if (hasInvalidFacet) {
    return "facet";
  }
  if (hasInvalidSearchPriceRange(normalized)) {
    return "price";
  }
  if (hasInvalidExactColor(normalized)) {
    return "facet";
  }
  return null;
}
