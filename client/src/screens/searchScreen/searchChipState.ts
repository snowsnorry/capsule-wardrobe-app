import type {
  ActiveFilterChip,
  SearchDraftState,
  SearchOptions,
} from "../../search/searchState";

function getSearchStateWithoutChip({
  chip,
  currentState,
  priceRange,
}: {
  chip: ActiveFilterChip;
  currentState: SearchDraftState;
  priceRange: SearchOptions["priceRange"];
}): SearchDraftState {
  if (chip.field === "price") {
    return {
      ...currentState,
      priceEnabled: false,
      priceMinDraft: priceRange.min ?? 0,
      priceMaxDraft: priceRange.max ?? 0,
      page: 1,
    };
  }

  if (chip.field === "likedOnly") {
    return { ...currentState, likedOnly: false, page: 1 };
  }

  if (chip.field === "query") {
    return { ...currentState, query: "", page: 1 };
  }

  return { ...currentState, [chip.field]: [], page: 1 };
}

export { getSearchStateWithoutChip };
