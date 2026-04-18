import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  IconButton,
  Skeleton,
  Stack,
  Typography
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import { fetchSearchOptions, fetchSearchStats } from "../api/search";
import AppLauncher from "../components/AppLauncher";
import LocaleSwitcher from "../components/LocaleSwitcher";
import AppSidebarShell from "../components/AppSidebarShell";
import SearchFiltersSidebar from "../search/SearchFiltersSidebar";
import TremorBarChart from "../components/tremor/BarChart.jsx";
import TremorDonutChart from "../components/tremor/DonutChart.jsx";
import TremorLineChart from "../components/tremor/LineChart.jsx";
import { getGradientStops, sanitizeSvgId } from "../components/tremor/chartUtils.js";
import { useI18n } from "../i18n/useI18n.js";
import { translateOption } from "../i18n/index.js";
import {
  EMPTY_SEARCH_OPTIONS,
  buildSearchOptionsPayload,
  createSearchState,
  serializeDraftState,
  toggleSelection
} from "../search/searchState.js";
import type { SearchDraftState, SearchFilterValue, SearchOptions, SerializedSearchState } from "../search/searchState.js";
import { getColorSwatchStyle } from "../../../shared/colorSwatches.js";
import type { SettingsProfile, SettingsSavePayload } from "../components/SettingsDialog";

type StatisticsStatus = {
  loading: boolean;
  error: string;
};

type StatsRow = {
  value: string;
  count: number;
  isOther?: boolean;
};

type PriceBucket = {
  key: string;
  min: number;
  max: number;
  count: number;
};

type SearchStatsResponse = {
  total?: number;
  stats?: Record<string, StatsRow[]>;
  priceBuckets?: PriceBucket[];
};

type StatisticsState = {
  total: number;
  stats: Record<string, StatsRow[]>;
  priceBuckets: PriceBucket[];
};

type ActiveFilterChip = {
  key: string;
  field: keyof SearchDraftState | "price";
  values?: string[];
  value?: string;
  label: string;
};

type ColorFillConfig = {
  color: string;
  gradientId?: string;
  gradientStops?: string[];
};

type StatisticsScreenProps = {
  onNavigateApp: (nextApp: "capsule" | "search" | "statistics") => void;
  userEmail?: string;
  userName?: string;
  settingsProfile?: SettingsProfile | null;
  onSignOut?: () => void;
  onSaveSettings?: (settings: SettingsSavePayload) => Promise<void> | void;
};

const FACET_COLORS = [
  "#FF6B6B", 
  "#4ECDC4", 
  "#FFE66D", 
  "#FF9F1C", 
  // "#2EC4B6", 
  "#E71D36", 
  "#8338EC", 
  "#3A86FF", 
  "#FF006E", 
  "#8AC926", 
  "#1982C4", 
  "#F15BB5", 
  "#00B4D8", 
  "#9B5DE5", 
  "#FFB703", 
  "#38B000", 
  "#E07A5F", 
  "#5A189A", 
  "#F4A261", 
  "#014F86"  
];
const BAR_CHART_DIMENSION_KEYS = new Set(["style", "pattern", "silhouette", "closureType"]);
const CHART_DIMENSIONS = [
  { key: "brand", titleKey: "search.filters.brand", optionGroup: "brand" },
  { key: "category", titleKey: "search.filters.category", optionGroup: "categories" },
  { key: "season", titleKey: "profile.seasonsTitle", optionGroup: "seasons" },
  { key: "audience", titleKey: "profile.audienceTitle", optionGroup: "audience" },
  { key: "formalityLevel", titleKey: "statistics.charts.formalityLevel", optionGroup: "styles" },
  { key: "style", titleKey: "statistics.charts.style", optionGroup: "styles" },
  { key: "occasions", titleKey: "profile.occasionsTitle", optionGroup: "occasions" },
  { key: "pattern", titleKey: "profile.patternTitle", optionGroup: "patterns" },
  { key: "silhouette", titleKey: "search.filters.silhouette", optionGroup: "silhouettes" },
  { key: "fit", titleKey: "search.filters.fit", optionGroup: "fits" },
  { key: "closureType", titleKey: "search.filters.closureType", optionGroup: "closureTypes" }
];

