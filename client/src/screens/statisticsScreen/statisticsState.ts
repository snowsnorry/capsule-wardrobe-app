import {
  createSearchState,
  serializeDraftState,
} from "../../search/searchState";
import type {
  SearchDraftState,
  SerializedSearchState,
} from "../../search/searchState";
import type { SearchStatsResponse, StatisticsState } from "./statisticsTypes";

export function buildInitialStatsState(): StatisticsState {
  return {
    total: 0,
    stats: {},
    priceBuckets: [],
  };
}

export function serializeStatisticsState(
  state: SearchDraftState,
  priceRange?: Parameters<typeof serializeDraftState>[1],
): Omit<SerializedSearchState, "query" | "page" | "exactColor"> {
  const payload = serializeDraftState(state, priceRange);
  const {
    query: _query,
    page: _page,
    exactColor: _exactColor,
    ...filters
  } = payload;
  return filters;
}

export function normalizeStatsResponse(
  result: SearchStatsResponse,
): StatisticsState {
  return {
    total: Number(result.total || 0),
    stats: result.stats || {},
    priceBuckets: result.priceBuckets || [],
  };
}

export function resolveStatisticsTotal(statsState: StatisticsState) {
  const directTotal = Number(statsState.total || 0);
  const bucketTotal = statsState.priceBuckets.reduce(
    (sum, bucket) => sum + Number(bucket.count || 0),
    0,
  );
  const firstRowTotal = Object.values(statsState.stats)
    .map((rows) => rows.reduce((sum, row) => sum + Number(row.count || 0), 0))
    .find((total) => total > 0);

  return directTotal || bucketTotal || firstRowTotal || 0;
}

export function createEmptyStatisticsSearchState(
  priceRange: Parameters<typeof createSearchState>[1],
) {
  return createSearchState(null, priceRange);
}
