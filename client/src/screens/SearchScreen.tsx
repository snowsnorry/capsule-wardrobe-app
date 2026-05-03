import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactElement } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  Divider,
  IconButton,
  InputAdornment,
  Pagination,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ClearRoundedIcon from "@mui/icons-material/ClearRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { fetchSavedSearch, fetchSearchOptions, runSearch } from "../api/search";
import { useI18n } from "../i18n/useI18n";
import { translateOption } from "../i18n";
import ProductLabelText from "../components/ProductLabelText";
import { formatProductLabel } from "../utils/productLabel";
import { buildProductDetailGroups } from "../../../shared/productDetail.js";
import { getSafeHttpUrl } from "../../../shared/urlSecurity.js";
import { getColorSwatchStyle } from "../../../shared/colorSwatches.js";
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

type SearchResultItem = {
  id: string | number;
  name?: string;
  brand?: string;
  category?: string;
  url?: string;
  imageUrl?: string;
  description?: string;
  audience?: string;
  [key: string]: unknown;
};

type SearchStatus = {
  loading: boolean;
  error: string;
};

type SearchResponse = {
  items?: SearchResultItem[];
  total?: number;
};

type SearchScreenProps = {
  onNavigateApp: (nextApp: "capsule" | "explore" | "statistics") => void;
  initialQuery?: string;
};

const SEARCH_AUTO_APPLY_DEBOUNCE_MS = 300;

function ProductDetail({
  item,
  title,
  t,
  locale,
  mobileBackAction = null
}: {
  item: SearchResultItem | null;
  title: string;
  t: (key: string, params?: Record<string, unknown>) => string;
  locale: string;
  mobileBackAction?: (() => void) | null;
}): ReactElement {
  const detailGroups = buildProductDetailGroups(item, { t, translateOption, locale });
  const productUrl = getSafeHttpUrl(item?.url);
  const imageUrl = getSafeHttpUrl(item?.imageUrl);
  const productLabel = formatProductLabel(item, t("search.untitled"));

  return (
    <Stack spacing={2.2} sx={{ height: "100%", minHeight: 0 }}>
      {item ? (
        <>
          <Box>
            <Box sx={{ position: "relative" }}>
              {mobileBackAction ? (
                <IconButton
                  aria-label={t("search.back")}
                  onClick={mobileBackAction}
                  sx={{
                    position: "absolute",
                    top: -4,
                    left: -8,
                    zIndex: 1
                  }}
                >
                  <ArrowBackRoundedIcon />
                </IconButton>
              ) : null}
              <Box
                component={productUrl ? "a" : "div"}
                {...(productUrl
                  ? {
                      href: productUrl,
                      target: "_blank",
                      rel: "noreferrer"
                    }
                  : {})}
                sx={{
                  color: "#8f6f45",
                  textDecoration: "none",
                  display: "block",
                  "&:hover": productUrl ? { textDecoration: "underline" } : undefined
                }}
              >
                <Typography
                  component="span"
                  variant="h5"
                  sx={{
                    color: "inherit",
                    display: "block",
                    overflowWrap: "anywhere",
                    textIndent: mobileBackAction ? "40px" : 0
                  }}
                >
                  <ProductLabelText item={item} fallbackLabel={t("search.untitled")} />
                  {productUrl ? (
                    <OpenInNewRoundedIcon
                      sx={{
                        fontSize: 18,
                        color: "inherit",
                        ml: 0.6,
                        verticalAlign: "middle",
                        transform: "translateY(-0.04em)"
                      }}
                    />
                  ) : null}
                </Typography>
              </Box>
            </Box>
            {item.brand ? <Typography variant="h6">{item.brand}</Typography> : null}
            {item.category ? (
              <Typography variant="body2" color="text.secondary">
                {translateOption("categories", item.category, locale)}
              </Typography>
            ) : null}
          </Box>
          {item.description ? (
            <Typography variant="body1" color="text.secondary">
              {item.description}
            </Typography>
          ) : null}
          <Stack spacing={1.4}>
            {detailGroups.map((group) => (
              <Box
                key={group.id}
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
                  gap: 1.5,
                  p: 1.8,
                  borderRadius: "22px",
                  backgroundColor: "rgba(31, 41, 51, 0.03)"
                }}
              >
                {group.items.map((row) => (
                  <Box key={row.key}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.35 }}>
                      {row.label}
                    </Typography>
                    <Typography component="div" variant="body2" sx={{ lineHeight: 1.45 }}>
                      {row.value.kind === "colors" ? (
                        <Stack direction="row" spacing={0.9} alignItems="center" flexWrap="wrap" useFlexGap>
                          {row.value.items.map((value) => (
                            <Stack key={value.key} direction="row" spacing={0.7} alignItems="center">
                              <Box
                                sx={{
                                  width: 12,
                                  height: 12,
                                  borderRadius: "999px",
                                  boxSizing: "border-box",
                                  flexShrink: 0,
                                  border: "1px solid #999",
                                  ...getColorSwatchStyle(value.key)
                                }}
                              />
                              <span>{value.label}</span>
                            </Stack>
                          ))}
                        </Stack>
                      ) : row.value.text}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ))}
          </Stack>
          {imageUrl ? (
            <Box
              component="img"
              src={imageUrl}
              alt={item.name || ""}
              sx={{
                width: "100%",
                borderRadius: "22px",
                border: "1px solid",
                borderColor: "divider",
                objectFit: "cover",
                backgroundColor: "background.default"
              }}
            />
          ) : null}
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {t("search.detailEmpty")}
        </Typography>
      )}
    </Stack>
  );
}

