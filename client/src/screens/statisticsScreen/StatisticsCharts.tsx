import TremorBarChart from "../../components/tremor/BarChart";
import TremorDonutChart from "../../components/tremor/DonutChart";
import TremorLineChart from "../../components/tremor/LineChart";
import {
  getGradientStops,
  sanitizeSvgId,
} from "../../components/tremor/chartUtils";
import { getColorSwatchStyle } from "../../../../shared/colorSwatches.js";
import { StatisticsCard } from "./StatisticsCards";
import type { PriceBucket, StatsRow } from "./statisticsTypes";

type ColorFillConfig = {
  color: string;
  gradientId?: string;
  gradientStops?: string[];
};

export const FACET_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#FFE66D",
  "#FF9F1C",
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
  "#014F86",
];

export const BAR_CHART_DIMENSION_KEYS = new Set([
  "style",
  "pattern",
  "silhouette",
  "closureType",
]);

export const CHART_DIMENSIONS = [
  { key: "brand", titleKey: "search.filters.brand", optionGroup: "brand" },
  {
    key: "category",
    titleKey: "search.filters.category",
    optionGroup: "categories",
  },
  { key: "season", titleKey: "profile.seasonsTitle", optionGroup: "seasons" },
  {
    key: "audience",
    titleKey: "profile.audienceTitle",
    optionGroup: "audience",
  },
  {
    key: "formalityLevel",
    titleKey: "statistics.charts.formalityLevel",
    optionGroup: "styles",
  },
  { key: "style", titleKey: "statistics.charts.style", optionGroup: "styles" },
  {
    key: "occasions",
    titleKey: "profile.occasionsTitle",
    optionGroup: "occasions",
  },
  { key: "pattern", titleKey: "profile.patternTitle", optionGroup: "patterns" },
  {
    key: "silhouette",
    titleKey: "search.filters.silhouette",
    optionGroup: "silhouettes",
  },
  { key: "fit", titleKey: "search.filters.fit", optionGroup: "fits" },
  {
    key: "closureType",
    titleKey: "search.filters.closureType",
    optionGroup: "closureTypes",
  },
];

export function formatCount(locale: string, value: number) {
  return new Intl.NumberFormat(locale).format(value);
}

function formatPrice(locale: string, value: number) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function formatPriceBucketLabel(locale: string, bucket: PriceBucket) {
  return `${formatPrice(locale, Math.round(bucket.min + bucket.max) / 2)}`;
}

function summarizeFacetRows(rows: StatsRow[] = []): StatsRow[] {
  const normalizedRows = Array.isArray(rows)
    ? rows.filter((row) => row?.count > 0 && row?.value)
    : [];
  if (normalizedRows.length <= 12) {
    return normalizedRows;
  }

  const visibleRows = normalizedRows.slice(0, 12);
  const otherCount = normalizedRows
    .slice(12)
    .reduce((sum, row) => sum + Number(row.count || 0), 0);
  return [
    ...visibleRows,
    { value: "__other__", count: otherCount, isOther: true },
  ];
}

export function getColorChartFillConfig(value: string): ColorFillConfig {
  const swatchStyle = getColorSwatchStyle(value);
  if ("bgcolor" in swatchStyle) {
    return { color: swatchStyle.bgcolor };
  }

  const gradientStops =
    "background" in swatchStyle ? getGradientStops(swatchStyle.background) : [];
  if (gradientStops.length > 1) {
    const gradientId = `statistics-color-bar-${sanitizeSvgId(value)}`;
    return {
      color: `url(#${gradientId})`,
      gradientId,
      gradientStops,
    };
  }

  return { color: "#94a3b8" };
}

function buildDonutChartData({
  rows,
  activeValues,
  formatLabel,
  title,
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
    isActive: !row.isOther && activeValues.includes(row.value),
  }));
}

export function StatisticsDonutChart({
  title,
  subtitle,
  rows,
  activeValues,
  onToggleValue,
  formatLabel,
  locale,
}: {
  title: string;
  subtitle: string;
  rows: StatsRow[];
  activeValues: string[];
  onToggleValue: (value: string) => void;
  formatLabel: (value: string) => string;
  locale: string;
}) {
  const chartData = buildDonutChartData({
    rows,
    activeValues,
    formatLabel,
    title,
  });
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

export function PriceLineChart({
  title,
  subtitle,
  buckets,
  locale,
}: {
  title: string;
  subtitle?: string;
  buckets: PriceBucket[];
  locale: string;
}) {
  const chartData = buckets.map((bucket) => ({
    ...bucket,
    label: formatPriceBucketLabel(locale, bucket),
    shortLabel: `${formatPrice(locale, Math.round(bucket.min + bucket.max) / 2)}`,
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

export function StatisticsBarChart({
  title,
  subtitle,
  rows,
  activeValues,
  onToggleValue,
  formatLabel,
  locale,
  getFillConfig,
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
        isActive: activeValues.includes(row.value),
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
