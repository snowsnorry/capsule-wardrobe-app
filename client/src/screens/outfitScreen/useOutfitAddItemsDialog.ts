/* eslint-disable max-lines-per-function */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMediaQuery } from "@mui/material";
import { fetchPersonalItems } from "../../api/personalItems";
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
import type {
  AnchorSourceFilter,
  AnchorTypeFilter,
  Translate,
} from "../../components/ProfileFiltersAnchorTypes";
import type { OutfitItemSnapshot, WardrobeItem } from "../../app/appTypes";
import type {
  ActiveFilterChip,
  SearchDraftState,
  SearchOptions,
} from "../../search/searchState";
import {
  getOutfitItemKey,
  sortOutfitWardrobeItems,
  useOutfitPersonalItemTypeOptions,
  useVisibleOutfitPersonalItems,
} from "./outfitItemMappers";

export const CATALOG_PICKER_PAGE_SIZE = 20;
export const EMPTY_INITIAL_ITEMS: OutfitItemSnapshot[] = [];
export type OutfitAddItemsDialogModel = ReturnType<
  typeof useOutfitAddItemsDialog
>;

export function mergeSelectedSnapshots(
  current: OutfitItemSnapshot[],
  next: OutfitItemSnapshot[],
) {
  const byKey = new Map<string, OutfitItemSnapshot>();
  [...next, ...current].forEach((item) => {
    const key = getOutfitItemKey(item);
    if (key && !byKey.has(key)) {
      byKey.set(key, item);
    }
  });
  return [...byKey.values()];
}

export function getCatalogMobileFiltersDraft(
  catalogDraftState: SearchDraftState,
) {
  return catalogDraftState;
}

export function getAppliedCatalogSearchState(state: SearchDraftState) {
  return { ...state, page: 1 };
}

export function getResetCatalogSearchState(catalogOptions: SearchOptions) {
  return createSearchState(null, catalogOptions.priceRange);
}