function buildInitialStatsState(): StatisticsState {
  return {
    total: 0,
    stats: {},
    priceBuckets: []
  };
}

function serializeStatisticsState(state: SearchDraftState): Omit<SerializedSearchState, "query" | "page"> {
  const payload = serializeDraftState(state);
  delete payload.query;
  delete payload.page;
  return payload;
}

function formatCount(locale: string, value: number) {
  return new Intl.NumberFormat(locale).format(value);
}

function formatPrice(locale: string, value: number) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2
  }).format(value);
}

function formatPriceBucketLabel(locale: string, bucket: PriceBucket) {
  return `${formatPrice(locale, Math.round(bucket.min + bucket.max) / 2)}`;
  // return `${formatPrice(locale, bucket.min)} - ${formatPrice(locale, bucket.max)}`;
}

function resolveStatisticsTotal(statsState: StatisticsState) {
  const directTotal = Number(statsState?.total || 0);
  if (directTotal > 0) {
    return directTotal;
  }

  const priceBuckets = Array.isArray(statsState?.priceBuckets) ? statsState.priceBuckets : [];
  const bucketTotal = priceBuckets.reduce((sum, bucket) => sum + Number(bucket?.count || 0), 0);
  if (bucketTotal > 0) {
    return bucketTotal;
  }

  const statGroups = Object.values(statsState?.stats || {});
  for (const rows of statGroups) {
    if (!Array.isArray(rows) || rows.length === 0) {
      continue;
    }

    const rowTotal = rows.reduce((sum, row) => sum + Number(row?.count || 0), 0);
    if (rowTotal > 0) {
      return rowTotal;
    }
  }

  return 0;
}

function getFacetLabel({
  key,
  value,
  optionGroup,
  options,
  locale
}: {
  key: string;
  value: string;
  optionGroup: string;
  options: SearchOptions;
  locale: string;
}) {
  if (value === "__other__") {
    return "Other";
  }

  if (optionGroup === "brand") {
    const brand = options.brands.find((item) => {
      const normalizedValue = typeof item === "string" ? item : item?.value;
      return String(normalizedValue || "").trim().toLowerCase() === value;
    });
    if (typeof brand === "string") {
      return brand;
    }
    if (brand?.label) {
      return brand.label;
    }
    return value;
  }

  return translateOption(optionGroup, value, locale);
}

function summarizeFacetRows(rows: StatsRow[] = []): StatsRow[] {
  const normalizedRows = Array.isArray(rows) ? rows.filter((row) => row?.count > 0 && row?.value) : [];
  if (normalizedRows.length <= 12) {
    return normalizedRows;
  }

  const visibleRows = normalizedRows.slice(0, 12);
  const otherCount = normalizedRows.slice(12).reduce((sum, row) => sum + Number(row.count || 0), 0);
  return [...visibleRows, { value: "__other__", count: otherCount, isOther: true }];
}

function isFacetValueSelected(state: SearchDraftState, key: keyof SearchDraftState | "price", value: string) {
  if (key === "price") {
    return false;
  }
  const currentValue = state[key];
  return Array.isArray(currentValue) ? currentValue.includes(value) : currentValue === value;
}

