import { useEffect, useMemo, useRef, useState } from "react";
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
  Slider,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ClearRoundedIcon from "@mui/icons-material/ClearRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { fetchSavedSearch, fetchSearchOptions, runSearch } from "../api/search.js";
import { useI18n } from "../i18n/useI18n.js";
import { translateOption } from "../i18n/index.js";
import AppLauncher from "../components/AppLauncher.jsx";
import LocaleSwitcher from "../components/LocaleSwitcher.jsx";
import AccentColorChips from "../components/AccentColorChips.jsx";
import { buildProductDetailGroups } from "../../../shared/productDetail.js";
import { getSafeHttpUrl } from "../../../shared/urlSecurity.js";

const INITIAL_SEARCH_STATE = Object.freeze({
  query: "",
  brand: [],
  priceMin: null,
  priceMax: null,
  audience: [],
  category: [],
  season: [],
  formalityLevel: [],
  style: [],
  occasions: [],
  color: [],
  pattern: [],
  silhouette: [],
  fit: [],
  closureType: [],
  page: 1
});

const EMPTY_OPTIONS = Object.freeze({
  brands: [],
  categories: [],
  seasons: [],
  formalityLevels: [],
  styles: [],
  occasions: [],
  audience: [],
  colors: [],
  patterns: [],
  silhouettes: [],
  fits: [],
  closureTypes: [],
  priceRange: { min: null, max: null }
});

const COLOR_SWATCH_STYLES = {
  black: { bgcolor: "#1f2933" },
  white: { bgcolor: "#f8f5ef" },
  grey: { bgcolor: "#94a3b8" },
  beige: { bgcolor: "#d6c1a3" },
  brown: { bgcolor: "#8b5e3c" },
  blue: { bgcolor: "#4f83cc" },
  navy: { bgcolor: "#243b6b" },
  green: { bgcolor: "#4d8b55" },
  khaki: { bgcolor: "#8a7f45" },
  red: { bgcolor: "#c84c4c" },
  burgundy: { bgcolor: "#7a1f3d" },
  pink: { bgcolor: "#d88aa6" },
  yellow: { bgcolor: "#d9b43b" },
  purple: { bgcolor: "#8a5fbf" },
  orange: { bgcolor: "#d97a2b" },
  denim: { bgcolor: "#5a78a8" },
  metallic: {
    background: "linear-gradient(135deg, #f3f4f6 0%, #cbd5e1 35%, #94a3b8 55%, #e5e7eb 100%)"
  },
  multicolor: {
    background: "linear-gradient(135deg, #ff6b6b 0%, #ffd166 25%, #06d6a0 50%, #4f83cc 75%, #b5179e 100%)"
  }
};

function createSearchState(savedSearch, priceRange) {
  const base = { ...INITIAL_SEARCH_STATE, ...(savedSearch || {}) };
  const hasPriceBounds = base.priceMin !== null || base.priceMax !== null;
  return {
    ...base,
    brand: Array.isArray(base.brand) ? base.brand : (base.brand ? [base.brand] : []),
    audience: Array.isArray(base.audience) ? base.audience : (base.audience ? [base.audience] : []),
    category: Array.isArray(base.category) ? base.category : (base.category ? [base.category] : []),
    formalityLevel: Array.isArray(base.formalityLevel) ? base.formalityLevel : (base.formalityLevel ? [base.formalityLevel] : []),
    style: Array.isArray(base.style) ? base.style : (base.style ? [base.style] : []),
    color: Array.isArray(base.color) ? base.color : (base.color ? [base.color] : []),
    pattern: Array.isArray(base.pattern) ? base.pattern : (base.pattern ? [base.pattern] : []),
    silhouette: Array.isArray(base.silhouette) ? base.silhouette : (base.silhouette ? [base.silhouette] : []),
    fit: Array.isArray(base.fit) ? base.fit : (base.fit ? [base.fit] : []),
    closureType: Array.isArray(base.closureType) ? base.closureType : (base.closureType ? [base.closureType] : []),
    priceEnabled: hasPriceBounds,
    priceMinDraft: hasPriceBounds
      ? base.priceMin ?? priceRange.min ?? 0
      : priceRange.min ?? 0,
    priceMaxDraft: hasPriceBounds
      ? base.priceMax ?? priceRange.max ?? 0
      : priceRange.max ?? 0
  };
}

