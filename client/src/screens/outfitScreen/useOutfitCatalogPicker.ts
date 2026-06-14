import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useMediaQuery } from "@mui/material";
import { fetchSearchOptions, runSearch } from "../../api/search";
import { translateOption } from "../../i18n";
import {
  EMPTY_SEARCH_OPTIONS,
  buildActiveFilterChips,
  buildSearchOptionsPayload,
  createSearchState,
  serializeDraftState,
} from "../../search/searchState";
import { getSearchStateWithoutChip } from "../searchScreen/searchChipState";
import type { Translate } from "../../components/ProfileFiltersAnchorTypes";
import type { WardrobeItem } from "../../app/appTypes";
import type {
  ActiveFilterChip,
  SearchDraftState,
  SearchOptions,
} from "../../search/searchState";
import { sortOutfitWardrobeItems } from "./outfitItemMappers";

const CATALOG_PICKER_PAGE_SIZE = 20;

function getCatalogMobileFiltersDraft(catalogDraftState: SearchDraftState) {
  return catalogDraftState;
}

function getAppliedCatalogSearchState(state: SearchDraftState) {
  return { ...state, page: 1 };
}

function getResetCatalogSearchState(catalogOptions: SearchOptions) {
  return createSearchState(null, catalogOptions.priceRange);
}

