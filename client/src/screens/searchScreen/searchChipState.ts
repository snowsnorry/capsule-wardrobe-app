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
  return chip.field === "price"
    ? {
        ...currentState,
        priceEnabled: false,
        priceMinDraft: priceRange.min ?? 0,
        priceMaxDraft: priceRange.max ?? 0,
        page: 1,
      }
    : { ...currentState, [chip.field]: [], page: 1 };
}

export { getSearchStateWithoutChip };