function buildActiveFilterChips({
  state,
  options,
  locale,
  t
}: {
  state: SearchDraftState;
  options: SearchOptions;
  locale: string;
  t: (key: string, params?: Record<string, unknown>) => string;
}): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];
  const pushFacetChips = (values, title, optionGroup, fieldKey) => {
    if (!Array.isArray(values) || values.length === 0) {
      return;
    }

    const labelValues = values.map((value) => getFacetLabel({
      key: fieldKey,
      value,
      optionGroup,
      options,
      locale
    }));

    chips.push({
      key: `${fieldKey}:${values.join(",")}`,
      field: fieldKey,
      values,
      label: `${title}: ${labelValues.join(", ")}`
    });
  };

  pushFacetChips(state.brand, t("search.filters.brand"), "brand", "brand");
  pushFacetChips(state.audience, t("profile.audienceTitle"), "audience", "audience");
  pushFacetChips(state.category, t("search.filters.category"), "categories", "category");
  pushFacetChips(state.season, t("profile.seasonsTitle"), "seasons", "season");
  pushFacetChips(state.formalityLevel, t("statistics.charts.formalityLevel"), "styles", "formalityLevel");
  pushFacetChips(state.style, t("statistics.charts.style"), "styles", "style");
  pushFacetChips(state.occasions, t("profile.occasionsTitle"), "occasions", "occasions");
  pushFacetChips(state.color, t("profile.accentColorTitle"), "accentColors", "color");
  pushFacetChips(state.pattern, t("profile.patternTitle"), "patterns", "pattern");
  pushFacetChips(state.silhouette, t("search.filters.silhouette"), "silhouettes", "silhouette");
  pushFacetChips(state.fit, t("search.filters.fit"), "fits", "fit");
  pushFacetChips(state.closureType, t("search.filters.closureType"), "closureTypes", "closureType");

  if (state.priceEnabled) {
    chips.push({
      key: `price:${state.priceMinDraft}:${state.priceMaxDraft}`,
      field: "price",
      value: `${state.priceMinDraft}:${state.priceMaxDraft}`,
    label: `${t("search.filters.price")}: ${formatPrice(locale, Number(state.priceMinDraft))} - ${formatPrice(locale, Number(state.priceMaxDraft))}`
    });
  }

  return chips;
}

