import type { ReactNode } from "react";
import {
  Box,
  DialogTitle,
  Divider,
  IconButton,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import { mobileCapsuleDialogTitleSx } from "../../components/MobileDialogSurfaceStyles";
import SearchFiltersSidebar from "../../search/SearchFiltersSidebar";
import type { SearchDraftState, SearchOptions } from "../../search/searchState";
import { MAIN_SCREEN_CONTENT_COLUMN_SX } from "../mainScreen/MainScreenHelpers";
import type { StatisticsStatus } from "./statisticsTypes";

export type FiltersProps = {
  title: string;
  options: SearchOptions;
  draftState: SearchDraftState;
  status: StatisticsStatus;
  onDraftStateChange: SearchFiltersSidebarProps["onDraftStateChange"];
  onApply: () => Promise<void>;
  onReset: () => Promise<void>;
};

type SearchFiltersSidebarProps = Parameters<typeof SearchFiltersSidebar>[0];

export const STATISTICS_DESKTOP_LAYOUT_SX = {
  display: "grid",
  gridTemplateColumns: { lg: "320px minmax(0, 1fr)" },
  gap: { xs: 3, lg: "40px" },
  flex: 1,
  width: "100%",
  height: "100%",
  minWidth: 0,
  minHeight: 0,
  overflow: "hidden",
  boxSizing: "border-box",
} as const;

export const STATISTICS_DESKTOP_FILTERS_SX = {
  mt: 2,
  minHeight: 0,
  alignSelf: "start",
  maxHeight: "calc(100vh - 32px)",
  overflowY: "auto",
  border: "1px solid",
  borderColor: "divider",
  borderRadius: "var(--cw-radius-panel)",
  backgroundColor: "background.paper",
  p: 3,
} as const;

export const STATISTICS_DESKTOP_MAIN_SCROLL_SX = {
  minHeight: 0,
  height: "100%",
  minWidth: 0,
  overflowY: "auto",
  boxSizing: "border-box",
} as const;

export const STATISTICS_DESKTOP_MAIN_CONTENT_SX = {
  ...MAIN_SCREEN_CONTENT_COLUMN_SX,
  minHeight: 0,
  pt: 2,
  pb: 2,
  boxSizing: "border-box",
} as const;

const STATISTICS_DESKTOP_CHARTS_STACK_SX = {
  minHeight: 0,
} as const;

export function FiltersHeader({
  title,
  closeLabel,
  mobile = false,
  onClose,
}: {
  title: string;
  closeLabel?: string;
  mobile?: boolean;
  onClose?: () => void;
}) {
  if (mobile) {
    return (
      <DialogTitle sx={mobileCapsuleDialogTitleSx}>
        <Typography
          component="span"
          variant="h6"
          sx={{ color: "text.primary" }}
        >
          {title}
        </Typography>
        {closeLabel && onClose ? (
          <IconButton aria-label={closeLabel} onClick={onClose}>
            <CloseRoundedIcon />
          </IconButton>
        ) : null}
      </DialogTitle>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h6" sx={{ color: "text.primary" }}>
          {title}
        </Typography>
        {closeLabel && onClose ? (
          <IconButton aria-label={closeLabel} onClick={onClose}>
            <CloseRoundedIcon />
          </IconButton>
        ) : null}
      </Stack>
      <Divider />
    </Stack>
  );
}

function StatisticsFiltersPanel({
  title,
  options,
  draftState,
  status,
  onDraftStateChange,
  onApply,
  onReset,
}: FiltersProps) {
  return (
    <Box sx={STATISTICS_DESKTOP_FILTERS_SX}>
      <Stack spacing={2.5} sx={{ mb: 3.5 }}>
        <FiltersHeader title={title} />
      </Stack>
      <SearchFiltersSidebar
        options={options}
        draftState={draftState}
        onDraftStateChange={onDraftStateChange}
        status={status}
        onApply={onApply}
        onReset={onReset}
        autoApply
        showApplyButton={false}
      />
    </Box>
  );
}

function StatisticsChartsPanel({
  summary,
  chartCards,
  status,
  emptyLabel,
}: {
  summary: ReactNode;
  chartCards: ReactNode[];
  status: StatisticsStatus;
  emptyLabel: string;
}) {
  if (status.loading && chartCards.length === 0) {
    return (
      <>
        {summary}
        <Stack spacing={2}>
          <Skeleton variant="rounded" height={260} />
          <Skeleton variant="rounded" height={260} />
        </Stack>
      </>
    );
  }

  if (chartCards.length === 0) {
    return (
      <>
        {summary}
        <Typography variant="body2" color="text.secondary">
          {emptyLabel}
        </Typography>
      </>
    );
  }

  return (
    <>
      {summary}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
          gap: 2.25,
          alignItems: "stretch",
        }}
      >
        {chartCards}
      </Box>
    </>
  );
}

export function StatisticsMobileLayout({
  openFiltersLabel,
  onOpenFilters,
  summary,
  chartCards,
  status,
  emptyLabel,
}: {
  openFiltersLabel: string;
  onOpenFilters: () => void;
  summary: ReactNode;
  chartCards: ReactNode[];
  status: StatisticsStatus;
  emptyLabel: string;
}) {
  return (
    <Stack
      spacing={2}
      sx={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        bgcolor: "background.default",
        px: 2,
        pb: 2,
      }}
      data-testid="statistics-mobile-body"
    >
      <Stack direction="row" justifyContent="flex-start" alignItems="center">
        <IconButton aria-label={openFiltersLabel} onClick={onOpenFilters}>
          <TuneRoundedIcon />
        </IconButton>
      </Stack>
      <StatisticsChartsPanel
        summary={summary}
        chartCards={chartCards}
        status={status}
        emptyLabel={emptyLabel}
      />
    </Stack>
  );
}

export function StatisticsDesktopLayout({
  title,
  options,
  draftState,
  status,
  onDraftStateChange,
  onApply,
  onReset,
  summary,
  chartCards,
  emptyLabel,
}: FiltersProps & {
  summary: ReactNode;
  chartCards: ReactNode[];
  emptyLabel: string;
}) {
  return (
    <Box sx={STATISTICS_DESKTOP_LAYOUT_SX}>
      <StatisticsFiltersPanel
        title={title}
        options={options}
        draftState={draftState}
        onDraftStateChange={onDraftStateChange}
        status={status}
        onApply={onApply}
        onReset={onReset}
      />
      <Box sx={STATISTICS_DESKTOP_MAIN_SCROLL_SX}>
        <Box sx={STATISTICS_DESKTOP_MAIN_CONTENT_SX}>
          <Stack spacing={2.5} sx={STATISTICS_DESKTOP_CHARTS_STACK_SX}>
            <StatisticsChartsPanel
              summary={summary}
              chartCards={chartCards}
              status={status}
              emptyLabel={emptyLabel}
            />
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
