import type { PriceBucket, SearchProductsInput } from "./core.js";

export type SearchStatsInput = Omit<
  SearchProductsInput,
  | "queryEmbedding"
  | "semanticDistanceThreshold"
  | "page"
  | "offset"
  | "limit"
  | "textQuery"
  | "textSearchMode"
>;
export type SearchStatsFilters = Required<Omit<SearchStatsInput, "urlPrefix">>;
export type SearchStatsFacetKey = Exclude<
  keyof SearchStatsFilters,
  "likedOnly" | "priceMin" | "priceMax" | "profileEmail"
>;

export type SearchStatsResult = {
  total: number;
  stats: Record<SearchStatsFacetKey, Array<{ value: string; count: number }>>;
  priceBuckets: PriceBucket[];
};

export type SearchStatsCacheEntry = {
  expiresAt: number;
  pending: Promise<SearchStatsResult> | null;
  value: SearchStatsResult | null;
};

export type SearchFacetConfig = {
  key: SearchStatsFacetKey;
  column: string;
  mode: "array" | "scalar";
};

export type BuiltSql = {
  strings: string[];
  values: unknown[];
};