function clampPriceValue(value, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return min;
  }
  return Math.min(Math.max(parsed, min), max);
}

function serializeDraftState(state) {
  return {
    query: state.query,
    brand: state.brand,
    priceMin: state.priceEnabled ? state.priceMinDraft : null,
    priceMax: state.priceEnabled ? state.priceMaxDraft : null,
    audience: state.audience,
    category: state.category,
    season: state.season,
    formalityLevel: state.formalityLevel,
    style: state.style,
    occasions: state.occasions,
    color: state.color,
    pattern: state.pattern,
    silhouette: state.silhouette,
    fit: state.fit,
    closureType: state.closureType,
    page: state.page
  };
}

function toggleSelection(value, selected) {
  return selected.includes(value)
    ? selected.filter((item) => item !== value)
    : [...selected, value];
}

function normalizeBrandOption(item) {
  if (typeof item === "string") {
    return { value: item, label: item };
  }

  if (item && typeof item.value === "string") {
    return {
      value: item.value,
      label: typeof item.label === "string" && item.label.trim() ? item.label : item.value
    };
  }

  return null;
}

function SearchSection({ title, hint, children }) {
  return (
    <Stack spacing={1.3}>
      <Typography variant="h6">{title}</Typography>
      {hint ? (
        <Typography variant="body2" color="text.secondary">
          {hint}
        </Typography>
      ) : null}
      {children}
    </Stack>
  );
}

function SingleSelectChips({ items, value, onChange, defaultLabel }) {
  return (
    <Stack direction="row" flexWrap="wrap" gap={1}>
      <Chip
        label={defaultLabel}
        clickable
        color={value === null ? "primary" : "default"}
        onClick={() => onChange(null)}
      />
      {items.map((item) => (
        <Chip
          key={String(item.value)}
          label={item.label}
          clickable
          color={value === item.value ? "primary" : "default"}
          onClick={() => onChange(item.value)}
        />
      ))}
    </Stack>
  );
}

function MultiSelectChips({ items, values, onToggle, defaultLabel }) {
  return (
    <Stack direction="row" flexWrap="wrap" gap={1}>
      {defaultLabel ? (
        <Chip
          label={defaultLabel}
          clickable
          color={values.length === 0 ? "primary" : "default"}
          onClick={() => onToggle(null)}
        />
      ) : null}
      {items.map((item) => (
        <Chip
          key={item.value}
          label={item.label}
          clickable
          color={values.includes(item.value) ? "primary" : "default"}
          onClick={() => onToggle(item.value)}
        />
      ))}
    </Stack>
  );
}

