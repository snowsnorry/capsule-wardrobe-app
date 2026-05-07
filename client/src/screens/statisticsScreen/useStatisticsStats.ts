import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { fetchSearchOptions, fetchSearchStats } from "../../api/search";
import { translateOption } from "../../i18n";
import {
  EMPTY_SEARCH_OPTIONS,
  buildActiveFilterChips,
  buildSearchOptionsPayload,
  toggleSelection,
} from "../../search/searchState";
import type {
  ActiveFilterChip,
  SearchDraftState,
  SearchFilterValue,
  SearchOptions,
} from "../../search/searchState";
import {
  buildInitialStatsState,
  createEmptyStatisticsSearchState,
  normalizeStatsResponse,
  resolveStatisticsTotal,
  serializeStatisticsState,
} from "./statisticsState";
import type {
  SearchStatsResponse,
  StatisticsState,
  StatisticsStatus,
} from "./statisticsTypes";

type Translate = (key: string, params?: Record<string, unknown>) => string;

type UseStatisticsStatsParams = {
  t: Translate;
  locale: string;
};

function useBootstrapStatistics({
  t,
  setOptions,
  setDraftState,
  setStatsState,
  setStatus,
}: {
  t: Translate;
  setOptions: Dispatch<SetStateAction<SearchOptions>>;
  setDraftState: Dispatch<SetStateAction<SearchDraftState>>;
  setStatsState: Dispatch<SetStateAction<StatisticsState>>;
  setStatus: Dispatch<SetStateAction<StatisticsStatus>>;
}) {
  useEffect(() => {
    let isActive = true;

    const bootstrap = async () => {
      setStatus({ loading: true, error: "" });
      try {
        const optionsResponse = await fetchSearchOptions({ force: true });
        if (!isActive) {
          return;
        }

        const nextOptions = buildSearchOptionsPayload(optionsResponse);
        const nextState = createEmptyStatisticsSearchState(
          nextOptions.priceRange,
        );
        setOptions(nextOptions);
        setDraftState(nextState);
        const result = (await fetchSearchStats(
          serializeStatisticsState(nextState),
        )) as SearchStatsResponse;
        if (isActive) {
          setStatsState(normalizeStatsResponse(result));
          setStatus({ loading: false, error: "" });
        }
      } catch {
        if (isActive) {
          setStatus({ loading: false, error: t("errors.generic") });
        }
      }
    };

    bootstrap();
    return () => {
      isActive = false;
    };
  }, [setDraftState, setOptions, setStatsState, setStatus, t]);
}

export function useStatisticsStats({ t, locale }: UseStatisticsStatsParams) {
  const [options, setOptions] = useState<SearchOptions>(EMPTY_SEARCH_OPTIONS);
  const [draftState, setDraftState] = useState<SearchDraftState>(
    createEmptyStatisticsSearchState(EMPTY_SEARCH_OPTIONS.priceRange),
  );
  const [statsState, setStatsState] = useState<StatisticsState>(
    buildInitialStatsState(),
  );
  const [status, setStatus] = useState<StatisticsStatus>({
    loading: true,
    error: "",
  });
  const draftStateRef = useRef(draftState);

  useEffect(() => {
    draftStateRef.current = draftState;
  }, [draftState]);

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
    [t],
  );

  useBootstrapStatistics({
    t,
    setOptions,
    setDraftState,
    setStatsState,
    setStatus,
  });

  const submit = useCallback(async () => {
    const nextState = { ...draftStateRef.current, page: 1 };
    draftStateRef.current = nextState;
    setDraftState(nextState);
    await refreshStats(nextState);
  }, [refreshStats]);

  const reset = useCallback(async () => {
    const nextState = createEmptyStatisticsSearchState(options.priceRange);
    draftStateRef.current = nextState;
    setDraftState(nextState);
    await refreshStats(nextState);
  }, [options.priceRange, refreshStats]);

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
      if (shouldSubmit) {
        await refreshStats(nextState);
      }
    },
    [refreshStats],
  );

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
      if (chip.field === "price") {
        updateDraftState(
          (current) => ({
            ...current,
            priceEnabled: false,
            priceMinDraft: options.priceRange.min ?? 0,
            priceMaxDraft: options.priceRange.max ?? 0,
            page: 1,
          }),
          { submit: true },
        );
        return;
      }
      updateDraftState(
        (current) => ({ ...current, [chip.field]: [], page: 1 }),
        { submit: true },
      );
    },
    [options.priceRange.max, options.priceRange.min, updateDraftState],
  );

  const activeChips = useMemo(
    () =>
      buildActiveFilterChips({
        state: draftState,
        options,
        locale,
        t,
        translateOption,
      }),
    [draftState, locale, options, t],
  );

  return {
    options,
    draftState,
    statsState,
    status,
    activeChips,
    resolvedTotal: resolveStatisticsTotal(statsState),
    submit,
    reset,
    updateDraftState,
    toggleFacetValue,
    deleteActiveChip,
  };
}
