/* eslint-disable max-lines, max-lines-per-function */
import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Pagination,
  Stack,
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
} from "@mui/material";
import AnchorPickerFilters from "../../components/ProfileFiltersAnchorPickerFilters";
import {
  pickerGridSx,
  pickerScrollAreaSx,
} from "../../components/ProfileFiltersAnchorStyles";
import { fetchMyWardrobeItems } from "../../api/myWardrobe";
import { fetchSearchOptions, runSearch } from "../../api/search";
import { translateOption } from "../../i18n";
import SearchFiltersSidebar from "../../search/SearchFiltersSidebar";
import {
  EMPTY_SEARCH_OPTIONS,
  buildActiveFilterChips,
  buildSearchOptionsPayload,
  createSearchState,
  serializeDraftState,
} from "../../search/searchState";
import SearchBar from "../searchScreen/SearchBar";
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
  catalogDesktopDividerSx,
  catalogDesktopFiltersSx,
  catalogPaginationSx,
  catalogPickerGridSx,
  catalogResultsPaneSx,
  catalogResultsScrollSx,
  catalogTabLayoutSx,
} from "./OutfitScreenStyles";
import {
  getAddItemsDialogActionsSx,
  getAddItemsDialogContentSx,
  getAddItemsDialogPaperSx,
  getAddItemsDialogTitleSx,
} from "./OutfitAddItemsDialogStyles";
import {
  CatalogResultsHeader,
  DialogLoadingDivider,
  OutfitAddItemsGrid,
} from "./OutfitAddItemsDialogParts";
import {
  sortOutfitWardrobeItems,
  useOutfitPersonalItemTypeOptions,
  useVisibleOutfitPersonalItems,
} from "./outfitItemMappers";
import { OutfitCatalogFiltersDialog } from "./OutfitCatalogFiltersDialog";

const CATALOG_PICKER_PAGE_SIZE = 20;

