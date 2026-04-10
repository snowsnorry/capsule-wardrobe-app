import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
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
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { fetchSavedSearch, fetchSearchOptions, runSearch } from "../api/search.js";
import { useI18n } from "../i18n/useI18n.js";
import { translateOption } from "../i18n/index.js";
import AppLauncher from "../components/AppLauncher.jsx";
import LocaleSwitcher from "../components/LocaleSwitcher.jsx";
import ProductLabelText from "../components/ProductLabelText.jsx";
import AppSidebarShell from "../components/AppSidebarShell.jsx";
import { formatProductLabel } from "../utils/productLabel.js";
import { buildProductDetailGroups } from "../../../shared/productDetail.js";
import { getSafeHttpUrl } from "../../../shared/urlSecurity.js";
import { getColorSwatchStyle } from "../../../shared/colorSwatches.js";
import SearchFiltersSidebar from "../search/SearchFiltersSidebar.jsx";
import {
  EMPTY_SEARCH_OPTIONS,
  buildSearchOptionsPayload,
  createSearchState,
  serializeDraftState
} from "../search/searchState.js";

function ProductDetail({ item, title, t, locale, mobileBackAction = null }) {
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
  userEmail = "",
  userName = "",
  settingsProfile = null,
  onSignOut = () => {},
  onSaveSettings = async () => {}
}) {
  const { t, locale } = useI18n();
  const [options, setOptions] = useState(EMPTY_SEARCH_OPTIONS);
  const [draftState, setDraftState] = useState(createSearchState(null, EMPTY_SEARCH_OPTIONS.priceRange));
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [selectedResultId, setSelectedResultId] = useState(null);
  const [status, setStatus] = useState({ loading: true, error: "" });
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const draftStateRef = useRef(draftState);
  const formattedTotal = useMemo(
    () => new Intl.NumberFormat(locale).format(total),
    [locale, total]
  );

  useEffect(() => {
    draftStateRef.current = draftState;
  }, [draftState]);

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
        const nextState = createSearchState(savedResponse.search, nextOptions.priceRange);
        setOptions(nextOptions);
        setDraftState(nextState);
        const serialized = serializeDraftState(nextState);
        const result = await runSearch(serialized);
        if (!isActive) {
          return;
        }
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
  }, [t]);

  const selectedItem = useMemo(
    () => results.find((item) => String(item.id) === String(selectedResultId)) || results[0] || null,
    [results, selectedResultId]
  );

  const totalPages = Math.max(1, Math.ceil(total / 50));

  const performSearch = async (nextState) => {
    const payload = serializeDraftState(nextState);
    setStatus({ loading: true, error: "" });
    try {
      const result = await runSearch(payload);
      setResults(result.items || []);
      setTotal(result.total || 0);
      setSelectedResultId(result.items?.[0]?.id ?? null);
      setStatus({ loading: false, error: "" });
    } catch (error) {
      setStatus({ loading: false, error: t("errors.generic") });
    }
  };

  const handleSearchSubmit = async () => {
    const nextState = { ...draftState, page: 1 };
    setDraftState(nextState);
    await performSearch(nextState);
  };

  const handleReset = async () => {
    const nextState = createSearchState(null, options.priceRange);
    setDraftState(nextState);
    await performSearch(nextState);
  };

  const handleChangePage = async (_, page) => {
    const nextState = { ...draftState, page };
    setDraftState(nextState);
    await performSearch(nextState);
  };

  const handleSidebarDraftStateChange = async (updater, { submit = false } = {}) => {
    const nextState = typeof updater === "function" ? updater(draftStateRef.current) : updater;
    draftStateRef.current = nextState;
    setDraftState(nextState);

    if (submit) {
      await performSearch(nextState);
    }
  };

  const renderSearchBar = (isMobile) => (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
      <TextField
        fullWidth
        value={draftState.query}
        onChange={(event) => setDraftState((current) => ({ ...current, query: event.target.value }))}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            handleSearchSubmit();
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
                onClick={() => setDraftState((current) => ({ ...current, query: "" }))}
                size="small"
              >
                <ClearRoundedIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : null
        }}
      />
      <Stack direction="row" spacing={1}>
        {isMobile ? (
          <IconButton aria-label={t("filters.open")} onClick={() => setIsFiltersOpen(true)}>
            <TuneRoundedIcon />
          </IconButton>
        ) : null}
        <Button variant="contained" onClick={handleSearchSubmit} disabled={status.loading}>
          {t("search.cta")}
        </Button>
      </Stack>
    </Stack>
  );

  const renderResultsList = (isMobile) => (
    <Stack spacing={2} sx={{ minHeight: 0, height: "100%" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="overline" color="text.secondary">
          {t("search.resultsCount", { count: formattedTotal })}
        </Typography>
        {status.loading ? <CircularProgress size={18} /> : null}
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
      <AppSidebarShell
        shellTestId="search-screen-shell"
        currentApp="search"
        userEmail={userEmail}
        userName={userName}
        settingsProfile={settingsProfile}
        onSaveSettings={onSaveSettings}
        onSignOut={onSignOut}
        headerContent={({ isOverlaySidebar, openSidebar }) => (
          <Box
            sx={{
              position: "sticky",
              top: 0,
              zIndex: 3,
              backgroundColor: "background.paper",
              pb: 1.5
            }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
              <Stack direction="row" alignItems="center" spacing={1.25}>
                {isOverlaySidebar ? (
                  <IconButton aria-label="Toggle sidebar" onClick={openSidebar}>
                    <MenuRoundedIcon />
                  </IconButton>
                ) : null}
                {!isOverlaySidebar ? (
                  <Typography
                    sx={{
                      fontFamily: '"Leckerli One", cursive',
                      fontSize: "1.85rem",
                      lineHeight: 1.1,
                      color: "#8f6f45"
                    }}
                  >
                    {t("appName")}
                  </Typography>
                ) : null}
              </Stack>
              <Stack direction="row" spacing={1.2} alignItems="center">
                <AppLauncher currentApp="search" onSelectApp={onNavigateApp} />
                <LocaleSwitcher />
              </Stack>
            </Stack>
          </Box>
        )}
        sidebarBodyContent={({ isOverlaySidebar, isSidebarCollapsed, expandCollapsedSidebar }) => (
          isSidebarCollapsed && !isOverlaySidebar ? (
            <Box
              data-testid="collapsed-sidebar-expand-hitbox"
              onClick={expandCollapsedSidebar}
              sx={{ flex: 1, height: "100%", cursor: "pointer" }}
            />
          ) : null
        )}
      >
        {({ isOverlaySidebar }) => (
          <Stack spacing={2.4} sx={{ height: "100%", minHeight: 0, overflow: "hidden" }}>
            {isOverlaySidebar ? (
              <Stack spacing={2} sx={{ minHeight: 0, overflow: "hidden" }}>
                {renderSearchBar(true)}
                <Divider />
                <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>{renderResultsList(true)}</Box>
              </Stack>
            ) : (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "320px minmax(280px, 420px) minmax(0, 1fr)",
                  gridTemplateRows: "auto minmax(0, 1fr)",
                  gap: 3,
                  flex: 1,
                  minHeight: 0,
                  overflow: "hidden"
                }}
              >
                <Box
                  sx={{
                    gridRow: "1 / span 2",
                    minHeight: 0,
                    overflowY: "auto",
                    pr: 2.5,
                    borderRight: "1px solid",
                    borderColor: "divider"
                  }}
                >
                  <SearchFiltersSidebar
                    options={options}
                    draftState={draftState}
                    onDraftStateChange={handleSidebarDraftStateChange}
                    status={status}
                    onApply={handleSearchSubmit}
                    onReset={handleReset}
                    autoApply
                    showApplyButton={false}
                  />
                </Box>
                <Box sx={{ gridColumn: "2 / 4" }}>{renderSearchBar(false)}</Box>
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
            )}
          </Stack>
        )}
      </AppSidebarShell>

      <Dialog fullScreen open={isFiltersOpen} onClose={() => setIsFiltersOpen(false)}>
        <DialogContent sx={{ px: 3, py: 3 }}>
          <Stack spacing={2.5} sx={{ minHeight: "100%" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h5">{t("filters.title")}</Typography>
              <Button onClick={() => setIsFiltersOpen(false)}>{t("actions.cancel")}</Button>
            </Stack>
            <Box sx={{ minHeight: 0, overflowY: "auto", pb: 2 }}>
              <SearchFiltersSidebar
                options={options}
                draftState={draftState}
                onDraftStateChange={handleSidebarDraftStateChange}
                status={status}
                onApply={async () => {
                  await handleSearchSubmit();
                  setIsFiltersOpen(false);
                }}
                onReset={async () => {
                  await handleReset();
                  setIsFiltersOpen(false);
                }}
              />
            </Box>
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog fullScreen open={isDetailOpen} onClose={() => setIsDetailOpen(false)}>
        <DialogContent sx={{ px: 3, py: 3 }}>
          <Stack spacing={2.5} sx={{ minHeight: "100%" }}>
            <Box sx={{ minHeight: 0, overflowY: "auto" }}>
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