export function useOutfitAddItemsDialog({
  existingItems,
  initialItems,
  locale,
  maxSelected,
  open,
  t,
}: {
  existingItems: OutfitItemSnapshot[];
  initialItems: OutfitItemSnapshot[];
  locale: string;
  maxSelected: number | null;
  open: boolean;
  t: Translate;
}) {
  const [tab, setTab] = useState(0);
  const [personalItems, setPersonalItems] = useState<WardrobeItem[]>([]);
  const [personalLoading, setPersonalLoading] = useState(false);
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
  const [sourceFilter, setSourceFilter] = useState<AnchorSourceFilter>("all");
  const [likedOnly, setLikedOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState<AnchorTypeFilter>("all");
  const [selected, setSelected] = useState<OutfitItemSnapshot[]>([]);
  const wasOpenRef = useRef(false);
  const selectionTouchedRef = useRef(false);
  const isCatalogMobile = useMediaQuery("(max-width:899px)");

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      selectionTouchedRef.current = false;
      return;
    }
    if (wasOpenRef.current) {
      setSelected((current) =>
        selectionTouchedRef.current
          ? mergeSelectedSnapshots(current, initialItems)
          : initialItems,
      );
      return;
    }
    wasOpenRef.current = true;
    selectionTouchedRef.current = false;
    setTab(0);
    setSelected(initialItems);
    setSourceFilter("all");
    setLikedOnly(false);
    setTypeFilter("all");
    setPersonalLoading(true);
    void fetchPersonalItems({ force: true })
      .then((result) => {
        setPersonalItems(Array.isArray(result.items) ? result.items : []);
      })
      .catch(() => {
        setPersonalItems([]);
      })
      .finally(() => setPersonalLoading(false));
  }, [initialItems, open]);

  const runCatalogSearch = useCallback(
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
    [catalogOptions.priceRange, t],
  );

  const bootstrapCatalogSearch = useCallback(async () => {
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
  }, [t]);

  useEffect(() => {
    if (!open || tab !== 1) return;
    void bootstrapCatalogSearch();
  }, [bootstrapCatalogSearch, open, tab]);

  const selectedKeys = new Set(selected.map(getOutfitItemKey));
  const existingKeys = new Set(existingItems.map(getOutfitItemKey));
  const maxSelectedReached =
    typeof maxSelected === "number" && selected.length >= maxSelected;
  const personalCount = selected.filter(
    (item) => item.source === "uploaded",
  ).length;
  const catalogCount = selected.filter(
    (item) => item.source === "from_catalog",
  ).length;
  const typeOptions = useOutfitPersonalItemTypeOptions(personalItems);
  const visiblePersonalItems = useVisibleOutfitPersonalItems({
    items: personalItems,
    likedOnly,
    sourceFilter,
    typeFilter,
  });
  const visibleCatalogItems = useMemo(
    () => sortOutfitWardrobeItems(catalogItems),
    [catalogItems],
  );
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

  const changeCatalogDraft = async (
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
  };

  const applyCatalogSearch = async (state = catalogDraftState) => {
    const nextState = getAppliedCatalogSearchState(state);
    setCatalogDraftState(nextState);
    setCatalogAppliedQuery(nextState.query);
    setCatalogMobileFiltersDraftState(nextState);
    await runCatalogSearch(nextState);
    setIsCatalogFiltersOpen(false);
  };

  const resetCatalogSearch = async () => {
    const nextState = getResetCatalogSearchState(catalogOptions);
    setCatalogDraftState(nextState);
    setCatalogAppliedQuery(nextState.query);
    setCatalogMobileFiltersDraftState(nextState);
    await runCatalogSearch(nextState);
    setIsCatalogFiltersOpen(false);
  };

  const clearCatalogQuery = async () => {
    const nextState = { ...catalogDraftState, query: "", page: 1 };
    setCatalogDraftState(nextState);
    setCatalogAppliedQuery(nextState.query);
    await runCatalogSearch(nextState);
  };

  const changeCatalogPage = async (_event: unknown, page: number) => {
    const nextState = { ...catalogDraftState, page };
    setCatalogDraftState(nextState);
    setCatalogAppliedQuery(nextState.query);
    await runCatalogSearch(nextState);
  };

  const deleteCatalogChip = (chip: ActiveFilterChip) => {
    const nextState = getSearchStateWithoutChip({
      chip,
      currentState: catalogDraftState,
      priceRange: catalogOptions.priceRange,
    });
    setCatalogDraftState(nextState);
    setCatalogAppliedQuery(nextState.query);
    void runCatalogSearch(nextState);
  };

  const openCatalogFilters = () => {
    setCatalogMobileFiltersDraftState(
      getCatalogMobileFiltersDraft(catalogDraftState),
    );
    setIsCatalogFiltersOpen(true);
  };

  const changeCatalogMobileFiltersDraft = (
    updater:
      | SearchDraftState
      | ((current: SearchDraftState) => SearchDraftState),
  ) => {
    setCatalogMobileFiltersDraftState((current) =>
      typeof updater === "function" ? updater(current) : updater,
    );
  };

  const toggle = (snapshot: OutfitItemSnapshot | null) => {
    const key = getOutfitItemKey(snapshot);
    if (!snapshot || !key || existingKeys.has(key)) return;
    selectionTouchedRef.current = true;
    setSelected((current) =>
      current.some((item) => getOutfitItemKey(item) === key)
        ? current.filter((item) => getOutfitItemKey(item) !== key)
        : typeof maxSelected === "number" && current.length >= maxSelected
          ? current
          : [...current, snapshot],
    );
  };

  return {
    catalogActiveChips,
    catalogCount,
    catalogDraftState,
    catalogMobileFiltersDraftState,
    catalogOptions,
    catalogStatus,
    catalogTotal,
    changeCatalogDraft,
    changeCatalogMobileFiltersDraft,
    changeCatalogPage,
    clearCatalogQuery,
    deleteCatalogChip,
    isCatalogFiltersOpen,
    isCatalogMobile,
    likedOnly,
    maxSelectedReached,
    openCatalogFilters,
    personalCount,
    personalLoading,
    resetCatalogSearch,
    selected,
    selectedKeys,
    setCatalogDraftState,
    setIsCatalogFiltersOpen,
    setLikedOnly,
    setSourceFilter,
    setTab,
    setTypeFilter,
    sourceFilter,
    tab,
    typeFilter,
    typeOptions,
    visibleCatalogItems,
    visiblePersonalItems,
    applyCatalogSearch,
    existingKeys,
    toggle,
  };
}
