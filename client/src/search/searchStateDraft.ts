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

function normalizeSearchArrayValue(
  value: SearchFilterValue | SearchFilterValue[] | undefined,
): SearchFilterValue[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}

export function createSearchState(
  savedSearch: Partial<SearchStateSource> | null | undefined,
  priceRange: SearchPriceRange,
): SearchDraftState {
  const base = { ...INITIAL_SEARCH_STATE, ...(savedSearch || {}) };
  const hasPriceBounds = base.priceMin !== null || base.priceMax !== null;
  const normalizedArrays = Object.fromEntries(
    SEARCH_ARRAY_FIELDS.map((field) => [
      field,
      normalizeSearchArrayValue(base[field]),
    ]),
  ) as Pick<SearchState, SearchArrayField>;

  return {
    ...base,
    ...normalizedArrays,
    priceEnabled: hasPriceBounds,
    priceMinDraft: hasPriceBounds
      ? (base.priceMin ?? priceRange.min ?? 0)
      : (priceRange.min ?? 0),
    priceMaxDraft: hasPriceBounds
      ? (base.priceMax ?? priceRange.max ?? 0)
      : (priceRange.max ?? 0),
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
): SerializedSearchState {
  return {
    query: state.query,
    brand: state.brand,
    priceMin: state.priceEnabled ? Number(state.priceMinDraft) : null,
    priceMax: state.priceEnabled ? Number(state.priceMaxDraft) : null,
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

export function toggleSelection(
  value: SearchFilterValue,
  selected: SearchFilterValue[],
): SearchFilterValue[] {
  return selected.includes(value)
    ? selected.filter((item) => item !== value)
    : [...selected, value];
}