function useOutfitCatalogPicker({
  locale,
  open,
  t,
  tab,
}: {
  locale: string;
  open: boolean;
  t: Translate;
  tab: number;
}) {
  const [catalogItems, setCatalogItems] = useState<WardrobeItem[]>([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogOptions, setCatalogOptions] =
    useState<SearchOptions>(EMPTY_SEARCH_OPTIONS);
  const [catalogDraftState, setCatalogDraftState] = useState<SearchDraftState>(
    () => createSearchState(null, EMPTY_SEARCH_OPTIONS.priceRange),
  );
  const [catalogAppliedQuery, setCatalogAppliedQuery] = useState("");
  const [catalogMobileFiltersDraftState, setCatalogMobileFiltersDraftState] =
    useState<SearchDraftState>(() =>
      createSearchState(null, EMPTY_SEARCH_OPTIONS.priceRange),
    );
  const [catalogStatus, setCatalogStatus] = useState({
    loading: false,
    error: "",
  });
  const [isCatalogFiltersOpen, setIsCatalogFiltersOpen] = useState(false);
  const isCatalogMobile = useMediaQuery("(max-width:899px)");

  const runCatalogSearch = useCatalogSearchRunner({
    catalogOptions,
    setCatalogItems,
    setCatalogStatus,
    setCatalogTotal,
    t,
  });

  const bootstrapCatalogSearch = useCatalogBootstrap({
    setCatalogAppliedQuery,
    setCatalogItems,
    setCatalogDraftState,
    setCatalogMobileFiltersDraftState,
    setCatalogOptions,
    setCatalogStatus,
    setCatalogTotal,
    t,
  });

  useEffect(() => {
    if (open && tab === 1) {
      void bootstrapCatalogSearch();
    }
  }, [bootstrapCatalogSearch, open, tab]);

  const catalogActiveChips = useMemo(
    () =>
      buildActiveFilterChips({
        state:
          catalogDraftState.query === catalogAppliedQuery
            ? catalogDraftState
            : { ...catalogDraftState, query: catalogAppliedQuery },
        options: catalogOptions,
        locale,
        t,
        translateOption,
      }),
    [catalogAppliedQuery, catalogDraftState, catalogOptions, locale, t],
  );

  return {
    catalogActiveChips,
    catalogDraftState,
    catalogMobileFiltersDraftState,
    catalogOptions,
    catalogStatus,
    catalogTotal,
    isCatalogFiltersOpen,
    isCatalogMobile,
    setCatalogDraftState,
    setIsCatalogFiltersOpen,
    visibleCatalogItems: sortOutfitWardrobeItems(catalogItems),
    ...useCatalogActions({
      catalogDraftState,
      catalogOptions,
      runCatalogSearch,
      setCatalogAppliedQuery,
      setCatalogDraftState,
      setCatalogMobileFiltersDraftState,
      setIsCatalogFiltersOpen,
    }),
  };
}

function useCatalogSearchRunner({
  catalogOptions,
  setCatalogItems,
  setCatalogStatus,
  setCatalogTotal,
  t,
}: {
  catalogOptions: SearchOptions;
  setCatalogItems: Dispatch<SetStateAction<WardrobeItem[]>>;
  setCatalogStatus: (status: { loading: boolean; error: string }) => void;
  setCatalogTotal: (total: number) => void;
  t: Translate;
}) {
  return useCallback(
    async (nextState: SearchDraftState) => {
      setCatalogStatus({ loading: true, error: "" });
      try {
        const payload = serializeDraftState(
          nextState,
          catalogOptions.priceRange,
        );
        const result = await runSearch({
          ...payload,
          limit: CATALOG_PICKER_PAGE_SIZE,
          persist: false,
        });
        setCatalogItems(Array.isArray(result.items) ? result.items : []);
        setCatalogTotal(Number(result.total) || 0);
        setCatalogStatus({ loading: false, error: "" });
      } catch {
        setCatalogStatus({ loading: false, error: t("errors.generic") });
      }
    },
    [
      catalogOptions.priceRange,
      setCatalogItems,
      setCatalogStatus,
      setCatalogTotal,
      t,
    ],
  );
}

function useCatalogBootstrap({
  setCatalogAppliedQuery,
  setCatalogItems,
  setCatalogDraftState,
  setCatalogMobileFiltersDraftState,
  setCatalogOptions,
  setCatalogStatus,
  setCatalogTotal,
  t,
}: {
  setCatalogAppliedQuery: (query: string) => void;
  setCatalogItems: Dispatch<SetStateAction<WardrobeItem[]>>;
  setCatalogDraftState: Dispatch<SetStateAction<SearchDraftState>>;
  setCatalogMobileFiltersDraftState: Dispatch<SetStateAction<SearchDraftState>>;
  setCatalogOptions: (options: SearchOptions) => void;
  setCatalogStatus: (status: { loading: boolean; error: string }) => void;
  setCatalogTotal: (total: number) => void;
  t: Translate;
}) {
  return useCallback(async () => {
    setCatalogStatus({ loading: true, error: "" });
    try {
      const optionsResponse = await fetchSearchOptions({ force: true });
      const nextOptions = buildSearchOptionsPayload(optionsResponse);
      const nextState = createSearchState(null, nextOptions.priceRange);
      setCatalogOptions(nextOptions);
      setCatalogDraftState(nextState);
      setCatalogAppliedQuery(nextState.query);
      setCatalogMobileFiltersDraftState(nextState);
      const result = await runSearch({
        ...serializeDraftState(nextState, nextOptions.priceRange),
        limit: CATALOG_PICKER_PAGE_SIZE,
        persist: false,
      });
      setCatalogItems(Array.isArray(result.items) ? result.items : []);
      setCatalogTotal(Number(result.total) || 0);
      setCatalogStatus({ loading: false, error: "" });
    } catch {
      setCatalogStatus({ loading: false, error: t("errors.generic") });
    }
  }, [
    setCatalogAppliedQuery,
    setCatalogItems,
    setCatalogDraftState,
    setCatalogMobileFiltersDraftState,
    setCatalogOptions,
    setCatalogStatus,
    setCatalogTotal,
    t,
  ]);
}

function useCatalogActions({
  catalogDraftState,
  catalogOptions,
  runCatalogSearch,
  setCatalogAppliedQuery,
  setCatalogDraftState,
  setCatalogMobileFiltersDraftState,
  setIsCatalogFiltersOpen,
}: {
  catalogDraftState: SearchDraftState;
  catalogOptions: SearchOptions;
  runCatalogSearch: (state: SearchDraftState) => Promise<void>;
  setCatalogAppliedQuery: (query: string) => void;
  setCatalogDraftState: Dispatch<SetStateAction<SearchDraftState>>;
  setCatalogMobileFiltersDraftState: Dispatch<SetStateAction<SearchDraftState>>;
  setIsCatalogFiltersOpen: (open: boolean) => void;
}) {
  const applyCatalogSearch = async (state = catalogDraftState) => {
    const nextState = getAppliedCatalogSearchState(state);
    setCatalogDraftState(nextState);
    setCatalogAppliedQuery(nextState.query);
    setCatalogMobileFiltersDraftState(nextState);
    await runCatalogSearch(nextState);
    setIsCatalogFiltersOpen(false);
  };

  return {
    applyCatalogSearch,
    changeCatalogDraft: async (
      updater:
        | SearchDraftState
        | ((current: SearchDraftState) => SearchDraftState),
      options: { submit?: boolean } = {},
    ) => {
      const nextState =
        typeof updater === "function" ? updater(catalogDraftState) : updater;
      setCatalogDraftState(nextState);
      if (options.submit) {
        setCatalogAppliedQuery(nextState.query);
        await runCatalogSearch(nextState);
      }
    },
    changeCatalogMobileFiltersDraft: (
      updater:
        | SearchDraftState
        | ((current: SearchDraftState) => SearchDraftState),
    ) => {
      setCatalogMobileFiltersDraftState((current) =>
        typeof updater === "function" ? updater(current) : updater,
      );
    },
    changeCatalogPage: async (_event: unknown, page: number) => {
      const nextState = { ...catalogDraftState, page };
      setCatalogDraftState(nextState);
      setCatalogAppliedQuery(nextState.query);
      await runCatalogSearch(nextState);
    },
    clearCatalogQuery: async () => {
      const nextState = { ...catalogDraftState, query: "", page: 1 };
      setCatalogDraftState(nextState);
      setCatalogAppliedQuery(nextState.query);
      await runCatalogSearch(nextState);
    },
    deleteCatalogChip: (chip: ActiveFilterChip) => {
      const nextState = getSearchStateWithoutChip({
        chip,
        currentState: catalogDraftState,
        priceRange: catalogOptions.priceRange,
      });
      setCatalogDraftState(nextState);
      setCatalogAppliedQuery(nextState.query);
      void runCatalogSearch(nextState);
    },
    openCatalogFilters: () => {
      setCatalogMobileFiltersDraftState(
        getCatalogMobileFiltersDraft(catalogDraftState),
      );
      setIsCatalogFiltersOpen(true);
    },
    resetCatalogSearch: async () => {
      const nextState = getResetCatalogSearchState(catalogOptions);
      setCatalogDraftState(nextState);
      setCatalogAppliedQuery(nextState.query);
      setCatalogMobileFiltersDraftState(nextState);
      await runCatalogSearch(nextState);
      setIsCatalogFiltersOpen(false);
    },
  };
}

export {
  CATALOG_PICKER_PAGE_SIZE,
  getAppliedCatalogSearchState,
  getCatalogMobileFiltersDraft,
  getResetCatalogSearchState,
  useOutfitCatalogPicker,
};