function StatisticsCard({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === "dark";

  return (
    <Stack
      data-testid="statistics-card"
      spacing={2}
      sx={{
        p: 2.2,
        minHeight: 0,
        minWidth: 0,
        flexShrink: 0,
        overflow: "hidden",
        borderRadius: "5.4px",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: isDarkMode ? "#000000" : "rgba(255,255,255,0.55)",
        color: isDarkMode ? "#ffffff" : "text.primary",
        backdropFilter: "blur(8px)"
      }}
    >
      <Box>
        <Typography variant="h6" sx={{ color: isDarkMode ? "#ffffff" : "text.primary" }}>{title}</Typography>
        {subtitle ? (
          <Typography variant="body2" sx={{ color: isDarkMode ? "rgba(255,255,255,0.74)" : "text.secondary" }}>
            {subtitle}
          </Typography>
        ) : null}
      </Box>
      {children}
    </Stack>
  );
}

function StatisticsSummaryCard({
  title,
  subtitle,
  totalLabel,
  chips,
  isLoading,
  onDeleteChip,
  activeFiltersLabel,
  noActiveFiltersLabel
}: {
  title: string;
  subtitle: string;
  totalLabel: string;
  chips: ActiveFilterChip[];
  isLoading: boolean;
  onDeleteChip: (chip: ActiveFilterChip) => void;
  activeFiltersLabel: string;
  noActiveFiltersLabel: string;
}) {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === "dark";

  return (
    <Box
      data-testid="statistics-summary-card"
      sx={{
        p: { xs: 2.4, md: 3 },
        minHeight: { xs: 156, md: 156 },
        borderRadius: "5.4px",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: isDarkMode ? "#000000" : "rgba(255,255,255,0.72)",
        backdropFilter: "blur(8px)"
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "minmax(260px, 340px) minmax(0, 1fr)" },
          gap: { xs: 2.25, md: 3 },
          alignItems: "start",
          height: "100%"
        }}
      >
        <Stack spacing={1.2} sx={{ minWidth: 0, flexShrink: 0 }}>
          <Typography
            variant="body2"
            sx={{
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: isDarkMode ? "rgba(255,255,255,0.68)" : "text.secondary"
            }}
          >
            {title}
          </Typography>
          <Stack direction="row" alignItems="center" spacing={1.2}>
            <Typography
              variant="h2"
              sx={{
                lineHeight: 1,
                fontSize: { xs: "1.5rem", md: "1.5rem" },
                fontWeight: 600,
                color: isDarkMode ? "#ffffff" : "text.primary"
              }}
            >
              {totalLabel}
            </Typography>
            {isLoading ? <CircularProgress size={20} /> : null}
          </Stack>
          <Typography
            variant="body2"
            sx={{
              maxWidth: 560,
              lineHeight: 1.5,
              pr: { lg: 2 },
              color: isDarkMode ? "rgba(255,255,255,0.74)" : "text.secondary"
            }}
          >
            {subtitle}
          </Typography>
        </Stack>

        <Stack
          spacing={1.2}
          sx={{
            minWidth: 0,
            width: "100%",
            alignSelf: "stretch",
            justifyContent: "flex-start",
            pl: { lg: 1 }
          }}
        >
          <Typography
            variant="caption"
            sx={{
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: isDarkMode ? "rgba(255,255,255,0.68)" : "text.secondary"
            }}
          >
            {chips.length > 0 ? activeFiltersLabel : ""}
          </Typography>
          {chips.length > 0 ? (
            <Stack direction="row" flexWrap="wrap" gap={1} useFlexGap sx={{ alignContent: "flex-start" }}>
              {chips.map((chip) => (
                <Chip
                  key={chip.key}
                  label={chip.label}
                  onDelete={() => onDeleteChip(chip)}
                  sx={{
                    maxWidth: "100%",
                    bgcolor: isDarkMode ? "rgba(255,255,255,0.08)" : undefined,
                    color: isDarkMode ? "#ffffff" : undefined,
                    "& .MuiChip-label": {
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis"
                    },
                    "& .MuiChip-deleteIcon": {
                      color: isDarkMode ? "rgba(255,255,255,0.72)" : undefined
                    }
                  }}
                />
              ))}
            </Stack>
          ) : (
            <Box
              sx={{
                minHeight: 20,
                px: 0,
                py: 0,
                display: "flex",
                alignItems: "center"
              }}
            >
              <Typography variant="body2" sx={{ color: isDarkMode ? "rgba(255,255,255,0.74)" : "text.secondary" }}>
                {noActiveFiltersLabel}
              </Typography>
            </Box>
          )}
        </Stack>
      </Box>
    </Box>
  );
}

function getColorChartFillConfig(value: string): ColorFillConfig {
  const swatchStyle = getColorSwatchStyle(value);
  if (swatchStyle?.bgcolor) {
    return { color: swatchStyle.bgcolor };
  }

  const gradientStops = getGradientStops(swatchStyle?.background);
  if (gradientStops.length > 1) {
    const gradientId = `statistics-color-bar-${sanitizeSvgId(value)}`;
    return {
      color: `url(#${gradientId})`,
      gradientId,
      gradientStops
    };
  }

  return { color: "#94a3b8" };
}

function buildDonutChartData({
  rows,
  activeValues,
  formatLabel,
  title
}: {
  rows: StatsRow[];
  activeValues: string[];
  formatLabel: (value: string) => string;
  title: string;
}) {
  const summarizedRows = summarizeFacetRows(rows);
  return summarizedRows.map((row, index) => ({
    ...row,
    label: formatLabel(row.value),
    rawValue: row.value,
    groupLabel: title,
    color: FACET_COLORS[index % FACET_COLORS.length],
    legendColor: FACET_COLORS[index % FACET_COLORS.length],
    isActive: !row.isOther && activeValues.includes(row.value)
  }));
}

