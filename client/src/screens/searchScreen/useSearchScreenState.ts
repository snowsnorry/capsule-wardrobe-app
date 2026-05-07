import { useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import {
  fetchSavedSearch,
  fetchSearchOptions,
  runSearch,
} from "../../api/search";
import { translateOption } from "../../i18n";
import {
  EMPTY_SEARCH_OPTIONS,
  buildActiveFilterChips,
  buildSearchOptionsPayload,
  createSearchState,
  serializeDraftState,
} from "../../search/searchState";
import type {
  ActiveFilterChip,
  SearchDraftState,
  SearchOptions,
} from "../../search/searchState";
import type { SearchResultItem, SearchStatus } from "./searchTypes";

type SearchResponse = {
  items?: SearchResultItem[];
  total?: number;
};

type UseSearchScreenStateParams = {
  initialQuery: string;
  autoOpenProductDetail: boolean;
  isMobile: boolean;
  locale: string;
  t: (key: string, params?: Record<string, unknown>) => string;
};

type SearchRuntime = UseSearchScreenStateParams & {
  options: SearchOptions;
  setOptions: (value: SearchOptions) => void;
  setDraftState: (value: SearchDraftState) => void;
  setResults: (value: SearchResultItem[]) => void;
  setTotal: (value: number) => void;
  setSelectedResultId: (value: string | number | null) => void;
  setStatus: (value: SearchStatus) => void;
  setIsDetailOpen: (value: boolean) => void;
  draftStateRef: MutableRefObject<SearchDraftState>;
  searchRequestSeqRef: MutableRefObject<number>;
  debouncedSearchRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  lastAppliedSearchKeyRef: MutableRefObject<string>;
  pendingSearchKeyRef: MutableRefObject<string>;
};

const SEARCH_AUTO_APPLY_DEBOUNCE_MS = 300;

function useSearchScreenState(params: UseSearchScreenStateParams) {
  const [options, setOptions] = useState<SearchOptions>(EMPTY_SEARCH_OPTIONS);
  const [draftState, setDraftState] = useState<SearchDraftState>(
    createSearchState(null, EMPTY_SEARCH_OPTIONS.priceRange),
  );
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedResultId, setSelectedResultId] = useState<
    string | number | null
  >(null);
  const [status, setStatus] = useState<SearchStatus>({
    loading: true,
    error: "",
  });
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const draftStateRef = useRef(draftState);
  const searchRequestSeqRef = useRef(0);
  const debouncedSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAppliedSearchKeyRef = useRef("");
  const pendingSearchKeyRef = useRef("");
  const runtimeRef = useRef<SearchRuntime | null>(null);
  const runtime = {
    ...params,
    options,
    setOptions,
    setDraftState,
    setResults,
    setTotal,
    setSelectedResultId,
    setStatus,
    setIsDetailOpen,
    draftStateRef,
    searchRequestSeqRef,
    debouncedSearchRef,
    lastAppliedSearchKeyRef,
    pendingSearchKeyRef,
  };
  runtimeRef.current = runtime;
  const actions = createSearchActions(runtime);
  const formattedTotal = useMemo(
    () => new Intl.NumberFormat(params.locale).format(total),
    [params.locale, total],
  );
  const activeChips = useMemo(
    () =>
      buildActiveFilterChips({
        state: draftState,
        options,
        locale: params.locale,
        t: params.t,
        translateOption,
      }),
    [draftState, options, params.locale, params.t],
  );
  const selectedItem = useMemo(
    () =>
      results.find((item) => String(item.id) === String(selectedResultId)) ||
      results[0] ||
      null,
    [results, selectedResultId],
  );

  useEffect(() => {
    draftStateRef.current = draftState;
  }, [draftState]);
  useEffect(() => () => clearPendingSearch(debouncedSearchRef), []);
  useEffect(() => {
    return runtimeRef.current
      ? runBootstrapEffect(runtimeRef.current)
      : undefined;
  }, [
    params.autoOpenProductDetail,
    params.initialQuery,
    params.isMobile,
    params.t,
  ]);

  return {
    ...actions,
    activeChips,
    draftState,
    formattedTotal,
    isDetailOpen,
    isFiltersOpen,
    options,
    results,
    selectedItem,
    selectedResultId,
    setIsDetailOpen,
    setIsFiltersOpen,
    status,
    total,
    totalPages: Math.max(1, Math.ceil(total / 50)),
  };
}

function createSearchActions(runtime: SearchRuntime) {
  const applySearchState = async (
    nextState: SearchDraftState,
    { debounce = false } = {},
  ) => {
    runtime.draftStateRef.current = nextState;
    runtime.setDraftState(nextState);
    clearPendingSearch(runtime.debouncedSearchRef);

    if (debounce) {
      runtime.debouncedSearchRef.current = setTimeout(() => {
        runtime.debouncedSearchRef.current = null;
        void runTrackedSearch(runtime, nextState, false);
      }, SEARCH_AUTO_APPLY_DEBOUNCE_MS);
      return;
    }

    await runTrackedSearch(runtime, nextState, false);
  };

  return {
    applyCurrentQuery: () =>
      applySearchState({ ...runtime.draftStateRef.current, page: 1 }),
    changePage: (_event: unknown, page: number) =>
      applySearchState({ ...runtime.draftStateRef.current, page }),
    changeQuery: (query: string) => {
      const nextState = { ...runtime.draftStateRef.current, query };
      runtime.draftStateRef.current = nextState;
      runtime.setDraftState(nextState);
    },
    changeSidebarDraft: async (
      updater:
        | SearchDraftState
        | ((current: SearchDraftState) => SearchDraftState),
      { submit = false } = {},
    ) => {
      const nextState =
        typeof updater === "function"
          ? updater(runtime.draftStateRef.current)
          : updater;
      runtime.draftStateRef.current = nextState;
      runtime.setDraftState(nextState);
      if (submit) {
        await applySearchState(nextState, { debounce: true });
      }
    },
    clearQuery: () =>
      applySearchState({
        ...runtime.draftStateRef.current,
        query: "",
        page: 1,
      }),
    deleteActiveChip: (chip: ActiveFilterChip) =>
      applySearchState(getStateWithoutChip(runtime, chip), { debounce: true }),
    resetSearch: () =>
      applySearchState(createSearchState(null, runtime.options.priceRange), {
        debounce: true,
      }),
    selectResult: (item: SearchResultItem) => {
      runtime.setSelectedResultId(item.id);
      if (runtime.isMobile) {
        runtime.setIsDetailOpen(true);
      }
    },
  };
}

