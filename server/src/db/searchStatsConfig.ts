import type {
  SearchFacetConfig,
  SearchStatsFilters,
} from "./searchStatsTypes.js";

export const PRICE_BUCKET_COUNT = 100;
export const SEARCH_STATS_CACHE_TTL_MS = 30_000;
export const SEARCH_STATS_CACHE_MAX_ENTRIES = 100;
export const SEARCH_STATS_QUERY_CONCURRENCY = 4;

export const SEARCH_STATS_FACETS: SearchFacetConfig[] = [
  { key: "brand", column: "brand", mode: "scalar" },
  { key: "category", column: "category", mode: "scalar" },
  { key: "season", column: "season", mode: "array" },
  { key: "audience", column: "audience", mode: "scalar" },
  { key: "formalityLevel", column: "formality_level", mode: "array" },
  { key: "style", column: "style", mode: "array" },
  { key: "occasions", column: "occasions", mode: "array" },
  { key: "color", column: "color_base", mode: "array" },
  { key: "pattern", column: "pattern", mode: "scalar" },
  { key: "silhouette", column: "silhouette", mode: "scalar" },
  { key: "fit", column: "fit", mode: "scalar" },
  { key: "closureType", column: "closure_type", mode: "array" },
];

export const DEFAULT_SEARCH_STATS_FILTERS: SearchStatsFilters = {
  brand: [],
  likedOnly: false,
  profileEmail: null,
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
};
