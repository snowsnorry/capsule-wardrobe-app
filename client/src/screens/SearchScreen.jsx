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

const INITIAL_SEARCH_STATE = Object.freeze({
  query: "",
  brand: null,
  priceMin: null,
  priceMax: null,
  audience: null,
  category: null,
  season: [],
  formalityLevel: null,
  style: null,
  occasions: [],
  color: null,
  pattern: null,
  silhouette: null,
  fit: null,
  closureType: null,
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

const COLOR_SWATCHES = {
  black: "#1f2933",
  white: "#f8f5ef",
  gray: "#94a3b8",
  beige: "#d6c1a3",
  brown: "#8b5e3c",
  blue: "#4f83cc",
  green: "#4d8b55",
  red: "#c84c4c",
  pink: "#d88aa6",
  yellow: "#d9b43b",
  purple: "#8a5fbf",
  orange: "#d97a2b"
};

function createSearchState(savedSearch, priceRange) {
  const base = { ...INITIAL_SEARCH_STATE, ...(savedSearch || {}) };
  const hasPriceBounds = base.priceMin !== null || base.priceMax !== null;
  return {
    ...base,
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

function translateComposition(value, locale) {
  if (typeof value !== "string") {
    return value;
  }

  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => translateOption("materials", part.toLowerCase(), locale))
    .join(", ");
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
  const colorValues = Array.isArray(item?.colorBase) ? item.colorBase.filter(Boolean) : [];
  const detailRows = [
    ["search.fields.price", item?.price != null ? `${item.price}${item.currency ? ` ${item.currency}` : ""}` : null],
    ["search.fields.availability", item?.availability],
    ["search.fields.audience", item?.audience ? translateOption("audience", item.audience, locale) : null],
    ["search.fields.season", Array.isArray(item?.season) ? item.season.map((value) => translateOption("seasons", value, locale)).join(", ") : null],
    ["search.fields.formalityLevel", Array.isArray(item?.formalityLevel) ? item.formalityLevel.map((value) => translateOption("styles", value, locale)).join(", ") : null],
    ["search.fields.style", Array.isArray(item?.style) ? item.style.map((value) => translateOption("styles", value, locale)).join(", ") : null],
    ["search.fields.occasions", Array.isArray(item?.occasions) ? item.occasions.map((value) => translateOption("occasions", value, locale)).join(", ") : null],
    ["search.fields.color", colorValues.length > 0 ? (
      <Stack direction="row" spacing={0.9} alignItems="center" flexWrap="wrap" useFlexGap>
        {colorValues.map((value) => (
          <Stack key={value} direction="row" spacing={0.7} alignItems="center">
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: "999px",
                bgcolor: COLOR_SWATCHES[value] || "transparent",
                border: value === "white" ? "1px solid rgba(31, 41, 51, 0.24)" : "none",
                boxSizing: "border-box",
                flexShrink: 0
              }}
            />
            <span>{translateOption("accentColors", value, locale)}</span>
          </Stack>
        ))}
      </Stack>
    ) : null],
    ["search.fields.pattern", item?.pattern ? translateOption("patterns", item.pattern, locale) : null],
    ["search.fields.finish", item?.finish],
    ["search.fields.neutral", typeof item?.isNeutral === "boolean" ? (item.isNeutral ? t("search.yes") : t("search.no")) : null],
    ["search.fields.composition", item?.composition ? translateComposition(item.composition, locale) : null],
    ["search.fields.silhouette", item?.silhouette ? translateOption("silhouettes", item.silhouette, locale) : null],
    ["search.fields.fit", item?.fit ? translateOption("fits", item.fit, locale) : null],
    ["search.fields.closureType", Array.isArray(item?.closureType) ? item.closureType.map((value) => translateOption("closureTypes", value, locale)).join(", ") : null]
  ].filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "");

  const detailGroups = [
    {
      id: "meta",
      items: detailRows.filter(([label]) => (
        label === "search.fields.price" ||
        label === "search.fields.availability" ||
        label === "search.fields.audience" ||
        label === "search.fields.season"
      ))
    },
    {
      id: "style",
      items: [
        "search.fields.formalityLevel",
        "search.fields.color",
        "search.fields.style",
        "search.fields.pattern",
        "search.fields.occasions",
        "search.fields.neutral"
      ]
        .map((targetLabel) => detailRows.find(([label]) => label === targetLabel))
        .filter(Boolean)
    },
    {
      id: "construction",
      items: detailRows.filter(([label]) => (
        label === "search.fields.composition" ||
        label === "search.fields.finish" ||
        label === "search.fields.silhouette" ||
        label === "search.fields.fit" ||
        label === "search.fields.closureType"
      ))
    }
  ].filter((group) => group.items.length > 0);

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
                component="a"
                href={item.url || "#"}
                target="_blank"
                rel="noreferrer"
                sx={{
                  color: "#8f6f45",
                  textDecoration: "none",
                  display: "block",
                  "&:hover": { textDecoration: "underline" }
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
                  {item.url ? (
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
                {group.items.map(([label, value]) => (
                  <Box key={label}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.35 }}>
                      {t(label)}
                    </Typography>
                    <Typography variant="body2" sx={{ lineHeight: 1.45 }}>
                      {value}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ))}
          </Stack>
          {item.imageUrl ? (
            <Box
              component="img"
              src={item.imageUrl}
              alt={item.name || ""}
              sx={{
                width: "100%",
                borderRadius: "22px",
                border: "1px solid rgba(31, 41, 51, 0.12)",
                objectFit: "cover",
                backgroundColor: "#f7f4ef"
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
  const brandItems = options.brands.map((item) => ({ value: item, label: item }));
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
        <SingleSelectChips
          items={brandItems}
          value={draftState.brand}
          onChange={(brand) => updateDraftState((current) => ({ ...current, brand, page: 1 }))}
          defaultLabel={t("search.notImportant")}
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
        <SingleSelectChips
          items={audienceItems}
          value={draftState.audience}
          onChange={(audience) => updateDraftState((current) => ({ ...current, audience, page: 1 }))}
          defaultLabel={t("search.notImportant")}
        />
      </SearchSection>

      <SearchSection title={t("search.filters.category")}>
        <SingleSelectChips
          items={categoryItems}
          value={draftState.category}
          onChange={(category) => updateDraftState((current) => ({ ...current, category, page: 1 }))}
          defaultLabel={t("search.all")}
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

      <SearchSection title={t("profile.stylesTitle")} hint={t("profile.stylesHint")}>
        <Stack spacing={1.5}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {t("search.fields.formalityLevel")}
          </Typography>
          <SingleSelectChips
            items={options.formalityLevels.map((item) => ({
              value: item,
              label: translateOption("styles", item, locale)
            }))}
            value={draftState.formalityLevel}
            onChange={(formalityLevel) => updateDraftState((current) => ({ ...current, formalityLevel, page: 1 }))}
            defaultLabel={t("search.notImportant")}
          />
        </Stack>
        <Stack spacing={1.5}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {t("search.fields.style")}
          </Typography>
          <SingleSelectChips
            items={options.styles.map((item) => ({
              value: item,
              label: translateOption("styles", item, locale)
            }))}
            value={draftState.style}
            onChange={(style) => updateDraftState((current) => ({ ...current, style, page: 1 }))}
            defaultLabel={t("search.notImportant")}
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
          selectedValue={draftState.color}
          onSelect={(color) => updateDraftState((current) => ({ ...current, color, page: 1 }))}
        />
      </SearchSection>

      <SearchSection title={t("profile.patternTitle")}>
        <SingleSelectChips
          items={patternItems}
          value={draftState.pattern}
          onChange={(pattern) => updateDraftState((current) => ({ ...current, pattern, page: 1 }))}
          defaultLabel={t("search.notImportant")}
        />
      </SearchSection>

      <SearchSection title={t("search.filters.silhouette")}>
        <SingleSelectChips
          items={silhouetteItems}
          value={draftState.silhouette}
          onChange={(silhouette) => updateDraftState((current) => ({ ...current, silhouette, page: 1 }))}
          defaultLabel={t("search.notImportant")}
        />
      </SearchSection>

      <SearchSection title={t("search.filters.fit")}>
        <SingleSelectChips
          items={fitItems}
          value={draftState.fit}
          onChange={(fit) => updateDraftState((current) => ({ ...current, fit, page: 1 }))}
          defaultLabel={t("search.notImportant")}
        />
      </SearchSection>

      <SearchSection title={t("search.filters.closureType")}>
        <SingleSelectChips
          items={closureTypeItems}
          value={draftState.closureType}
          onChange={(closureType) => updateDraftState((current) => ({ ...current, closureType, page: 1 }))}
          defaultLabel={t("search.notImportant")}
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
                borderRight: "1px solid rgba(31, 41, 51, 0.12)"
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
