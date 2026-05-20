import type { ReactNode } from "react";
import { Box, Chip, CircularProgress, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import type { ActiveFilterChip } from "../../search/searchState";

export function StatisticsCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === "dark";
  const cardBackground = isDarkMode
    ? theme.palette.background.paper
    : "var(--cw-color-product-detail-wash)";

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
        borderRadius: "var(--cw-radius-card)",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: cardBackground,
        color: "text.primary",
      }}
    >
      <Box>
        <Typography variant="h6" sx={{ color: "text.primary" }}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        ) : null}
      </Box>
      {children}
    </Stack>
  );
}

function SummaryMetric({
  title,
  subtitle,
  totalLabel,
  isLoading,
}: {
  title: string;
  subtitle: string;
  totalLabel: string;
  isLoading: boolean;
}) {
  return (
    <Stack spacing={1.2} sx={{ minWidth: 0, flexShrink: 0 }}>
      <Typography
        variant="body2"
        sx={{
          textTransform: "uppercase",
          fontWeight: 650,
          color: "text.secondary",
        }}
      >
        {title}
      </Typography>
      <Stack direction="row" alignItems="center" spacing={1.2}>
        <Typography
          variant="h2"
          sx={{
            lineHeight: 1,
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "text.primary",
            fontVariantNumeric: "tabular-nums",
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
          pr: { lg: 2 },
          color: "text.secondary",
        }}
      >
        {subtitle}
      </Typography>
    </Stack>
  );
}

function ActiveFilterChips({
  chips,
  onDeleteChip,
  activeFiltersLabel,
  noActiveFiltersLabel,
  isDarkMode,
}: {
  chips: ActiveFilterChip[];
  onDeleteChip: (chip: ActiveFilterChip) => void;
  activeFiltersLabel: string;
  noActiveFiltersLabel: string;
  isDarkMode: boolean;
}) {
  const subtleChipBackground = isDarkMode
    ? "var(--cw-color-product-detail-wash)"
    : undefined;
  const subtleChipDeleteColor = isDarkMode ? "text.secondary" : undefined;

  return (
    <Stack
      spacing={1.2}
      sx={{
        minWidth: 0,
        width: "100%",
        flexShrink: 0,
        alignSelf: "stretch",
        pl: { lg: 1 },
      }}
    >
      <Typography
        variant="caption"
        sx={{
          textTransform: "uppercase",
          fontWeight: 650,
          color: "text.secondary",
        }}
      >
        {chips.length > 0 ? activeFiltersLabel : ""}
      </Typography>
      {chips.length > 0 ? (
        <Stack
          direction="row"
          flexWrap="wrap"
          gap={1}
          useFlexGap
          sx={{ alignContent: "flex-start" }}
        >
          {chips.map((chip) => (
            <Chip
              key={chip.key}
              data-testid={`active-filter-chip-${chip.field}`}
              label={chip.label}
              onDelete={() => onDeleteChip(chip)}
              sx={{
                maxWidth: "100%",
                bgcolor: subtleChipBackground,
                color: isDarkMode ? "text.primary" : undefined,
                "& .MuiChip-label": {
                  display: "block",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                },
                "& .MuiChip-deleteIcon": { color: subtleChipDeleteColor },
              }}
            />
          ))}
        </Stack>
      ) : (
        <Box sx={{ minHeight: 20, display: "flex", alignItems: "center" }}>
          <Typography variant="body2" color="text.secondary">
            {noActiveFiltersLabel}
          </Typography>
        </Box>
      )}
    </Stack>
  );
}

export function StatisticsSummaryCard({
  title,
  subtitle,
  totalLabel,
  chips,
  isLoading,
  onDeleteChip,
  activeFiltersLabel,
  noActiveFiltersLabel,
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
  const cardBackground = isDarkMode
    ? theme.palette.background.paper
    : "var(--cw-color-product-detail-strong-wash)";

  return (
    <Box
      data-testid="statistics-summary-card"
      sx={{
        p: { xs: 2.4, md: 3 },
        minHeight: { xs: 156, md: 156 },
        height: "auto",
        flexShrink: 0,
        borderRadius: "var(--cw-radius-panel)",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: cardBackground,
      }}
    >
      <Box
        sx={{
          display: { xs: "flex", lg: "grid" },
          flexDirection: { xs: "column", lg: undefined },
          gridTemplateColumns: {
            xs: "1fr",
            lg: "minmax(260px, 340px) minmax(0, 1fr)",
          },
          gap: { xs: 1.8, md: 3 },
          alignItems: "start",
        }}
      >
        <SummaryMetric
          title={title}
          subtitle={subtitle}
          totalLabel={totalLabel}
          isLoading={isLoading}
        />
        <ActiveFilterChips
          chips={chips}
          onDeleteChip={onDeleteChip}
          activeFiltersLabel={activeFiltersLabel}
          noActiveFiltersLabel={noActiveFiltersLabel}
          isDarkMode={isDarkMode}
        />
      </Box>
    </Box>
  );
}
