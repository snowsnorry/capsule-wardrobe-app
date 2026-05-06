import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import {
  Box,
  Dialog,
  DialogContent,
  Divider,
  IconButton,
  Stack,
  Typography
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { fetchSavedSearch, fetchSearchOptions, runSearch } from "../api/search";
import { useI18n } from "../i18n/useI18n";
import { translateOption } from "../i18n";
import SearchFiltersSidebar from "../search/SearchFiltersSidebar";
import {
  EMPTY_SEARCH_OPTIONS,
  buildActiveFilterChips,
  buildSearchOptionsPayload,
  createSearchState,
  serializeDraftState
} from "../search/searchState";
import type { ActiveFilterChip, SearchDraftState, SearchOptions } from "../search/searchState";
import useMediaQuery from "@mui/material/useMediaQuery";
import SearchBar from "./searchScreen/SearchBar";
import SearchResultsList from "./searchScreen/SearchResultsList";
import ProductDetail from "./searchScreen/ProductDetail";
import type { SearchResultItem, SearchStatus } from "./searchScreen/searchTypes";

type SearchResponse = {
  items?: SearchResultItem[];
  total?: number;
};

type SearchScreenProps = {
  onNavigateApp: (nextApp: "capsule" | "explore" | "statistics") => void;
  initialQuery?: string;
  autoOpenProductDetail?: boolean;
};

const SEARCH_AUTO_APPLY_DEBOUNCE_MS = 300;

function SearchScreen({
  initialQuery = "",
  autoOpenProductDetail = false
}: SearchScreenProps): ReactElement {
  const { t, locale } = useI18n();
  const isMobile = useMediaQuery("(max-width: 1279.95px)");
  const [options, setOptions] = useState<SearchOptions>(EMPTY_SEARCH_OPTIONS);
  const [draftState, setDraftState] = useState<SearchDraftState>(createSearchState(null, EMPTY_SEARCH_OPTIONS.priceRange));
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedResultId, setSelectedResultId] = useState<string | number | null>(null);
  const [status, setStatus] = useState<SearchStatus>({ loading: true, error: "" });
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const draftStateRef = useRef(draftState);
  const searchRequestSeqRef = useRef(0);
  const debouncedSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAppliedSearchKeyRef = useRef("");
  const pendingSearchKeyRef = useRef("");
  const formattedTotal = useMemo(
    () => new Intl.NumberFormat(locale).format(total),
    [locale, total]
  );
  const activeChips = useMemo(
    () => buildActiveFilterChips({ state: draftState, options, locale, t, translateOption }),
    [draftState, locale, options, t]
  );

  useEffect(() => {
    draftStateRef.current = draftState;
  }, [draftState]);

  useEffect(() => () => {
    if (debouncedSearchRef.current) {
      clearTimeout(debouncedSearchRef.current);
    }
  }, []);

  useEffect(() => {
    let isActive = true;

    const bootstrap = async () => {
      setStatus({ loading: true, error: "" });
      setIsDetailOpen(false);
      try {
        const [optionsResponse, savedResponse] = await Promise.all([
          fetchSearchOptions({ force: true }),
          fetchSavedSearch({ force: true })
        ]);
        if (!isActive) {
          return;
        }
        const nextOptions = buildSearchOptionsPayload(optionsResponse);
        const normalizedInitialQuery = String(initialQuery || "").trim();
        const nextState = normalizedInitialQuery
          ? createSearchState({ query: normalizedInitialQuery, page: 1 }, nextOptions.priceRange)
          : createSearchState(savedResponse.search, nextOptions.priceRange);
        setOptions(nextOptions);
        setDraftState(nextState);
        const serialized = serializeDraftState(nextState);
        const requestSeq = searchRequestSeqRef.current + 1;
        searchRequestSeqRef.current = requestSeq;
        const result = await runSearch(serialized) as SearchResponse;
        if (!isActive || requestSeq !== searchRequestSeqRef.current) {
          return;
        }
        lastAppliedSearchKeyRef.current = JSON.stringify(serialized);
        const nextResults = result.items || [];
        setResults(nextResults);
        setTotal(result.total || 0);
        setSelectedResultId(nextResults[0]?.id ?? null);
        if (isMobile && autoOpenProductDetail && nextResults.length === 1) {
          setIsDetailOpen(true);
        }
        setStatus({ loading: false, error: "" });
      } catch {
        if (!isActive) {
          return;
        }
        setStatus({ loading: false, error: t("errors.generic") });
      }
    };

    bootstrap();
    return () => {
      isActive = false;
    };
  }, [autoOpenProductDetail, initialQuery, isMobile, t]);

  const selectedItem = useMemo(
    () => results.find((item) => String(item.id) === String(selectedResultId)) || results[0] || null,
    [results, selectedResultId]
  );

  const totalPages = Math.max(1, Math.ceil(total / 50));

  const performSearch = async (nextState: SearchDraftState, { force = false } = {}) => {
    const payload = serializeDraftState(nextState);
    const payloadKey = JSON.stringify(payload);
    if (!force && (payloadKey === lastAppliedSearchKeyRef.current || payloadKey === pendingSearchKeyRef.current)) {
      return;
    }
    const requestSeq = searchRequestSeqRef.current + 1;
    searchRequestSeqRef.current = requestSeq;
    pendingSearchKeyRef.current = payloadKey;
    setStatus({ loading: true, error: "" });
    try {
      const result = await runSearch(payload) as SearchResponse;
      if (requestSeq !== searchRequestSeqRef.current) {
        return;
      }
      lastAppliedSearchKeyRef.current = payloadKey;
      pendingSearchKeyRef.current = "";
      setResults(result.items || []);
      setTotal(result.total || 0);
      setSelectedResultId(result.items?.[0]?.id ?? null);
      setStatus({ loading: false, error: "" });
    } catch {
      if (requestSeq !== searchRequestSeqRef.current) {
        return;
      }
      pendingSearchKeyRef.current = "";
      setStatus({ loading: false, error: t("errors.generic") });
    }
  };

  const applySearchState = async (nextState: SearchDraftState, { debounce = false } = {}) => {
    draftStateRef.current = nextState;
    setDraftState(nextState);
    if (debouncedSearchRef.current) {
      clearTimeout(debouncedSearchRef.current);
      debouncedSearchRef.current = null;
    }

    if (debounce) {
      debouncedSearchRef.current = setTimeout(() => {
        debouncedSearchRef.current = null;
        void performSearch(nextState);
      }, SEARCH_AUTO_APPLY_DEBOUNCE_MS);
      return;
    }

    await performSearch(nextState);
  };

  const handleReset = async () => {
    const nextState = createSearchState(null, options.priceRange);
    await applySearchState(nextState, { debounce: true });
  };

  const handleChangePage = async (_event: unknown, page: number) => {
    const nextState = { ...draftStateRef.current, page };
    await applySearchState(nextState);
  };

  const handleSidebarDraftStateChange = async (
    updater: SearchDraftState | ((current: SearchDraftState) => SearchDraftState),
    { submit = false } = {}
  ) => {
    const nextState = typeof updater === "function" ? updater(draftStateRef.current) : updater;
    draftStateRef.current = nextState;
    setDraftState(nextState);

    if (submit) {
      await applySearchState(nextState, { debounce: true });
    }
  };

  const handleQueryChange = (query: string) => {
    const nextState = { ...draftStateRef.current, query };
    draftStateRef.current = nextState;
    setDraftState(nextState);
  };

  const applyCurrentQuery = async () => {
    const nextState = { ...draftStateRef.current, page: 1 };
    await applySearchState(nextState);
  };

  const handleClearQuery = async () => {
    const nextState = { ...draftStateRef.current, query: "", page: 1 };
    await applySearchState(nextState);
  };

  const handleDeleteActiveChip = async (chip: ActiveFilterChip) => {
    if (chip.field === "price") {
      const nextState = {
        ...draftStateRef.current,
        priceEnabled: false,
        priceMinDraft: options.priceRange.min ?? 0,
        priceMaxDraft: options.priceRange.max ?? 0,
        page: 1
      };
      await applySearchState(nextState, { debounce: true });
      return;
    }

    const nextState = {
      ...draftStateRef.current,
      [chip.field]: [],
      page: 1
    };
    await applySearchState(nextState, { debounce: true });
  };

  const selectResult = (item: SearchResultItem) => {
    setSelectedResultId(item.id);
    if (isMobile) {
      setIsDetailOpen(true);
    }
  };

  const searchBar = (forMobile: boolean) => (
    <SearchBar
      isMobile={forMobile}
      query={draftState.query}
      t={t}
      onOpenFilters={() => setIsFiltersOpen(true)}
      onQueryChange={handleQueryChange}
      onApplyQuery={() => {
        void applyCurrentQuery();
      }}
      onClearQuery={() => {
        void handleClearQuery();
      }}
    />
  );

  const resultsList = (forMobile: boolean) => (
    <SearchResultsList
      isMobile={forMobile}
      t={t}
      formattedTotal={formattedTotal}
      status={status}
      activeChips={activeChips}
      results={results}
      selectedResultId={selectedResultId}
      total={total}
      totalPages={totalPages}
      page={draftState.page}
      onDeleteActiveChip={(chip) => {
        void handleDeleteActiveChip(chip);
      }}
      onSelectResult={selectResult}
      onChangePage={handleChangePage}
    />
  );

  return (
    <>
      <Stack spacing={2.4} sx={{ height: "100%", minHeight: 0, overflow: "hidden" }}>
        {isMobile ? (
          <Stack spacing={2} sx={{ minHeight: 0, overflow: "hidden", px: 2, pb: 2 }}>
            {searchBar(true)}
            <Divider sx={{ mx: -2 }} />
            <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>{resultsList(true)}</Box>
          </Stack>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "320px minmax(0, 1fr)",
              gap: 3,
              flex: 1,
              minHeight: 0,
              overflow: "hidden"
            }}
          >
            <Box
              sx={{
                minHeight: 0,
                alignSelf: "start",
                maxHeight: "100%",
                overflowY: "auto",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: "10px",
                backgroundColor: "background.paper",
                p: 3
              }}
            >
              <Stack spacing={2.5} sx={{ mb: 3.5 }}>
                <Typography
                  variant="h6"
                  sx={{
                    color: "text.primary",
                    fontSize: "18px",
                    fontWeight: 600,
                    lineHeight: 1.25
                  }}
                >
                  {t("filters.title")}
                </Typography>
                <Divider />
              </Stack>
              <SearchFiltersSidebar
                options={options}
                draftState={draftState}
                onDraftStateChange={handleSidebarDraftStateChange}
                status={status}
                onApply={async () => {
                  await applyCurrentQuery();
                  setIsFiltersOpen(false);
                }}
                onReset={handleReset}
                autoApply
              />
            </Box>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "minmax(280px, 420px) minmax(0, 1fr)",
                gridTemplateRows: "auto minmax(0, 1fr)",
                gap: 3,
                minHeight: 0,
                overflow: "hidden",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: "10px",
                backgroundColor: "background.paper",
                p: 3
              }}
            >
              <Box sx={{ gridColumn: "1 / 3" }}>{searchBar(false)}</Box>
              <Box sx={{ minHeight: 0, overflow: "hidden" }}>{resultsList(false)}</Box>
              <Box
                sx={{
                  minHeight: 0,
                  overflowY: "auto",
                  pl: 0.5
                }}
              >
                <ProductDetail item={selectedItem} t={t} locale={locale} />
              </Box>
            </Box>
          </Box>
        )}
      </Stack>

      <Dialog
        fullScreen
        open={isFiltersOpen}
        onClose={() => setIsFiltersOpen(false)}
        PaperProps={{ sx: { overflowX: "hidden" } }}
      >
        <DialogContent sx={{ width: "100%", boxSizing: "border-box", overflowX: "hidden", px: 3, py: 3 }}>
          <Stack spacing={2.5} sx={{ minHeight: "100%", width: "100%", maxWidth: "100%" }}>
            <Stack spacing={2.5}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography
                  variant="h6"
                  sx={{
                    color: "text.primary",
                    fontSize: "18px",
                    fontWeight: 600,
                    lineHeight: 1.25
                  }}
                >
                  {t("filters.title")}
                </Typography>
                <IconButton aria-label={t("capsule.closeFilters")} onClick={() => setIsFiltersOpen(false)}>
                  <CloseRoundedIcon />
                </IconButton>
              </Stack>
              <Divider />
            </Stack>
            <Box sx={{ minHeight: 0, maxWidth: "100%", overflowX: "hidden", overflowY: "auto", pb: 2 }}>
              <SearchFiltersSidebar
                options={options}
                draftState={draftState}
                onDraftStateChange={handleSidebarDraftStateChange}
                status={status}
                onApply={async () => {
                  await applyCurrentQuery();
                  setIsFiltersOpen(false);
                }}
                onReset={handleReset}
                autoApply
              />
            </Box>
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog
        fullScreen
        open={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        PaperProps={{ sx: { overflowX: "hidden" } }}
      >
        <DialogContent sx={{ width: "100%", boxSizing: "border-box", overflowX: "hidden", px: 3, py: 3 }}>
          <Stack spacing={2.5} sx={{ minHeight: "100%", width: "100%", maxWidth: "100%" }}>
            <Box sx={{ minHeight: 0, maxWidth: "100%", overflowX: "hidden", overflowY: "auto" }}>
              <ProductDetail
                item={selectedItem}
                t={t}
                locale={locale}
                mobileBackAction={() => setIsDetailOpen(false)}
              />
            </Box>
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default SearchScreen;