export function AddItemsDialog({
  existingItems,
  locale,
  open,
  onAdd,
  onClose,
  t,
}: {
  existingItems: OutfitItemSnapshot[];
  locale: string;
  open: boolean;
  onAdd: (items: OutfitItemSnapshot[]) => void;
  onClose: () => void;
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
  const isCatalogMobile = useMediaQuery("(max-width:899px)");
  const fullScreen = isCatalogMobile;

  useEffect(() => {
    if (!open) return;
    setTab(0);
    setSelected([]);
    setSourceFilter("all");
    setLikedOnly(false);
    setTypeFilter("all");
    setPersonalLoading(true);
    void fetchMyWardrobeItems({ force: true })
      .then((result) => {
        setPersonalItems(Array.isArray(result.items) ? result.items : []);
      })
      .catch(() => {
        setPersonalItems([]);
      })
      .finally(() => setPersonalLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open || tab !== 1) return;
    void bootstrapCatalogSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab]);

  const selectedKeys = new Set(selected.map((item) => item.key));
  const existingKeys = new Set(existingItems.map((item) => item.key));
  const personalCount = selected.filter(
    (item) => item.source === "personal",
  ).length;
  const catalogCount = selected.filter(
    (item) => item.source === "catalog",
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
  const totalParts = [
    personalCount ? t("outfit.personalSelected", { count: personalCount }) : "",
    catalogCount ? t("outfit.catalogSelected", { count: catalogCount }) : "",
  ].filter(Boolean);
  const catalogFormattedTotal = new Intl.NumberFormat(locale).format(
    catalogTotal,
  );
  const catalogTotalPages = Math.max(
    1,
    Math.ceil(catalogTotal / CATALOG_PICKER_PAGE_SIZE),
  );
  const isDialogLoading = personalLoading || catalogStatus.loading;

  const runCatalogSearch = async (nextState: SearchDraftState) => {
    setCatalogStatus({ loading: true, error: "" });
    try {
      const payload = serializeDraftState(nextState, catalogOptions.priceRange);
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
  };

  const bootstrapCatalogSearch = async () => {
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
  };

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
    const nextState = { ...state, page: 1 };
    setCatalogDraftState(nextState);
    setCatalogAppliedQuery(nextState.query);
    setCatalogMobileFiltersDraftState(nextState);
    await runCatalogSearch(nextState);
    setIsCatalogFiltersOpen(false);
  };

  const resetCatalogSearch = async () => {
    const nextState = createSearchState(null, catalogOptions.priceRange);
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
    setCatalogMobileFiltersDraftState(catalogDraftState);
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

  const renderCatalogFilters = ({
    autoApply,
    draftState,
    onDraftStateChange,
  }: {
    autoApply: boolean;
    draftState: SearchDraftState;
    onDraftStateChange: (
      updater:
        | SearchDraftState
        | ((current: SearchDraftState) => SearchDraftState),
      options?: { submit?: boolean },
    ) => void | Promise<void>;
  }) => (
    <SearchFiltersSidebar
      options={catalogOptions}
      draftState={draftState}
      status={catalogStatus}
      onDraftStateChange={onDraftStateChange}
      onApply={applyCatalogSearch}
      onReset={resetCatalogSearch}
      autoApply={autoApply}
      showFooterActions={false}
    />
  );

  const toggle = (snapshot: OutfitItemSnapshot | null) => {
    if (!snapshot || existingKeys.has(snapshot.key)) return;
    setSelected((current) =>
      current.some((item) => item.key === snapshot.key)
        ? current.filter((item) => item.key !== snapshot.key)
        : [...current, snapshot],
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      fullWidth={!fullScreen}
      maxWidth={fullScreen ? false : "md"}
      slotProps={{
        paper: {
          sx: getAddItemsDialogPaperSx(fullScreen),
        },
      }}
    >
      <DialogTitle sx={getAddItemsDialogTitleSx(fullScreen)}>
        <Stack spacing={2}>
          <Typography variant="h6">{t("outfit.addItems")}</Typography>
          <Typography variant="body2" color="text.secondary">
            {totalParts.length
              ? totalParts.join(" · ")
              : t("outfit.noneSelected")}
          </Typography>
          <Tabs value={tab} onChange={(_event, value) => setTab(value)}>
            <Tab label={t("outfit.personalItems")} />
            <Tab label={t("outfit.catalog")} />
          </Tabs>
        </Stack>
      </DialogTitle>
      <DialogLoadingDivider loading={isDialogLoading} />
      <DialogContent sx={getAddItemsDialogContentSx(fullScreen)}>
        {tab === 0 ? (
          <Stack spacing={2.5} sx={{ flex: 1, minHeight: 0 }}>
            <AnchorPickerFilters
              likedOnly={likedOnly}
              locale={locale}
              sourceFilter={sourceFilter}
              typeFilter={typeFilter}
              typeOptions={typeOptions}
              t={t}
              onLikedOnlyChange={setLikedOnly}
              onSourceChange={setSourceFilter}
              onTypeChange={setTypeFilter}
            />
            <Box sx={pickerScrollAreaSx}>
              <OutfitAddItemsGrid
                existingKeys={existingKeys}
                gridSx={pickerGridSx}
                items={visiblePersonalItems}
                locale={locale}
                selectedKeys={selectedKeys}
                showEmpty={!personalLoading}
                source="personal"
                t={t}
                onToggle={toggle}
              />
            </Box>
          </Stack>
        ) : null}
        {tab === 1 ? (
          <Box sx={catalogTabLayoutSx}>
            <Box sx={catalogDesktopFiltersSx}>
              <Stack spacing={2.5} sx={{ mb: 3.5 }}>
                <Typography variant="h6" sx={{ color: "text.primary" }}>
                  {t("filters.title")}
                </Typography>
                <Divider />
              </Stack>
              {renderCatalogFilters({
                autoApply: true,
                draftState: catalogDraftState,
                onDraftStateChange: changeCatalogDraft,
              })}
            </Box>
            <Divider orientation="vertical" sx={catalogDesktopDividerSx} />
            <Stack spacing={2} sx={catalogResultsPaneSx}>
              <Stack spacing={1.5} sx={{ flexShrink: 0 }}>
                <SearchBar
                  isMobile={isCatalogMobile}
                  query={catalogDraftState.query}
                  t={t}
                  onOpenFilters={openCatalogFilters}
                  onQueryChange={(query) =>
                    setCatalogDraftState((current) => ({
                      ...current,
                      query,
                      page: 1,
                    }))
                  }
                  onApplyQuery={() => {
                    void applyCatalogSearch();
                  }}
                  onClearQuery={() => {
                    void clearCatalogQuery();
                  }}
                />
                <CatalogResultsHeader
                  activeChips={catalogActiveChips}
                  formattedTotal={catalogFormattedTotal}
                  t={t}
                  onDeleteChip={deleteCatalogChip}
                />
              </Stack>
              <Box sx={catalogResultsScrollSx}>
                {catalogStatus.error ? (
                  <Typography variant="body2" color="error">
                    {catalogStatus.error}
                  </Typography>
                ) : null}
                <OutfitAddItemsGrid
                  existingKeys={existingKeys}
                  gridSx={catalogPickerGridSx}
                  items={visibleCatalogItems}
                  locale={locale}
                  selectedKeys={selectedKeys}
                  showEmpty={!catalogStatus.loading}
                  source="catalog"
                  t={t}
                  onToggle={toggle}
                />
              </Box>
              {catalogTotal > CATALOG_PICKER_PAGE_SIZE ? (
                <Pagination
                  page={catalogDraftState.page}
                  count={catalogTotalPages}
                  onChange={changeCatalogPage}
                  shape="rounded"
                  color="primary"
                  siblingCount={isCatalogMobile ? 0 : 1}
                  boundaryCount={isCatalogMobile ? 1 : 2}
                  sx={catalogPaginationSx}
                />
              ) : null}
            </Stack>
          </Box>
        ) : null}
      </DialogContent>
      <OutfitCatalogFiltersDialog
        open={isCatalogFiltersOpen}
        onClose={() => setIsCatalogFiltersOpen(false)}
        loading={catalogStatus.loading}
        status={catalogStatus}
        t={t}
        onApply={() => applyCatalogSearch(catalogMobileFiltersDraftState)}
        onReset={resetCatalogSearch}
      >
        {renderCatalogFilters({
          autoApply: false,
          draftState: catalogMobileFiltersDraftState,
          onDraftStateChange: changeCatalogMobileFiltersDraft,
        })}
      </OutfitCatalogFiltersDialog>
      <DialogActions sx={getAddItemsDialogActionsSx(fullScreen)}>
        <Button onClick={onClose}>{t("actions.cancel")}</Button>
        <Button
          variant="contained"
          disabled={selected.length === 0}
          onClick={() => onAdd(selected)}
        >
          {t("actions.add")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