function StatisticsDonutChart({
  title,
  subtitle,
  rows,
  activeValues,
  onToggleValue,
  formatLabel,
  locale
}: {
  title: string;
  subtitle: string;
  rows: StatsRow[];
  activeValues: string[];
  onToggleValue: (value: string) => void;
  formatLabel: (value: string) => string;
  locale: string;
}) {
  const chartData = buildDonutChartData({ rows, activeValues, formatLabel, title });
  return (
    <StatisticsCard title={title} subtitle={subtitle}>
      <TremorDonutChart
        data={chartData}
        category="count"
        index="label"
        className=""
        valueFormatter={(value) => formatCount(locale, value)}
        activeValues={activeValues}
        onValueChange={(row) => onToggleValue(row.rawValue)}
      />
    </StatisticsCard>
  );
}

function PriceLineChart({
  title,
  subtitle,
  buckets,
  locale
}: {
  title: string;
  subtitle?: string;
  buckets: PriceBucket[];
  locale: string;
}) {
  const chartData = buckets.map((bucket) => ({
    ...bucket,
    label: formatPriceBucketLabel(locale, bucket),
    shortLabel: `${formatPrice(locale, Math.round(bucket.min + bucket.max) / 2)}`
  }));

  return (
    <StatisticsCard title={title} subtitle={subtitle}>
      <TremorLineChart
        data={chartData}
        index="shortLabel"
        category="count"
        valueFormatter={(value) => formatCount(locale, value)}
        labelFormatter={(bucket) => bucket?.label || ""}
      />
    </StatisticsCard>
  );
}

function StatisticsBarChart({
  title,
  subtitle,
  rows,
  activeValues,
  onToggleValue,
  formatLabel,
  locale,
  getFillConfig
}: {
  title: string;
  subtitle: string;
  rows: StatsRow[];
  activeValues: string[];
  onToggleValue: (value: string) => void;
  formatLabel: (value: string) => string;
  locale: string;
  getFillConfig: (value: string, index: number) => ColorFillConfig;
}) {
  const chartData = rows
    .filter((row) => row?.count > 0 && row?.value)
    .map((row, index) => {
      const fillConfig = getFillConfig(row.value, index);
      return {
        ...row,
        label: formatLabel(row.value),
        rawValue: row.value,
        groupLabel: title,
        ...fillConfig,
        isActive: activeValues.includes(row.value)
      };
    });

  return (
    <StatisticsCard title={title} subtitle={subtitle}>
      <TremorBarChart
        data={chartData}
        category="count"
        index="label"
        valueFormatter={(value) => formatCount(locale, value)}
        activeValues={activeValues}
        onValueChange={(row) => onToggleValue(row.rawValue)}
      />
    </StatisticsCard>
  );
}

