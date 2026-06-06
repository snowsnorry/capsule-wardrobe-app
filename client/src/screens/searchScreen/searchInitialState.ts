import { createSearchState } from "../../search/searchState";
import type { SearchDraftState, SearchOptions } from "../../search/searchState";

function buildInitialSearchState(
  initialQuery: string,
  nextOptions: SearchOptions,
  savedSearch: unknown,
): SearchDraftState {
  const normalizedInitialQuery = String(initialQuery || "").trim();
  return normalizedInitialQuery
    ? createSearchState(
        { query: normalizedInitialQuery, page: 1 },
        nextOptions.priceRange,
      )
    : createSearchState(
        savedSearch as Partial<SearchDraftState>,
        nextOptions.priceRange,
      );
}

export { buildInitialSearchState };
