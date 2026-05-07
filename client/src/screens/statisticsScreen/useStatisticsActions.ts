import { useCallback } from "react";
import type { MutableRefObject } from "react";
import { fetchSearchStats } from "../../api/search";
import { toggleSelection } from "../../search/searchState";
import type {
  ActiveFilterChip,
  SearchDraftState,
  SearchFilterValue,
  SearchOptions,
} from "../../search/searchState";
import {
  createEmptyStatisticsSearchState,
  normalizeStatsResponse,
  serializeStatisticsState,
} from "./statisticsState";
import type {
  SearchStatsResponse,
  StatisticsState,
  StatisticsStatus,
} from "./statisticsTypes";

type Translate = (key: string, params?: Record<string, unknown>) => string;

function useStatisticsActions({
  draftStateRef,
  options,
  setDraftState,
  setStatsState,
  setStatus,
  t,
}: {
  draftStateRef: MutableRefObject<SearchDraftState>;
  options: SearchOptions;
  setDraftState: (value: SearchDraftState) => void;
  setStatsState: (value: StatisticsState) => void;
  setStatus: (value: StatisticsStatus) => void;
  t: Translate;
}) {
  const refreshStats = useCallback(
    async (nextState: SearchDraftState) => {
      setStatus({ loading: true, error: "" });
      try {
        const result = (await fetchSearchStats(
          serializeStatisticsState(nextState),
        )) as SearchStatsResponse;
        setStatsState(normalizeStatsResponse(result));
        setStatus({ loading: false, error: "" });
      } catch {
        setStatus({ loading: false, error: t("errors.generic") });
      }
    },
    [setStatsState, setStatus, t],
  );
  const updateDraftState = useCallback(
    async (
      updater:
        | SearchDraftState
        | ((current: SearchDraftState) => SearchDraftState),
      { submit: shouldSubmit = false } = {},
    ) => {
      const nextState =
        typeof updater === "function"
          ? updater(draftStateRef.current)
          : updater;
      draftStateRef.current = nextState;
      setDraftState(nextState);
      if (shouldSubmit) await refreshStats(nextState);
    },
    [draftStateRef, refreshStats, setDraftState],
  );
  const submit = useCallback(async () => {
    await updateDraftState(
      { ...draftStateRef.current, page: 1 },
      { submit: true },
    );
  }, [draftStateRef, updateDraftState]);
  const reset = useCallback(async () => {
    await updateDraftState(
      createEmptyStatisticsSearchState(options.priceRange),
      {
        submit: true,
      },
    );
  }, [options.priceRange, updateDraftState]);
  const toggleFacetValue = useCallback(
    async (fieldKey: keyof SearchDraftState, value: SearchFilterValue) => {
      await updateDraftState(
        (current) => ({
          ...current,
          [fieldKey]: toggleSelection(
            value,
            Array.isArray(current[fieldKey]) ? current[fieldKey] : [],
          ),
          page: 1,
        }),
        { submit: true },
      );
    },
    [updateDraftState],
  );
  const deleteActiveChip = useCallback(
    (chip: ActiveFilterChip) => {
      void updateDraftState(getStateWithoutChip(chip, options, draftStateRef), {
        submit: true,
      });
    },
    [draftStateRef, options, updateDraftState],
  );

  return {
    deleteActiveChip,
    reset,
    submit,
    toggleFacetValue,
    updateDraftState,
  };
}

function getStateWithoutChip(
  chip: ActiveFilterChip,
  options: SearchOptions,
  draftStateRef: MutableRefObject<SearchDraftState>,
) {
  return chip.field === "price"
    ? {
        ...draftStateRef.current,
        priceEnabled: false,
        priceMinDraft: options.priceRange.min ?? 0,
        priceMaxDraft: options.priceRange.max ?? 0,
        page: 1,
      }
    : { ...draftStateRef.current, [chip.field]: [], page: 1 };
}

export default useStatisticsActions;
