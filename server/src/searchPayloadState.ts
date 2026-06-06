import type { SearchPayload } from "./searchTypes.js";

export type SearchRow = Partial<SearchPayload> & {
  embedding?: number[] | null;
};

export const DEFAULT_SEARCH_STATE = Object.freeze({
  query: "",
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
    const normalized = normalizeNullableString(values);
    return normalized ? [normalized] : [];
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

export function normalizeSearchPayload(
  payload: Partial<Record<keyof SearchPayload, unknown>> = {},
): SearchPayload {
  return {
    query: normalizeQuery(payload.query),
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
  row: SearchRow | null = null,
): SearchPayload {
  if (!row) {
    return { ...DEFAULT_SEARCH_STATE };
  }

  return {
    query: typeof row.query === "string" ? row.query : "",
    likedOnly: normalizeBoolean(row.likedOnly),
    brand: normalizeStringArray(row.brand),
    priceMin:
      row.priceMin === null || row.priceMin === undefined
        ? null
        : Number(row.priceMin),
    priceMax:
      row.priceMax === null || row.priceMax === undefined
        ? null
        : Number(row.priceMax),
    audience: normalizeStringArray(row.audience),
    category: normalizeStringArray(row.category),
    season: normalizeStringArray(row.season),
    formalityLevel: normalizeStringArray(row.formalityLevel),
    style: normalizeStringArray(row.style),
    occasions: normalizeStringArray(row.occasions),
    color: normalizeStringArray(row.color),
    pattern: normalizeStringArray(row.pattern),
    silhouette: normalizeStringArray(row.silhouette),
    fit: normalizeStringArray(row.fit),
    closureType: normalizeStringArray(row.closureType),
    page: normalizePage(row.page),
  };
}
