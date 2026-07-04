import { DEFAULT_SEARCH_STATS_FILTERS } from "./searchStatsConfig.js";
import type {
  SearchStatsFilters,
  SearchStatsInput,
} from "./searchStatsTypes.js";

function withDefault<T>(value: T | undefined, defaultValue: T) {
  return value === undefined ? defaultValue : value;
}

function normalizeArrayFilter(
  value: string[] | undefined,
  defaultValue: string[],
) {
  return [...withDefault(value, defaultValue)].sort();
}

export function normalizeSearchStatsInput(
  input: SearchStatsInput = {},
): SearchStatsFilters {
  return {
    brand: normalizeArrayFilter(
      input.brand,
      DEFAULT_SEARCH_STATS_FILTERS.brand,
    ),
    likedOnly: withDefault(
      input.likedOnly,
      DEFAULT_SEARCH_STATS_FILTERS.likedOnly,
    ),
    profileEmail: withDefault(
      input.profileEmail,
      DEFAULT_SEARCH_STATS_FILTERS.profileEmail,
    ),
    priceMin: withDefault(
      input.priceMin,
      DEFAULT_SEARCH_STATS_FILTERS.priceMin,
    ),
    priceMax: withDefault(
      input.priceMax,
      DEFAULT_SEARCH_STATS_FILTERS.priceMax,
    ),
    audience: normalizeArrayFilter(
      input.audience,
      DEFAULT_SEARCH_STATS_FILTERS.audience,
    ),
    category: normalizeArrayFilter(
      input.category,
      DEFAULT_SEARCH_STATS_FILTERS.category,
    ),
    season: normalizeArrayFilter(
      input.season,
      DEFAULT_SEARCH_STATS_FILTERS.season,
    ),
    formalityLevel: normalizeArrayFilter(
      input.formalityLevel,
      DEFAULT_SEARCH_STATS_FILTERS.formalityLevel,
    ),
    style: normalizeArrayFilter(
      input.style,
      DEFAULT_SEARCH_STATS_FILTERS.style,
    ),
    occasions: normalizeArrayFilter(
      input.occasions,
      DEFAULT_SEARCH_STATS_FILTERS.occasions,
    ),
    color: normalizeArrayFilter(
      input.color,
      DEFAULT_SEARCH_STATS_FILTERS.color,
    ),
    pattern: normalizeArrayFilter(
      input.pattern,
      DEFAULT_SEARCH_STATS_FILTERS.pattern,
    ),
    silhouette: normalizeArrayFilter(
      input.silhouette,
      DEFAULT_SEARCH_STATS_FILTERS.silhouette,
    ),
    fit: normalizeArrayFilter(input.fit, DEFAULT_SEARCH_STATS_FILTERS.fit),
    closureType: normalizeArrayFilter(
      input.closureType,
      DEFAULT_SEARCH_STATS_FILTERS.closureType,
    ),
  };
}