function SearchScreen({
  onNavigateApp,
  initialQuery = ""
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
        setResults(result.items || []);
        setTotal(result.total || 0);
        setSelectedResultId(result.items?.[0]?.id ?? null);
        setStatus({ loading: false, error: "" });
      } catch (error) {
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
  }, [initialQuery, t]);

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
    } catch (error) {
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

  const renderSearchBar = (isMobile: boolean) => (
    <Stack direction="row" spacing={1.2} alignItems="center">
      {isMobile ? (
        <IconButton
          aria-label={t("filters.open")}
          onClick={() => setIsFiltersOpen(true)}
          sx={{ flexShrink: 0 }}
        >
          <TuneRoundedIcon />
        </IconButton>
      ) : null}
      <TextField
        fullWidth
        value={draftState.query}
        onChange={(event) => handleQueryChange(event.target.value)}
        onBlur={() => {
          void applyCurrentQuery();
        }}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void applyCurrentQuery();
          }
        }}
        placeholder={t("search.placeholder")}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchRoundedIcon sx={{ color: "text.secondary" }} />
            </InputAdornment>
          ),
          endAdornment: draftState.query ? (
            <InputAdornment position="end">
              <IconButton
                edge="end"
                aria-label={t("search.clear")}
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() => {
                  void handleClearQuery();
                }}
                size="small"
              >
                <ClearRoundedIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : null
        }}
      />
    </Stack>
  );

  const renderResultsList = (isMobile) => (
    <Stack spacing={2} sx={{ minHeight: 0, height: "100%" }}>
      <Stack spacing={1}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="overline" color="text.secondary" sx={{ minWidth: 0 }}>
            {t("search.resultsCount", { count: formattedTotal })}
          </Typography>
          {status.loading ? <CircularProgress size={18} /> : null}
        </Stack>
        {activeChips.length > 0 ? (
          <Stack direction="row" flexWrap="wrap" gap={1} useFlexGap>
            {activeChips.map((chip) => (
              <Chip
                key={chip.key}
                label={chip.label}
                onDelete={() => {
                  void handleDeleteActiveChip(chip);
                }}
                sx={{
                  maxWidth: "100%",
                  "& .MuiChip-label": {
                    display: "block",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  }
                }}
              />
            ))}
          </Stack>
        ) : null}
      </Stack>
      <Divider />
      <Stack spacing={1.1} sx={{ flex: 1, minHeight: 0, overflowY: "auto", pr: 0.5 }}>
        {results.length === 0 && !status.loading ? (
          <Typography variant="body2" color="text.secondary">
            {t("search.empty")}
          </Typography>
        ) : null}
        {results.map((item) => (
          <Box
            key={item.id}
            role="button"
            tabIndex={0}
            onClick={() => {
              setSelectedResultId(item.id);
              if (isMobile) {
                setIsDetailOpen(true);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setSelectedResultId(item.id);
                if (isMobile) {
                  setIsDetailOpen(true);
                }
              }
            }}
            sx={{
              pl: "10px",
              pr: 0.5,
              py: 1.1,
              borderRadius: 0,
              cursor: "pointer",
              border: "none",
              backgroundColor: String(selectedResultId) === String(item.id) ? "rgba(28, 124, 124, 0.06)" : "transparent",
              transition: "background-color 160ms ease, transform 160ms ease",
              outline: "none",
              "&:hover": {
                backgroundColor: "rgba(31, 41, 51, 0.035)"
              }
            }}
          >
            <Typography variant="body1" sx={{ fontWeight: 700 }}>
              <ProductLabelText item={item} fallbackLabel={t("search.untitled")} />
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {item.brand || t("search.noBrand")}
            </Typography>
          </Box>
        ))}
      </Stack>
      {total > 50 ? (
        <Pagination
          page={draftState.page}
          count={totalPages}
          onChange={handleChangePage}
          shape="rounded"
          color="primary"
          siblingCount={isMobile ? 0 : 1}
          boundaryCount={isMobile ? 1 : 2}
          sx={{
            alignSelf: "center",
            maxWidth: "100%",
            "& .MuiPagination-ul": {
              flexWrap: "nowrap",
              justifyContent: "center"
            }
          }}
        />
      ) : null}
    </Stack>
  );

  return (
    <>
      <Stack spacing={2.4} sx={{ height: "100%", minHeight: 0, overflow: "hidden" }}>
        {isMobile ? (
          <Stack spacing={2} sx={{ minHeight: 0, overflow: "hidden", px: 2, pb: 2 }}>
            {renderSearchBar(true)}
            <Divider sx={{ mx: -2 }} />
            <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>{renderResultsList(true)}</Box>
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
              <Box sx={{ gridColumn: "1 / 3" }}>{renderSearchBar(false)}</Box>
              <Box sx={{ minHeight: 0, overflow: "hidden" }}>{renderResultsList(false)}</Box>
              <Box
                sx={{
                  minHeight: 0,
                  overflowY: "auto",
                  pl: 0.5
                }}
              >
                <ProductDetail item={selectedItem} title={t("search.productCard")} t={t} locale={locale} />
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
                title={t("search.productCard")}
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
