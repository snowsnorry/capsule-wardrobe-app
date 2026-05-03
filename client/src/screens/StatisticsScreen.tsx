import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  Divider,
  IconButton,
  Skeleton,
  Stack,
  Typography
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import { fetchSearchOptions, fetchSearchStats } from "../api/search";
import SearchFiltersSidebar from "../search/SearchFiltersSidebar";
import TremorBarChart from "../components/tremor/BarChart";
import TremorDonutChart from "../components/tremor/DonutChart";
import TremorLineChart from "../components/tremor/LineChart";
import { getGradientStops, sanitizeSvgId } from "../components/tremor/chartUtils";
import { useI18n } from "../i18n/useI18n";
import { translateOption } from "../i18n";
import {
  EMPTY_SEARCH_OPTIONS,
  buildActiveFilterChips,
  buildSearchOptionsPayload,
  createSearchState,
  getFacetLabel,
  serializeDraftState,
  toggleSelection
} from "../search/searchState";
import type { ActiveFilterChip, SearchDraftState, SearchFilterValue, SearchOptions, SerializedSearchState } from "../search/searchState";
import { getColorSwatchStyle } from "../../../shared/colorSwatches.js";

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

type ColorFillConfig = {
  color: string;
  gradientId?: string;
  gradientStops?: string[];
};

type StatisticsScreenProps = {
  onNavigateApp: (nextApp: "capsule" | "explore" | "statistics") => void;
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
        height: "auto",
        flexShrink: 0,
        borderRadius: "5.4px",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: isDarkMode ? "#000000" : "rgba(255,255,255,0.72)",
        backdropFilter: "blur(8px)"
      }}
    >
      <Box
        sx={{
          display: { xs: "flex", lg: "grid" },
          flexDirection: { xs: "column", lg: undefined },
          gridTemplateColumns: { xs: "1fr", lg: "minmax(260px, 340px) minmax(0, 1fr)" },
          gap: { xs: 1.8, md: 3 },
          alignItems: "start"
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
            flexShrink: 0,
            alignSelf: { xs: "stretch", lg: "stretch" },
            justifyContent: "flex-start",
            pl: { lg: 1 },
            pt: { xs: 0.4, lg: 0 }
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
        labelFormatter={(bucket) => String(bucket?.label || "")}
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
  onNavigateApp
}: StatisticsScreenProps): ReactElement {
  const { t, locale } = useI18n();
  const isMobile = useMediaQuery("(max-width: 1279.95px)");
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
    () => buildActiveFilterChips({ state: draftState, options, locale, t, translateOption }),
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
                value,
                optionGroup: dimension.optionGroup,
                options,
                locale,
                translateOption
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
              value,
              optionGroup: dimension.optionGroup,
              options,
              locale,
              translateOption
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
            value,
            optionGroup: "accentColors",
            options,
            locale,
            translateOption
          })}
          getFillConfig={(value) => getColorChartFillConfig(value)}
          locale={locale}
        />
      );
    }

    return cards;
  }, [draftState, locale, options, statsState.priceBuckets, statsState.stats, t]);

  const renderMobileFiltersButton = () => (
    <Stack direction="row" justifyContent="flex-start">
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
      <Stack spacing={2.4} sx={{ height: "100%", minHeight: 0, overflow: "hidden" }}>
        {isMobile ? (
          <Stack spacing={2} sx={{ minHeight: 0, overflowY: "auto", px: 2, pb: 2 }}>
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
                onApply={handleSubmit}
                onReset={handleReset}
                autoApply
                showApplyButton={false}
              />
            </Box>
            <Stack
              spacing={2.5}
              sx={{
                minHeight: 0,
                overflowY: "auto",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: "10px",
                backgroundColor: "background.paper",
                p: 3
              }}
            >
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
