import {
  PRODUCT_AUDIENCE_OPTIONS,
  PRODUCT_CATEGORY_OPTIONS,
  PRODUCT_CLOSURE_TYPE_OPTIONS,
  PRODUCT_COLOR_BASE_OPTIONS,
  PRODUCT_FINISH_OPTIONS,
  PRODUCT_FIT_OPTIONS,
  PRODUCT_FORMALITY_LEVEL_OPTIONS,
  PRODUCT_MATERIAL_OPTIONS,
  PRODUCT_OCCASION_OPTIONS,
  PRODUCT_PATTERN_OPTIONS,
  PRODUCT_SEASON_OPTIONS,
  PRODUCT_SILHOUETTE_OPTIONS,
  PRODUCT_STYLE_OPTIONS,
} from "../../shared/productMetadataOptions.js";

type UploadedWardrobeItemDetails = {
  name: string;
  description: string | null;
  brand: string | null;
  audience: string;
  category: string;
  season: string[];
  formality_level: string[];
  style: string[];
  occasions: string[];
  color_base: string[];
  pattern: string | null;
  finish: string | null;
  composition: string | null;
  silhouette: string | null;
  fit: string | null;
  closure_type: string[];
};

type NormalizedField<T> =
  | { ok: true; value: T }
  | { ok: false; reason: "invalid_payload" };

const AUDIENCE_ALIASES: Record<string, string> = {
  all: "all",
  men: "man",
  man: "man",
  unisex: "all",
  women: "woman",
  woman: "woman",
};

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeNullableText(value: unknown): string | null {
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizeOptionKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function resolveAllowedValue(
  value: unknown,
  options: readonly string[],
): string | null {
  const normalized = normalizeOptionKey(value);
  if (!normalized) {
    return null;
  }

  if (options.includes(normalized)) {
    return normalized;
  }

  const underscored = normalized.replace(/[\s-]+/g, "_");
  return options.includes(underscored) ? underscored : null;
}

function normalizeNullableOption(
  value: unknown,
  options: readonly string[],
): NormalizedField<string | null> {
  if (value === null || value === undefined || value === "") {
    return { ok: true, value: null };
  }

  const normalized = resolveAllowedValue(value, options);
  return normalized
    ? { ok: true, value: normalized }
    : { ok: false, reason: "invalid_payload" };
}

function normalizeArrayInput(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeOptionArray(
  value: unknown,
  options: readonly string[],
): NormalizedField<string[]> {
  const normalized: string[] = [];

  for (const entry of normalizeArrayInput(value)) {
    const option = resolveAllowedValue(entry, options);
    if (!option) {
      return { ok: false, reason: "invalid_payload" };
    }

    if (!normalized.includes(option)) {
      normalized.push(option);
    }
  }

  return { ok: true, value: normalized };
}

function normalizeAudience(value: unknown): string {
  const normalized = normalizeOptionKey(value).replace(/[\s-]+/g, "_");
  const aliased = AUDIENCE_ALIASES[normalized] || normalized;
  return (PRODUCT_AUDIENCE_OPTIONS as readonly string[]).includes(aliased)
    ? aliased
    : "";
}

function getNormalizedPayloadValue<T>(
  result: NormalizedField<T>,
): T | undefined {
  return result.ok ? result.value : undefined;
}

function areNormalizedFieldsValid(
  fields: Array<NormalizedField<unknown>>,
): boolean {
  return fields.every((field) => field.ok);
}

function normalizeUploadedWardrobeItemDetails(
  payload: Record<string, unknown> = {},
): UploadedWardrobeItemDetails | null {
  const name = normalizeText(payload.name);
  const audience = normalizeAudience(payload.audience);
  const category = getNormalizedPayloadValue(
    normalizeNullableOption(payload.category, PRODUCT_CATEGORY_OPTIONS),
  );
  const season = getNormalizedPayloadValue(
    normalizeOptionArray(payload.season, PRODUCT_SEASON_OPTIONS),
  );

  if (!name || !audience || !category || !season || season.length === 0) {
    return null;
  }

  const formalityLevel = normalizeOptionArray(
    payload.formality_level,
    PRODUCT_FORMALITY_LEVEL_OPTIONS,
  );
  const style = normalizeOptionArray(payload.style, PRODUCT_STYLE_OPTIONS);
  const occasions = normalizeOptionArray(
    payload.occasions,
    PRODUCT_OCCASION_OPTIONS,
  );
  const colorBase = normalizeOptionArray(
    payload.color_base,
    PRODUCT_COLOR_BASE_OPTIONS,
  );
  const pattern = normalizeNullableOption(
    payload.pattern,
    PRODUCT_PATTERN_OPTIONS,
  );
  const finish = normalizeNullableOption(
    payload.finish,
    PRODUCT_FINISH_OPTIONS,
  );
  const composition = normalizeOptionArray(
    payload.composition,
    PRODUCT_MATERIAL_OPTIONS,
  );
  const silhouette = normalizeNullableOption(
    payload.silhouette,
    PRODUCT_SILHOUETTE_OPTIONS,
  );
  const fit = normalizeNullableOption(payload.fit, PRODUCT_FIT_OPTIONS);
  const closureType = normalizeOptionArray(
    payload.closure_type,
    PRODUCT_CLOSURE_TYPE_OPTIONS,
  );

  if (
    !areNormalizedFieldsValid([
      formalityLevel,
      style,
      occasions,
      colorBase,
      pattern,
      finish,
      composition,
      silhouette,
      fit,
      closureType,
    ])
  ) {
    return null;
  }

  return {
    name,
    description: normalizeNullableText(payload.description),
    brand: normalizeNullableText(payload.brand),
    audience,
    category,
    season,
    formality_level: getNormalizedPayloadValue(formalityLevel)!,
    style: getNormalizedPayloadValue(style)!,
    occasions: getNormalizedPayloadValue(occasions)!,
    color_base: getNormalizedPayloadValue(colorBase)!,
    pattern: getNormalizedPayloadValue(pattern)!,
    finish: getNormalizedPayloadValue(finish)!,
    composition:
      getNormalizedPayloadValue(composition)!.length > 0
        ? getNormalizedPayloadValue(composition)!.join(", ")
        : null,
    silhouette: getNormalizedPayloadValue(silhouette)!,
    fit: getNormalizedPayloadValue(fit)!,
    closure_type: getNormalizedPayloadValue(closureType)!,
  };
}

export { normalizeUploadedWardrobeItemDetails };
export type { UploadedWardrobeItemDetails };
