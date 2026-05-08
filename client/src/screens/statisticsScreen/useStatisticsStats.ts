import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { fetchSearchOptions, fetchSearchStats } from "../../api/search";
import { translateOption } from "../../i18n";
import {
  EMPTY_SEARCH_OPTIONS,
  buildActiveFilterChips,
  buildSearchOptionsPayload,
} from "../../search/searchState";
import type { SearchDraftState, SearchOptions } from "../../search/searchState";
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
import useStatisticsActions from "./useStatisticsActions";

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
          serializeStatisticsState(nextState, nextOptions.priceRange),
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

  useBootstrapStatistics({
    t,
    setOptions,
    setDraftState,
    setStatsState,
    setStatus,
  });

  const actions = useStatisticsActions({
    draftStateRef,
    options,
    setDraftState,
    setStatsState,
    setStatus,
    t,
  });

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
    ...actions,
  };
}