function ProductDetail({ item, title, t, locale, mobileBackAction = null }) {
  const detailGroups = buildProductDetailGroups(item, { t, translateOption, locale });
  const productUrl = getSafeHttpUrl(item?.url);
  const imageUrl = getSafeHttpUrl(item?.imageUrl);

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
                  {item.name || t("search.untitled")}
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
                                  ...COLOR_SWATCH_STYLES[value.key]
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

function SearchFiltersSidebar({
  options,
  draftState,
  onDraftStateChange,
  status,
  onApply,
  onReset,
  autoApply = false,
  showApplyButton = true
}) {
  const { t, locale } = useI18n();
  const brandItems = options.brands.map(normalizeBrandOption).filter(Boolean);
  const categoryItems = options.categories.map((item) => ({
    value: item,
    label: translateOption("categories", item, locale)
  }));
  const seasonItems = options.seasons.map((item) => ({
    value: item,
    label: translateOption("seasons", item, locale)
  }));
  const audienceItems = options.audience.map((item) => ({
    value: item,
    label: translateOption("audience", item, locale)
  })).filter((item) => item.value !== "any");
  const occasionItems = options.occasions.map((item) => ({
    value: item,
    label: translateOption("occasions", item, locale)
  }));
  const patternItems = options.patterns.map((item) => ({
    value: item,
    label: translateOption("patterns", item, locale)
  }));
  const silhouetteItems = options.silhouettes.map((item) => ({
    value: item,
    label: translateOption("silhouettes", item, locale)
  }));
  const fitItems = options.fits.map((item) => ({
    value: item,
    label: translateOption("fits", item, locale)
  }));
  const closureTypeItems = options.closureTypes.map((item) => ({
    value: item,
    label: translateOption("closureTypes", item, locale)
  }));

  const sliderMin = options.priceRange.min ?? 0;
  const sliderMax = options.priceRange.max ?? 1000;
  const priceRange = [
    clampPriceValue(draftState.priceMinDraft, sliderMin, sliderMax),
    clampPriceValue(draftState.priceMaxDraft, sliderMin, sliderMax)
  ];

  const updateDraftState = (updater, { submit = autoApply } = {}) => {
    onDraftStateChange(updater, { submit });
  };

  const handlePriceSliderChange = (_, nextValue) => {
    if (!Array.isArray(nextValue)) {
      return;
    }
    updateDraftState((current) => ({
      ...current,
      priceEnabled: true,
      priceMinDraft: nextValue[0],
      priceMaxDraft: nextValue[1],
      page: 1
    }), { submit: false });
  };

  const handlePriceSliderCommit = (_, nextValue) => {
    if (!Array.isArray(nextValue)) {
      return;
    }
    updateDraftState((current) => ({
      ...current,
      priceEnabled: true,
      priceMinDraft: nextValue[0],
      priceMaxDraft: nextValue[1],
      page: 1
    }));
  };

  const handlePriceInputChange = (field) => (event) => {
    const rawValue = event.target.value;
    updateDraftState((current) => {
      const nextState = {
        ...current,
        priceEnabled: true,
        [field]: rawValue,
        page: 1
      };
      return nextState;
    }, { submit: false });
  };

  const handlePriceInputBlur = (field) => () => {
    updateDraftState((current) => {
      const currentMin = clampPriceValue(current.priceMinDraft, sliderMin, sliderMax);
      const currentMax = clampPriceValue(current.priceMaxDraft, sliderMin, sliderMax);
      let nextMin = currentMin;
      let nextMax = currentMax;

      if (field === "priceMinDraft") {
        nextMin = clampPriceValue(current.priceMinDraft, sliderMin, sliderMax);
        nextMin = Math.min(nextMin, currentMax);
      }

      if (field === "priceMaxDraft") {
        nextMax = clampPriceValue(current.priceMaxDraft, sliderMin, sliderMax);
        nextMax = Math.max(nextMax, currentMin);
      }

      if (field !== "priceMinDraft" && nextMin > nextMax) {
        nextMin = nextMax;
      }

      if (field !== "priceMaxDraft" && nextMax < nextMin) {
        nextMax = nextMin;
      }

      return {
        ...current,
        priceEnabled: true,
        priceMinDraft: nextMin,
        priceMaxDraft: nextMax,
        page: 1
      };
    });
  };

  const handlePriceInputKeyDown = (field) => (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    handlePriceInputBlur(field)();
  };

  return (
    <Stack spacing={3.2} sx={{ minHeight: 0 }}>
      <SearchSection title={t("search.filters.brand")}>
        <MultiSelectChips
          items={brandItems}
          values={draftState.brand}
          defaultLabel={t("search.all")}
          onToggle={(brand) => updateDraftState((current) => ({
            ...current,
            brand: brand === null ? [] : toggleSelection(brand, current.brand),
            page: 1
          }))}
        />
      </SearchSection>

      <SearchSection title={t("search.filters.price")}>
        <Stack spacing={1.5}>
          <Box sx={{ px: 1.75, overflow: "visible" }}>
            <Slider
              value={priceRange}
              min={sliderMin}
              max={sliderMax}
              step={1}
              onChange={handlePriceSliderChange}
              onChangeCommitted={handlePriceSliderCommit}
              valueLabelDisplay="auto"
              sx={{
                width: "100%",
                display: "block"
              }}
            />
          </Box>
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <TextField
              fullWidth
              size="small"
              label={t("search.filters.min")}
              value={draftState.priceMinDraft}
              onChange={handlePriceInputChange("priceMinDraft")}
              onBlur={handlePriceInputBlur("priceMinDraft")}
              onKeyDown={handlePriceInputKeyDown("priceMinDraft")}
              inputProps={{
                inputMode: "numeric",
                pattern: "[0-9]*",
                min: sliderMin,
                max: sliderMax
              }}
            />
            <TextField
              fullWidth
              size="small"
              label={t("search.filters.max")}
              value={draftState.priceMaxDraft}
              onChange={handlePriceInputChange("priceMaxDraft")}
              onBlur={handlePriceInputBlur("priceMaxDraft")}
              onKeyDown={handlePriceInputKeyDown("priceMaxDraft")}
              inputProps={{
                inputMode: "numeric",
                pattern: "[0-9]*",
                min: sliderMin,
                max: sliderMax
              }}
            />
            <Button
              variant="outlined"
              color="inherit"
              onClick={() =>
                updateDraftState((current) => ({
                  ...current,
                  priceEnabled: true,
                  priceMinDraft: sliderMin,
                  priceMaxDraft: sliderMax,
                  page: 1
                }))
              }
              sx={{ minWidth: "auto", px: 2, height: 40 }}
            >
              {t("filters.reset")}
            </Button>
          </Stack>
        </Stack>
      </SearchSection>

      <SearchSection title={t("profile.audienceTitle")}>
        <MultiSelectChips
          items={audienceItems}
          values={draftState.audience}
          defaultLabel={t("search.notImportant")}
          onToggle={(audience) => updateDraftState((current) => ({
            ...current,
            audience: audience === null ? [] : toggleSelection(audience, current.audience),
            page: 1
          }))}
        />
      </SearchSection>

      <SearchSection title={t("search.filters.category")}>
        <MultiSelectChips
          items={categoryItems}
          values={draftState.category}
          defaultLabel={t("search.all")}
          onToggle={(category) => updateDraftState((current) => ({
            ...current,
            category: category === null ? [] : toggleSelection(category, current.category),
            page: 1
          }))}
        />
      </SearchSection>

      <SearchSection title={t("profile.seasonsTitle")}>
        <MultiSelectChips
          items={seasonItems}
          values={draftState.season}
          defaultLabel={t("search.all")}
          onToggle={(season) => updateDraftState((current) => ({
            ...current,
            season: season === null ? [] : toggleSelection(season, current.season),
            page: 1
          }))}
        />
      </SearchSection>

      <SearchSection title={t("profile.stylesTitle")}>
        <Stack spacing={1.5}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {t("search.fields.formalityLevel")}
          </Typography>
          <MultiSelectChips
            items={options.formalityLevels.map((item) => ({
              value: item,
              label: translateOption("styles", item, locale)
            }))}
            values={draftState.formalityLevel}
            defaultLabel={t("search.notImportant")}
            onToggle={(formalityLevel) => updateDraftState((current) => ({
              ...current,
              formalityLevel: formalityLevel === null ? [] : toggleSelection(formalityLevel, current.formalityLevel),
              page: 1
            }))}
          />
        </Stack>
        <Stack spacing={1.5}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {t("search.fields.style")}
          </Typography>
          <MultiSelectChips
            items={options.styles.map((item) => ({
              value: item,
              label: translateOption("styles", item, locale)
            }))}
            values={draftState.style}
            defaultLabel={t("search.notImportant")}
            onToggle={(style) => updateDraftState((current) => ({
              ...current,
              style: style === null ? [] : toggleSelection(style, current.style),
              page: 1
            }))}
          />
        </Stack>
      </SearchSection>

      <SearchSection title={t("profile.occasionsTitle")}>
        <MultiSelectChips
          items={occasionItems}
          values={draftState.occasions}
          defaultLabel={t("search.notImportant")}
          onToggle={(occasion) => updateDraftState((current) => ({
            ...current,
            occasions: occasion === null ? [] : toggleSelection(occasion, current.occasions),
            page: 1
          }))}
        />
      </SearchSection>

      <SearchSection title={t("profile.accentColorTitle")}>
        <AccentColorChips
          options={options.colors}
          selectedValues={draftState.color}
          onToggle={(color) => updateDraftState((current) => ({
            ...current,
            color: color === null ? [] : toggleSelection(color, current.color),
            page: 1
          }))}
        />
      </SearchSection>

      <SearchSection title={t("profile.patternTitle")}>
        <MultiSelectChips
          items={patternItems}
          values={draftState.pattern}
          defaultLabel={t("search.notImportant")}
          onToggle={(pattern) => updateDraftState((current) => ({
            ...current,
            pattern: pattern === null ? [] : toggleSelection(pattern, current.pattern),
            page: 1
          }))}
        />
      </SearchSection>

      <SearchSection title={t("search.filters.silhouette")}>
        <MultiSelectChips
          items={silhouetteItems}
          values={draftState.silhouette}
          defaultLabel={t("search.notImportant")}
          onToggle={(silhouette) => updateDraftState((current) => ({
            ...current,
            silhouette: silhouette === null ? [] : toggleSelection(silhouette, current.silhouette),
            page: 1
          }))}
        />
      </SearchSection>

      <SearchSection title={t("search.filters.fit")}>
        <MultiSelectChips
          items={fitItems}
          values={draftState.fit}
          defaultLabel={t("search.notImportant")}
          onToggle={(fit) => updateDraftState((current) => ({
            ...current,
            fit: fit === null ? [] : toggleSelection(fit, current.fit),
            page: 1
          }))}
        />
      </SearchSection>

      <SearchSection title={t("search.filters.closureType")}>
        <MultiSelectChips
          items={closureTypeItems}
          values={draftState.closureType}
          defaultLabel={t("search.notImportant")}
          onToggle={(closureType) => updateDraftState((current) => ({
            ...current,
            closureType: closureType === null ? [] : toggleSelection(closureType, current.closureType),
            page: 1
          }))}
        />
      </SearchSection>

      <Stack direction="row" spacing={1.5}>
        {showApplyButton ? (
          <Button variant="contained" onClick={onApply} disabled={status.loading}>
            {t("filters.apply")}
          </Button>
        ) : null}
        <Button variant="outlined" color="inherit" onClick={onReset} disabled={status.loading}>
          {t("filters.reset")}
        </Button>
      </Stack>
      {status.error ? (
        <Typography variant="body2" color="error">
          {status.error}
        </Typography>
      ) : null}
    </Stack>
  );
}

function SearchScreen({ onNavigateApp }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("lg"));
  const { t, locale } = useI18n();
  const [options, setOptions] = useState(EMPTY_OPTIONS);
  const [draftState, setDraftState] = useState(createSearchState(null, EMPTY_OPTIONS.priceRange));
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
        const nextOptions = {
          brands: optionsResponse.brands || [],
          categories: optionsResponse.categories || [],
          seasons: optionsResponse.seasons || [],
          formalityLevels: optionsResponse.formalityLevels || [],
          styles: optionsResponse.styles || [],
          occasions: optionsResponse.occasions || [],
          audience: optionsResponse.audience || [],
          colors: optionsResponse.colors || [],
          patterns: optionsResponse.patterns || [],
          silhouettes: optionsResponse.silhouettes || [],
          fits: optionsResponse.fits || [],
          closureTypes: optionsResponse.closureTypes || [],
          priceRange: optionsResponse.priceRange || { min: null, max: null }
        };
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

  const header = (
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
        <Stack direction="row" alignItems="center" spacing={1.5}>
          {!isMobile ? (
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
  );

  const searchBar = (
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

  const resultsList = (
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
              outline: "none"
              ,
              "&:hover": {
                backgroundColor: "rgba(31, 41, 51, 0.035)"
              }
            }}
          >
            <Typography variant="body1" sx={{ fontWeight: 700 }}>
              {item.name || t("search.untitled")}
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
        {header}
        {isMobile ? (
          <Stack spacing={2} sx={{ minHeight: 0, overflow: "hidden" }}>
            {searchBar}
            <Divider />
            <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>{resultsList}</Box>
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
            <Box sx={{ gridColumn: "2 / 4" }}>{searchBar}</Box>
            <Box sx={{ minHeight: 0, overflow: "hidden" }}>{resultsList}</Box>
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