function StatisticsScreen({
  onNavigateApp,
  userEmail = "",
  userName = "",
  settingsProfile = null,
  onSignOut = () => {},
  onSaveSettings = async () => {}
}: StatisticsScreenProps): ReactElement {
  const { t, locale } = useI18n();
  const [options, setOptions] = useState<SearchOptions>(EMPTY_SEARCH_OPTIONS);
  const [draftState, setDraftState] = useState<SearchDraftState>(createSearchState(null, EMPTY_SEARCH_OPTIONS.priceRange));
  const [statsState, setStatsState] = useState<StatisticsState>(buildInitialStatsState());
  const [status, setStatus] = useState<StatisticsStatus>({ loading: true, error: "" });
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const draftStateRef = useRef(draftState);

  useEffect(() => {
    draftStateRef.current = draftState;
  }, [draftState]);

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
        const nextState = createSearchState(null, nextOptions.priceRange);
        setOptions(nextOptions);
        setDraftState(nextState);
        const result = await fetchSearchStats(serializeStatisticsState(nextState)) as SearchStatsResponse;
        if (!isActive) {
          return;
        }
        setStatsState({
          total: Number(result.total || 0),
          stats: result.stats || {},
          priceBuckets: result.priceBuckets || []
        });
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
  }, [t]);

  const performStatsRefresh = async (nextState: SearchDraftState) => {
    setStatus({ loading: true, error: "" });
    try {
      const result = await fetchSearchStats(serializeStatisticsState(nextState)) as SearchStatsResponse;
      setStatsState({
        total: Number(result.total || 0),
        stats: result.stats || {},
        priceBuckets: result.priceBuckets || []
      });
      setStatus({ loading: false, error: "" });
    } catch {
      setStatus({ loading: false, error: t("errors.generic") });
    }
  };

  const handleSubmit = async () => {
    const nextState = { ...draftStateRef.current, page: 1 };
    draftStateRef.current = nextState;
    setDraftState(nextState);
    await performStatsRefresh(nextState);
  };

  const handleReset = async () => {
    const nextState = createSearchState(null, options.priceRange);
    draftStateRef.current = nextState;
    setDraftState(nextState);
    await performStatsRefresh(nextState);
  };

  const handleSidebarDraftStateChange = async (
    updater: SearchDraftState | ((current: SearchDraftState) => SearchDraftState),
    { submit = false } = {}
  ) => {
    const nextState = typeof updater === "function" ? updater(draftStateRef.current) : updater;
    draftStateRef.current = nextState;
    setDraftState(nextState);
    if (submit) {
      await performStatsRefresh(nextState);
    }
  };

  const handleToggleFacetValue = async (fieldKey: keyof SearchDraftState, value: SearchFilterValue) => {
    await handleSidebarDraftStateChange((current) => ({
      ...current,
      [fieldKey]: toggleSelection(value, Array.isArray(current[fieldKey]) ? current[fieldKey] : []),
      page: 1
    }), { submit: true });
  };

  const activeChips = useMemo(
    () => buildActiveFilterChips({ state: draftState, options, locale, t }),
    [draftState, locale, options, t]
  );
  const resolvedTotal = useMemo(() => resolveStatisticsTotal(statsState), [statsState]);

  const chartCards = useMemo(() => {
    const cards = CHART_DIMENSIONS
      .map((dimension) => {
        const rows = Array.isArray(statsState.stats?.[dimension.key]) ? statsState.stats[dimension.key] : [];
        if (rows.length === 0) {
          return null;
        }

        if (BAR_CHART_DIMENSION_KEYS.has(dimension.key)) {
          return (
            <StatisticsBarChart
              key={dimension.key}
              title={t(dimension.titleKey)}
              subtitle={t("statistics.chartHint")}
              rows={rows}
              activeValues={(draftState[dimension.key as keyof SearchDraftState] as string[] | undefined) || []}
              onToggleValue={(value) => handleToggleFacetValue(dimension.key as keyof SearchDraftState, value)}
              formatLabel={(value) => getFacetLabel({
                key: dimension.key,
                value,
                optionGroup: dimension.optionGroup,
                options,
                locale
              })}
              getFillConfig={(_value, index) => ({ color: FACET_COLORS[index % FACET_COLORS.length] })}
              locale={locale}
            />
          );
        }

        return (
          <StatisticsDonutChart
            key={dimension.key}
            title={t(dimension.titleKey)}
            subtitle={t("statistics.chartHint")}
            rows={rows}
            activeValues={(draftState[dimension.key as keyof SearchDraftState] as string[] | undefined) || []}
            onToggleValue={(value) => handleToggleFacetValue(dimension.key as keyof SearchDraftState, value)}
            formatLabel={(value) => getFacetLabel({
              key: dimension.key,
              value,
              optionGroup: dimension.optionGroup,
              options,
              locale
            })}
            locale={locale}
          />
        );
      })
      .filter(Boolean);

    if (statsState.priceBuckets.length > 0) {
      cards.unshift(
        <PriceLineChart
          key="price"
          title={t("search.filters.price")}
          buckets={statsState.priceBuckets}
          locale={locale}
        />
      );
    }

    const colorRows = Array.isArray(statsState.stats?.color) ? statsState.stats.color : [];
    if (colorRows.length > 0) {
      cards.splice(1, 0,
        <StatisticsBarChart
          key="color"
          title={t("profile.accentColorTitle")}
          subtitle={t("statistics.chartHint")}
          rows={colorRows}
          activeValues={draftState.color || []}
          onToggleValue={(value) => handleToggleFacetValue("color", value)}
          formatLabel={(value) => getFacetLabel({
            key: "color",
            value,
            optionGroup: "accentColors",
            options,
            locale
          })}
          getFillConfig={(value) => getColorChartFillConfig(value)}
          locale={locale}
        />
      );
    }

    return cards;
  }, [draftState, locale, options, statsState.priceBuckets, statsState.stats, t]);

  const renderMobileFiltersButton = () => (
    <Stack direction="row" justifyContent="flex-end">
      <IconButton aria-label={t("filters.open")} onClick={() => setIsFiltersOpen(true)}>
        <TuneRoundedIcon />
      </IconButton>
    </Stack>
  );

  const handleDeleteActiveChip = (chip: ActiveFilterChip) => {
    if (chip.field === "price") {
      handleSidebarDraftStateChange((current) => ({
        ...current,
        priceEnabled: false,
        priceMinDraft: options.priceRange.min ?? 0,
        priceMaxDraft: options.priceRange.max ?? 0,
        page: 1
      }), { submit: true });
      return;
    }
    handleSidebarDraftStateChange((current) => ({
      ...current,
      [chip.field]: [],
      page: 1
    }), { submit: true });
  };

  const renderSummary = () => (
    <StatisticsSummaryCard
      title={t("statistics.total")}
      subtitle={t("statistics.totalHint")}
      totalLabel={formatCount(locale, resolvedTotal)}
      chips={activeChips}
      isLoading={status.loading}
      onDeleteChip={handleDeleteActiveChip}
      activeFiltersLabel={t("statistics.activeFilters")}
      noActiveFiltersLabel={t("statistics.noActiveFilters")}
    />
  );

  return (
    <>
      <AppSidebarShell
        shellTestId="statistics-screen-shell"
        currentApp="statistics"
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
                <AppLauncher currentApp="statistics" onSelectApp={onNavigateApp} />
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
              <Stack spacing={2} sx={{ minHeight: 0, overflowY: "auto", pb: 2 }}>
                {renderMobileFiltersButton()}
                {renderSummary()}
                {status.loading && chartCards.length === 0 ? (
                  <Stack spacing={2}>
                    <Skeleton variant="rounded" height={260} />
                    <Skeleton variant="rounded" height={260} />
                  </Stack>
                ) : chartCards.length > 0 ? chartCards : (
                  <Typography variant="body2" color="text.secondary">{t("statistics.empty")}</Typography>
                )}
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
                    onApply={handleSubmit}
                    onReset={handleReset}
                    autoApply
                    showApplyButton={false}
                  />
                </Box>
                <Stack spacing={2.5} sx={{ minHeight: 0, overflowY: "auto", pr: 0.5, pb: 0.5 }}>
                  {renderSummary()}
                  {status.loading && chartCards.length === 0 ? (
                    <Stack spacing={2}>
                      <Skeleton variant="rounded" height={260} />
                      <Skeleton variant="rounded" height={260} />
                    </Stack>
                  ) : chartCards.length > 0 ? (
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
                        gap: 2.25,
                        alignItems: "stretch"
                      }}
                    >
                      {chartCards}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">{t("statistics.empty")}</Typography>
                  )}
                </Stack>
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
                  await handleSubmit();
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
    </>
  );
}

export default StatisticsScreen;
