import type { SearchPayload } from "./searchTypes.js";

export type SearchRowLike = Partial<Record<keyof SearchPayload, unknown>> & {
  embedding?: number[] | null;
};

const INVALID_SEARCH_ARRAY_VALUE = "\u0000invalid-search-array-value";

export const DEFAULT_SEARCH_STATE = Object.freeze({
  query: "",
  exactColor: null,
  likedOnly: false,
  brand: [],
  priceMin: null,
  priceMax: null,
  audience: [],
  category: [],
  season: [],
  formalityLevel: [],
  style: [],
  occasions: [],
  color: [],
  pattern: [],
  silhouette: [],
  fit: [],
  closureType: [],
  page: 1,
} as SearchPayload);

function normalizeNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const normalized = String(value).trim().toLowerCase();
  return normalized || null;
}

function normalizeQuery(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function normalizeStringArray(values: unknown): string[] {
  if (typeof values === "string") {
    return [INVALID_SEARCH_ARRAY_VALUE];
  }
  if (!Array.isArray(values)) {
    return [];
  }
  return [
    ...new Set(
      values.map((value) => normalizeNullableString(value)).filter(Boolean),
    ),
  ];
}

function serializeStringArray(values: unknown): string[] {
  return Array.isArray(values)
    ? [
        ...new Set(
          values.map((value) => normalizeNullableString(value)).filter(Boolean),
        ),
      ]
    : [];
}

function normalizePriceValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function normalizePage(value: unknown): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeBoolean(value: unknown): boolean {
  return value === true;
}

const INVALID_EXACT_COLOR = "\u0000invalid-exact-color";
const EXACT_COLOR_PATTERN = /^#[0-9a-f]{6}$/;

function normalizeExactColor(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    return INVALID_EXACT_COLOR;
  }
  const normalized = value.trim().toLowerCase();
  return EXACT_COLOR_PATTERN.test(normalized)
    ? normalized
    : INVALID_EXACT_COLOR;
}

export function normalizeSearchPayload(
  payload: Partial<Record<keyof SearchPayload, unknown>> = {},
): SearchPayload {
  return {
    query: normalizeQuery(payload.query),
    exactColor: normalizeExactColor(payload.exactColor),
    likedOnly: normalizeBoolean(payload.likedOnly),
    brand: normalizeStringArray(payload.brand),
    priceMin: normalizePriceValue(payload.priceMin),
    priceMax: normalizePriceValue(payload.priceMax),
    audience: normalizeStringArray(payload.audience),
    category: normalizeStringArray(payload.category),
    season: normalizeStringArray(payload.season),
    formalityLevel: normalizeStringArray(payload.formalityLevel),
    style: normalizeStringArray(payload.style),
    occasions: normalizeStringArray(payload.occasions),
    color: normalizeStringArray(payload.color),
    pattern: normalizeStringArray(payload.pattern),
    silhouette: normalizeStringArray(payload.silhouette),
    fit: normalizeStringArray(payload.fit),
    closureType: normalizeStringArray(payload.closureType),
    page: normalizePage(payload.page),
  };
}

export function serializeSearchRow(
  row: SearchRowLike | null = null,
): SearchPayload {
  if (!row) {
    return { ...DEFAULT_SEARCH_STATE };
  }

  return {
    query: typeof row.query === "string" ? row.query : "",
    exactColor: normalizeExactColor(row.exactColor),
    likedOnly: normalizeBoolean(row.likedOnly),
    brand: serializeStringArray(row.brand),
    priceMin:
      row.priceMin === null || row.priceMin === undefined
        ? null
        : Number(row.priceMin),
    priceMax:
      row.priceMax === null || row.priceMax === undefined
        ? null
        : Number(row.priceMax),
    audience: serializeStringArray(row.audience),
    category: serializeStringArray(row.category),
    season: serializeStringArray(row.season),
    formalityLevel: serializeStringArray(row.formalityLevel),
    style: serializeStringArray(row.style),
    occasions: serializeStringArray(row.occasions),
    color: serializeStringArray(row.color),
    pattern: serializeStringArray(row.pattern),
    silhouette: serializeStringArray(row.silhouette),
    fit: serializeStringArray(row.fit),
    closureType: serializeStringArray(row.closureType),
    page: normalizePage(row.page),
  };
}