function getStateWithoutChip(
  runtime: SearchRuntime,
  chip: ActiveFilterChip,
): SearchDraftState {
  return chip.field === "price"
    ? {
        ...runtime.draftStateRef.current,
        priceEnabled: false,
        priceMinDraft: runtime.options.priceRange.min ?? 0,
        priceMaxDraft: runtime.options.priceRange.max ?? 0,
        page: 1,
      }
    : { ...runtime.draftStateRef.current, [chip.field]: [], page: 1 };
}

function runBootstrapEffect(runtime: SearchRuntime): () => void {
  let isActive = true;
  void bootstrapSearch(runtime, () => isActive);
  return () => {
    isActive = false;
  };
}

async function runTrackedSearch(
  runtime: SearchRuntime,
  nextState: SearchDraftState,
  force: boolean,
): Promise<void> {
  const payload = serializeDraftState(nextState);
  const payloadKey = JSON.stringify(payload);
  if (
    !force &&
    (payloadKey === runtime.lastAppliedSearchKeyRef.current ||
      payloadKey === runtime.pendingSearchKeyRef.current)
  ) {
    return;
  }

  const requestSeq = bumpSearchRequestSeq(runtime);
  runtime.pendingSearchKeyRef.current = payloadKey;
  runtime.setStatus({ loading: true, error: "" });
  try {
    const result = (await runSearch(payload)) as SearchResponse;
    if (requestSeq === runtime.searchRequestSeqRef.current) {
      runtime.lastAppliedSearchKeyRef.current = payloadKey;
      runtime.pendingSearchKeyRef.current = "";
      applySearchResult(runtime, result);
    }
  } catch {
    applySearchError(runtime, requestSeq);
  }
}

async function bootstrapSearch(
  runtime: SearchRuntime,
  isActive: () => boolean,
): Promise<void> {
  runtime.setStatus({ loading: true, error: "" });
  runtime.setIsDetailOpen(false);
  try {
    const [optionsResponse, savedResponse] = await Promise.all([
      fetchSearchOptions({ force: true }),
      fetchSavedSearch({ force: true }),
    ]);
    if (!isActive()) {
      return;
    }
    const nextOptions = buildSearchOptionsPayload(optionsResponse);
    const nextState = buildInitialSearchState(
      runtime.initialQuery,
      nextOptions,
      savedResponse.search,
    );
    runtime.setOptions(nextOptions);
    runtime.setDraftState(nextState);
    runtime.draftStateRef.current = nextState;
    await runBootstrapSearch(runtime, nextState, isActive);
  } catch {
    if (isActive()) {
      runtime.setStatus({ loading: false, error: runtime.t("errors.generic") });
    }
  }
}

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

async function runBootstrapSearch(
  runtime: SearchRuntime,
  nextState: SearchDraftState,
  isActive: () => boolean,
): Promise<void> {
  const serialized = serializeDraftState(nextState);
  const requestSeq = bumpSearchRequestSeq(runtime);
  const result = (await runSearch(serialized)) as SearchResponse;
  if (!isActive() || requestSeq !== runtime.searchRequestSeqRef.current) {
    return;
  }

  runtime.lastAppliedSearchKeyRef.current = JSON.stringify(serialized);
  applySearchResult(runtime, result);
  if (
    runtime.isMobile &&
    runtime.autoOpenProductDetail &&
    (result.items || []).length === 1
  ) {
    runtime.setIsDetailOpen(true);
  }
}

function applySearchResult(
  runtime: SearchRuntime,
  result: SearchResponse,
): void {
  const nextResults = result.items || [];
  runtime.setResults(nextResults);
  runtime.setTotal(result.total || 0);
  runtime.setSelectedResultId(nextResults[0]?.id ?? null);
  runtime.setStatus({ loading: false, error: "" });
}

function applySearchError(runtime: SearchRuntime, requestSeq: number): void {
  if (requestSeq === runtime.searchRequestSeqRef.current) {
    runtime.pendingSearchKeyRef.current = "";
    runtime.setStatus({ loading: false, error: runtime.t("errors.generic") });
  }
}

function bumpSearchRequestSeq(runtime: SearchRuntime): number {
  const requestSeq = runtime.searchRequestSeqRef.current + 1;
  runtime.searchRequestSeqRef.current = requestSeq;
  return requestSeq;
}

function clearPendingSearch(
  debouncedSearchRef: MutableRefObject<ReturnType<typeof setTimeout> | null>,
): void {
  if (debouncedSearchRef.current) {
    clearTimeout(debouncedSearchRef.current);
    debouncedSearchRef.current = null;
  }
}

export default useSearchScreenState;
export type SearchScreenStateController = ReturnType<
  typeof useSearchScreenState
>;
