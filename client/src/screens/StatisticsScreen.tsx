import { useState } from "react";
import type { ReactElement } from "react";
import { Stack } from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useI18n } from "../i18n/useI18n";
import { StatisticsSummaryCard } from "./statisticsScreen/StatisticsCards";
import { formatCount } from "./statisticsScreen/StatisticsCharts";
import {
  StatisticsDesktopLayout,
  StatisticsMobileLayout,
} from "./statisticsScreen/StatisticsLayout";
import { StatisticsFiltersDialog } from "./statisticsScreen/StatisticsFiltersDialog";
import { useStatisticsChartCards } from "./statisticsScreen/useStatisticsChartCards";
import { useStatisticsStats } from "./statisticsScreen/useStatisticsStats";

type StatisticsScreenProps = {
  onNavigateApp: (
    nextApp: "capsule" | "explore" | "wardrobe" | "statistics",
  ) => void;
};

function StatisticsScreen({
  onNavigateApp: _onNavigateApp,
}: StatisticsScreenProps): ReactElement {
  const { t, locale } = useI18n();
  const isMobile = useMediaQuery("(max-width: 1279.95px)");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const statistics = useStatisticsStats({ t, locale });
  const chartCards = useStatisticsChartCards({
    draftState: statistics.draftState,
    locale,
    options: statistics.options,
    statsState: statistics.statsState,
    t,
    onToggleFacetValue: statistics.toggleFacetValue,
  });

  const summary = (
    <StatisticsSummaryCard
      title={t("statistics.total")}
      subtitle={t("statistics.totalHint")}
      totalLabel={formatCount(locale, statistics.resolvedTotal)}
      chips={statistics.activeChips}
      isLoading={statistics.status.loading}
      onDeleteChip={statistics.deleteActiveChip}
      activeFiltersLabel={t("statistics.activeFilters")}
      noActiveFiltersLabel={t("statistics.noActiveFilters")}
    />
  );

  return (
    <>
      <Stack
        spacing={2.4}
        sx={{ height: "100%", minHeight: 0, overflow: "hidden" }}
      >
        {isMobile ? (
          <StatisticsMobileLayout
            openFiltersLabel={t("filters.open")}
            onOpenFilters={() => setIsFiltersOpen(true)}
            summary={summary}
            chartCards={chartCards}
            status={statistics.status}
            emptyLabel={t("statistics.empty")}
          />
        ) : (
          <StatisticsDesktopLayout
            title={t("filters.title")}
            options={statistics.options}
            draftState={statistics.draftState}
            onDraftStateChange={statistics.updateDraftState}
            status={statistics.status}
            onApply={statistics.submit}
            onReset={statistics.reset}
            summary={summary}
            chartCards={chartCards}
            emptyLabel={t("statistics.empty")}
          />
        )}
      </Stack>

      <StatisticsFiltersDialog
        open={isFiltersOpen}
        title={t("filters.title")}
        closeLabel={t("capsule.closeFilters")}
        options={statistics.options}
        draftState={statistics.draftState}
        onDraftStateChange={statistics.updateDraftState}
        status={statistics.status}
        onApply={async () => {
          await statistics.submit();
          setIsFiltersOpen(false);
        }}
        onReset={async () => {
          await statistics.reset();
          setIsFiltersOpen(false);
        }}
        onClose={() => setIsFiltersOpen(false)}
      />
    </>
  );
}

export default StatisticsScreen;
