import type { SearchDraftState } from "../../search/searchState";
import { createSearchState } from "../../search/searchState";
import type { SearchPriceRange } from "../../search/searchStateTypes";
import {
  createEmptyStatisticsSearchState,
  serializeStatisticsState,
} from "./statisticsState";

const STATISTICS_FILTERS_STORAGE_KEY = "statistics.filters";

function readStoredStatisticsFilters(
  priceRange: SearchPriceRange,
): SearchDraftState {
  if (typeof window === "undefined") {
    return createEmptyStatisticsSearchState(priceRange);
  }

  try {
    const parsed = JSON.parse(
      window.localStorage?.getItem(STATISTICS_FILTERS_STORAGE_KEY) || "{}",
    );
    return createSearchState(isRecord(parsed) ? parsed : null, priceRange);
  } catch {
    return createEmptyStatisticsSearchState(priceRange);
  }
}

function writeStoredStatisticsFilters(
  state: SearchDraftState,
  priceRange: SearchPriceRange,
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage?.setItem(
      STATISTICS_FILTERS_STORAGE_KEY,
      JSON.stringify(serializeStatisticsState(state, priceRange)),
    );
  } catch {
    // Filter persistence is optional; keep the in-memory state.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export {
  STATISTICS_FILTERS_STORAGE_KEY,
  readStoredStatisticsFilters,
  writeStoredStatisticsFilters,
};
