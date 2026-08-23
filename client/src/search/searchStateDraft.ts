import {
  INITIAL_SEARCH_STATE,
  SEARCH_ARRAY_FIELDS,
} from "./searchStateConstants";
import type {
  SearchArrayField,
  SearchDraftState,
  SearchFilterValue,
  SearchPriceRange,
  SearchState,
  SearchStateSource,
  SerializedSearchState,
} from "./searchStateTypes";
import { normalizeExactColorRange } from "./exactColorRange";

function normalizeSearchArrayValue(
  value: SearchFilterValue | SearchFilterValue[] | undefined,
): SearchFilterValue[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function normalizeBoolean(value: unknown): boolean {
  return value === true;
}

const EXACT_COLOR_PATTERN = /^#[0-9a-f]{6}$/;

function normalizeExactColor(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return EXACT_COLOR_PATTERN.test(normalized) ? normalized : null;
}

export function createSearchState(
  savedSearch: Partial<SearchStateSource> | null | undefined,
  priceRange: SearchPriceRange,
): SearchDraftState {
  const base = { ...INITIAL_SEARCH_STATE, ...(savedSearch || {}) };
  const rangeMin = priceRange.min ?? 0;
  const rangeMax = priceRange.max ?? 0;
  const priceMinDraft = base.priceMin ?? rangeMin;
  const priceMaxDraft = base.priceMax ?? rangeMax;
  const hasPriceBounds =
    (base.priceMin !== null || base.priceMax !== null) &&
    !isFullPriceRange(priceMinDraft, priceMaxDraft, priceRange);
  const normalizedArrays = Object.fromEntries(
    SEARCH_ARRAY_FIELDS.map((field) => [
      field,
      normalizeSearchArrayValue(base[field]),
    ]),
  ) as Pick<SearchState, SearchArrayField>;

  return {
    ...base,
    ...normalizedArrays,
    exactColor: normalizeExactColor(base.exactColor),
    exactColorRange: normalizeExactColorRange(base.exactColorRange),
    likedOnly: normalizeBoolean(base.likedOnly),
    priceEnabled: hasPriceBounds,
    priceMinDraft: hasPriceBounds ? priceMinDraft : rangeMin,
    priceMaxDraft: hasPriceBounds ? priceMaxDraft : rangeMax,
  };
}

export function clampPriceValue(
  value: number | string | null | undefined,
  min: number,
  max: number,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return min;
  }
  return Math.min(Math.max(parsed, min), max);
}

export function serializeDraftState(
  state: SearchDraftState,
  priceRange?: SearchPriceRange,
): SerializedSearchState {
  const hasPriceFilter =
    state.priceEnabled &&
    !(
      priceRange &&
      isFullPriceRange(state.priceMinDraft, state.priceMaxDraft, priceRange)
    );

  return {
    query: state.query,
    exactColor: state.exactColor,
    exactColorRange: state.exactColorRange,
    likedOnly: state.likedOnly,
    brand: state.brand,
    priceMin: hasPriceFilter ? Number(state.priceMinDraft) : null,
    priceMax: hasPriceFilter ? Number(state.priceMaxDraft) : null,
    audience: state.audience,
    category: state.category,
    season: state.season,
    formalityLevel: state.formalityLevel,
    style: state.style,
    occasions: state.occasions,
    color: state.color,
    pattern: state.pattern,
    silhouette: state.silhouette,
    fit: state.fit,
    closureType: state.closureType,
    page: state.page,
  };
}

export function isFullPriceRange(
  priceMin: number | string | null | undefined,
  priceMax: number | string | null | undefined,
  priceRange: SearchPriceRange,
): boolean {
  const rangeMin = priceRange.min ?? 0;
  const rangeMax = priceRange.max ?? 0;
  return Number(priceMin) === rangeMin && Number(priceMax) === rangeMax;
}

export function toggleSelection(
  value: SearchFilterValue,
  selected: SearchFilterValue[],
): SearchFilterValue[] {
  return selected.includes(value)
    ? selected.filter((item) => item !== value)
    : [...selected, value];
}
