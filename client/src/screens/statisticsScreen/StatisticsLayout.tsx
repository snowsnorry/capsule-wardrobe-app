import type { ReactNode } from "react";
import {
  Box,
  Dialog,
  DialogContent,
  Divider,
  IconButton,
  Skeleton,
  Stack,
  Typography
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import SearchFiltersSidebar from "../../search/SearchFiltersSidebar";
import type { SearchDraftState, SearchOptions } from "../../search/searchState";
import type { StatisticsStatus } from "./statisticsTypes";

type FiltersProps = {
  title: string;
  options: SearchOptions;
  draftState: SearchDraftState;
  status: StatisticsStatus;
  onDraftStateChange: SearchFiltersSidebarProps["onDraftStateChange"];
  onApply: () => Promise<void>;
  onReset: () => Promise<void>;
};

type SearchFiltersSidebarProps = Parameters<typeof SearchFiltersSidebar>[0];

function FiltersHeader({
  title,
  closeLabel,
  onClose
}: {
  title: string;
  closeLabel?: string;
  onClose?: () => void;
}) {
  return (
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
  onReset
}: FiltersProps) {
  return (
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
  emptyLabel
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
        <Typography variant="body2" color="text.secondary">{emptyLabel}</Typography>
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
          alignItems: "stretch"
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
  emptyLabel
}: {
  openFiltersLabel: string;
  onOpenFilters: () => void;
  summary: ReactNode;
  chartCards: ReactNode[];
  status: StatisticsStatus;
  emptyLabel: string;
}) {
  return (
    <Stack spacing={2} sx={{ minHeight: 0, overflowY: "auto", px: 2, pb: 2 }}>
      <Stack direction="row" justifyContent="flex-start">
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
  emptyLabel
}: FiltersProps & {
  summary: ReactNode;
  chartCards: ReactNode[];
  emptyLabel: string;
}) {
  return (
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
      <StatisticsFiltersPanel
        title={title}
        options={options}
        draftState={draftState}
        onDraftStateChange={onDraftStateChange}
        status={status}
        onApply={onApply}
        onReset={onReset}
      />
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
        <StatisticsChartsPanel
          summary={summary}
          chartCards={chartCards}
          status={status}
          emptyLabel={emptyLabel}
        />
      </Stack>
    </Box>
  );
}

export function StatisticsFiltersDialog({
  open,
  title,
  closeLabel,
  options,
  draftState,
  status,
  onDraftStateChange,
  onApply,
  onReset,
  onClose
}: FiltersProps & {
  open: boolean;
  closeLabel: string;
  onClose: () => void;
}) {
  return (
    <Dialog
      fullScreen
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { overflowX: "hidden" } }}
    >
      <DialogContent sx={{ width: "100%", boxSizing: "border-box", overflowX: "hidden", px: 3, py: 3 }}>
        <Stack spacing={2.5} sx={{ minHeight: "100%", width: "100%", maxWidth: "100%" }}>
          <FiltersHeader title={title} closeLabel={closeLabel} onClose={onClose} />
          <Box sx={{ minHeight: 0, maxWidth: "100%", overflowX: "hidden", overflowY: "auto", pb: 2 }}>
            <SearchFiltersSidebar
              options={options}
              draftState={draftState}
              onDraftStateChange={onDraftStateChange}
              status={status}
              onApply={onApply}
              onReset={onReset}
              autoApply
            />
          </Box>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
