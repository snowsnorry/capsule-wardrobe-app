import { useMemo } from "react";
import type { ReactNode } from "react";
import { translateOption } from "../../i18n";
import { getFacetLabel } from "../../search/searchState";
import type {
  SearchDraftState,
  SearchFilterValue,
  SearchOptions,
} from "../../search/searchState";
import {
  BAR_CHART_DIMENSION_KEYS,
  CHART_DIMENSIONS,
  PriceLineChart,
  StatisticsBarChart,
  StatisticsDonutChart,
  getColorChartFillConfig,
  getStatisticsFacetFillConfig,
} from "./StatisticsCharts";
import type { StatisticsState } from "./statisticsTypes";

type Translate = (key: string, params?: Record<string, unknown>) => string;

function buildDimensionChartCard({
  dimension,
  draftState,
  locale,
  options,
  rows,
  t,
  onToggleFacetValue,
}: {
  dimension: (typeof CHART_DIMENSIONS)[number];
  draftState: SearchDraftState;
  locale: string;
  options: SearchOptions;
  rows: StatisticsState["stats"][string];
  t: Translate;
  onToggleFacetValue: (
    fieldKey: keyof SearchDraftState,
    value: SearchFilterValue,
  ) => Promise<void>;
}) {
  const activeValues =
    (draftState[dimension.key as keyof SearchDraftState] as
      | string[]
      | undefined) || [];
  const formatLabel = (value: string) =>
    getFacetLabel({
      value,
      optionGroup: dimension.optionGroup,
      options,
      locale,
      translateOption,
    });
  const commonProps = {
    title: t(dimension.titleKey),
    subtitle: t("statistics.chartHint"),
    rows,
    activeValues,
    onToggleValue: (value: string) =>
      onToggleFacetValue(dimension.key as keyof SearchDraftState, value),
    formatLabel,
    locale,
  };

  return BAR_CHART_DIMENSION_KEYS.has(dimension.key) ? (
    <StatisticsBarChart
      key={dimension.key}
      {...commonProps}
      getFillConfig={(_value, index) => getStatisticsFacetFillConfig(index)}
    />
  ) : (
    <StatisticsDonutChart key={dimension.key} {...commonProps} />
  );
}

function buildColorChartCard({
  colorRows,
  draftState,
  locale,
  options,
  t,
  onToggleFacetValue,
}: {
  colorRows: StatisticsState["stats"][string];
  draftState: SearchDraftState;
  locale: string;
  options: SearchOptions;
  t: Translate;
  onToggleFacetValue: (
    fieldKey: keyof SearchDraftState,
    value: SearchFilterValue,
  ) => Promise<void>;
}) {
  return (
    <StatisticsBarChart
      key="color"
      title={t("profile.accentColorTitle")}
      subtitle={t("statistics.chartHint")}
      rows={colorRows}
      activeValues={draftState.color || []}
      onToggleValue={(value) => onToggleFacetValue("color", value)}
      formatLabel={(value) =>
        getFacetLabel({
          value,
          optionGroup: "accentColors",
          options,
          locale,
          translateOption,
        })
      }
      getFillConfig={(value) => getColorChartFillConfig(value)}
      locale={locale}
    />
  );
}

export function useStatisticsChartCards({
  draftState,
  locale,
  options,
  statsState,
  t,
  onToggleFacetValue,
}: {
  draftState: SearchDraftState;
  locale: string;
  options: SearchOptions;
  statsState: StatisticsState;
  t: Translate;
  onToggleFacetValue: (
    fieldKey: keyof SearchDraftState,
    value: SearchFilterValue,
  ) => Promise<void>;
}): ReactNode[] {
  return useMemo(() => {
    const cards = CHART_DIMENSIONS.map((dimension) => {
      const rows = Array.isArray(statsState.stats[dimension.key])
        ? statsState.stats[dimension.key]
        : [];
      return rows.length > 0
        ? buildDimensionChartCard({
            dimension,
            draftState,
            locale,
            options,
            rows,
            t,
            onToggleFacetValue,
          })
        : null;
    }).filter(Boolean);

    if (statsState.priceBuckets.length > 0) {
      cards.unshift(
        <PriceLineChart
          key="price"
          title={t("search.filters.price")}
          buckets={statsState.priceBuckets}
          locale={locale}
        />,
      );
    }

    const colorRows = Array.isArray(statsState.stats.color)
      ? statsState.stats.color
      : [];
    if (colorRows.length > 0) {
      cards.splice(
        1,
        0,
        buildColorChartCard({
          colorRows,
          draftState,
          locale,
          options,
          t,
          onToggleFacetValue,
        }),
      );
    }

    return cards;
  }, [
    draftState,
    locale,
    onToggleFacetValue,
    options,
    statsState.priceBuckets,
    statsState.stats,
    t,
  ]);
}
