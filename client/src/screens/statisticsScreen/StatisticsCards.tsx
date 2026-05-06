import type { ReactNode } from "react";
import { Box, Chip, CircularProgress, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import type { ActiveFilterChip } from "../../search/searchState";

export function StatisticsCard({
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
  const cardBackground = isDarkMode ? theme.palette.background.paper : "rgba(252, 251, 249, 0.72)";

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
        borderRadius: "8px",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: cardBackground,
        color: "text.primary"
      }}
    >
      <Box>
        <Typography variant="h6" sx={{ color: "text.primary" }}>{title}</Typography>
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
  isLoading
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
          letterSpacing: "0.08em",
          color: "text.secondary"
        }}
      >
        {title}
      </Typography>
      <Stack direction="row" alignItems="center" spacing={1.2}>
        <Typography
          variant="h2"
          sx={{ lineHeight: 1, fontSize: { xs: "1.5rem", md: "1.5rem" }, fontWeight: 600, color: "text.primary" }}
        >
          {totalLabel}
        </Typography>
        {isLoading ? <CircularProgress size={20} /> : null}
      </Stack>
      <Typography variant="body2" sx={{ maxWidth: 560, lineHeight: 1.5, pr: { lg: 2 }, color: "text.secondary" }}>
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
  isDarkMode
}: {
  chips: ActiveFilterChip[];
  onDeleteChip: (chip: ActiveFilterChip) => void;
  activeFiltersLabel: string;
  noActiveFiltersLabel: string;
  isDarkMode: boolean;
}) {
  const subtleChipBackground = isDarkMode ? "rgba(238, 245, 243, 0.08)" : undefined;
  const subtleChipDeleteColor = isDarkMode ? "rgba(238, 245, 243, 0.68)" : undefined;

  return (
    <Stack spacing={1.2} sx={{ minWidth: 0, width: "100%", flexShrink: 0, alignSelf: "stretch", pl: { lg: 1 } }}>
      <Typography variant="caption" sx={{ textTransform: "uppercase", letterSpacing: "0.08em", color: "text.secondary" }}>
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
                bgcolor: subtleChipBackground,
                color: isDarkMode ? "text.primary" : undefined,
                "& .MuiChip-label": { display: "block", overflow: "hidden", textOverflow: "ellipsis" },
                "& .MuiChip-deleteIcon": { color: subtleChipDeleteColor }
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
  const cardBackground = isDarkMode ? theme.palette.background.paper : "rgba(252, 251, 249, 0.82)";

  return (
    <Box
      data-testid="statistics-summary-card"
      sx={{
        p: { xs: 2.4, md: 3 },
        minHeight: { xs: 156, md: 156 },
        height: "auto",
        flexShrink: 0,
        borderRadius: "10px",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: cardBackground
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
        <SummaryMetric title={title} subtitle={subtitle} totalLabel={totalLabel} isLoading={isLoading} />
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
