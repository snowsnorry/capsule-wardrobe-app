import TremorBarChart from "../../components/tremor/BarChart";
import TremorDonutChart from "../../components/tremor/DonutChart";
import TremorLineChart from "../../components/tremor/LineChart";
import {
  getChartFallbackSwatch,
  getChartFacetRamp,
  getGradientStops,
  sanitizeSvgId,
} from "../../components/tremor/chartUtils";
import { getColorSwatchStyle } from "../../../../shared/colorSwatches.js";
import { StatisticsCard } from "./StatisticsCards";
import type { PriceBucket, StatsRow } from "./statisticsTypes";

type ColorFillConfig = {
  color: string;
  activeColor?: string;
  gradientId?: string;
  gradientStops?: string[];
};

export const STATISTICS_FACET_COLORS = getChartFacetRamp();

export const BAR_CHART_DIMENSION_KEYS = new Set([
  "style",
  "pattern",
  "silhouette",
  "closureType",
]);

const FACET_DONUT_VISIBLE_ROW_LIMIT = 20;

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
  if (normalizedRows.length <= FACET_DONUT_VISIBLE_ROW_LIMIT) {
    return normalizedRows;
  }

  const visibleRows = normalizedRows.slice(0, FACET_DONUT_VISIBLE_ROW_LIMIT);
  const otherCount = normalizedRows
    .slice(FACET_DONUT_VISIBLE_ROW_LIMIT)
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

  return { color: getChartFallbackSwatch() };
}

export function getStatisticsFacetFillConfig(index: number): ColorFillConfig {
  return STATISTICS_FACET_COLORS[index % STATISTICS_FACET_COLORS.length];
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
  return summarizedRows.map((row, index) => {
    const fillConfig = getStatisticsFacetFillConfig(index);
    return {
      ...row,
      label: formatLabel(row.value),
      rawValue: row.value,
      groupLabel: title,
      ...fillConfig,
      legendColor: fillConfig.color,
      isActive: !row.isOther && activeValues.includes(row.value),
    };
  });
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
