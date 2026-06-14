import {
  getDistinctProductBrands,
  getDistinctProductCategories,
  getDistinctProductClosureTypes,
  getDistinctProductColors,
  getDistinctProductFits,
  getDistinctProductFormalityLevels,
  getDistinctProductOccasions,
  getDistinctProductPatterns,
  getDistinctProductSeasons,
  getDistinctProductSilhouettes,
  getProductPriceRange,
  getSearchByEmail,
  searchProducts,
  searchProductStats,
  upsertSearchByEmail,
} from "./db.js";
import { getStyles } from "./profileStore.js";
import { resolveSearchEmbedding } from "./searchSemantic.js";
import type { SearchOptions, SearchPayload } from "./searchTypes.js";
import type { SearchRowLike } from "./searchPayloadState.js";

type SearchResults = {
  total: number;
  [key: string]: unknown;
};
type SearchStoreDeps = {
  getDistinctProductBrandsImpl?: () => Promise<SearchOptions["brands"]>;
  getDistinctProductCategoriesImpl?: () => Promise<string[]>;
  getDistinctProductSeasonsImpl?: () => Promise<string[]>;
  getDistinctProductFormalityLevelsImpl?: () => Promise<string[]>;
  getStylesImpl?: (email: string) => Promise<string[]>;
  getDistinctProductOccasionsImpl?: () => Promise<string[]>;
  getDistinctProductColorsImpl?: () => Promise<string[]>;
  getDistinctProductPatternsImpl?: () => Promise<string[]>;
  getDistinctProductSilhouettesImpl?: () => Promise<string[]>;
  getDistinctProductFitsImpl?: () => Promise<string[]>;
  getDistinctProductClosureTypesImpl?: () => Promise<string[]>;
  getProductPriceRangeImpl?: () => Promise<unknown>;
  getSearchByEmailImpl?: (email: string) => Promise<SearchRowLike | null>;
  upsertSearchByEmailImpl?: (
    payload: SearchPayload & { email: string; embedding: number[] | null },
  ) => Promise<SearchRowLike | null>;
  searchProductsImpl?: (
    payload: Record<string, unknown>,
  ) => Promise<SearchResults>;
  searchProductStatsImpl?: (
    payload: SearchPayload & { profileEmail: string },
  ) => Promise<unknown>;
  resolveSearchEmbeddingImpl?: typeof resolveSearchEmbedding;
};
type ResolvedSearchStoreDeps = Required<SearchStoreDeps>;

const defaultSearchStoreDeps: ResolvedSearchStoreDeps = {
  getDistinctProductBrandsImpl: getDistinctProductBrands,
  getDistinctProductCategoriesImpl: getDistinctProductCategories,
  getDistinctProductSeasonsImpl: getDistinctProductSeasons,
  getDistinctProductFormalityLevelsImpl: getDistinctProductFormalityLevels,
  getStylesImpl: getStyles,
  getDistinctProductOccasionsImpl: getDistinctProductOccasions,
  getDistinctProductColorsImpl: getDistinctProductColors,
  getDistinctProductPatternsImpl: getDistinctProductPatterns,
  getDistinctProductSilhouettesImpl: getDistinctProductSilhouettes,
  getDistinctProductFitsImpl: getDistinctProductFits,
  getDistinctProductClosureTypesImpl: getDistinctProductClosureTypes,
  getProductPriceRangeImpl: getProductPriceRange,
  getSearchByEmailImpl: getSearchByEmail,
  upsertSearchByEmailImpl: upsertSearchByEmail,
  searchProductsImpl: searchProducts,
  searchProductStatsImpl: searchProductStats,
  resolveSearchEmbeddingImpl: resolveSearchEmbedding,
};

function resolveSearchStoreDeps(
  deps: SearchStoreDeps,
): ResolvedSearchStoreDeps {
  return {
    ...defaultSearchStoreDeps,
    ...Object.fromEntries(
      Object.entries(deps).filter(([, value]) => value !== undefined),
    ),
  } as ResolvedSearchStoreDeps;
}

export type { ResolvedSearchStoreDeps, SearchResults, SearchStoreDeps };
export { resolveSearchStoreDeps };
