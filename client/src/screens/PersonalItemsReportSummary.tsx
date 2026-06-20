import { Alert, Box, Chip, Stack, Typography } from "@mui/material";
import { FaTemperatureHalf } from "react-icons/fa6";
import type { PersonalItemsReport } from "../app/appTypes";
import {
  reportToneSx,
  type ReportTone,
} from "./outfitScreen/OutfitReportPanelSectionPrimitives";
import {
  formatReportValue,
  getPersonalItemsReportChipValues,
  getPersonalItemsReportScore,
  getPersonalItemsReportScoreTone,
  getPersonalItemsReportTemperatureLabel,
  getPersonalItemsReportVerdictLabel,
  type PersonalItemsReportTranslate,
} from "./PersonalItemsReportPanelUtils";

type PersonalItemsReportSummaryProps = {
  isCompact?: boolean;
  isExpanded?: boolean;
  isStale?: boolean;
  report: PersonalItemsReport;
  t: PersonalItemsReportTranslate;
};

function buildSummaryTitleSx(isCompact: boolean, tone: ReportTone) {
  return {
    color: reportToneSx[tone].color,
    fontSize: isCompact ? { xs: "1.18rem", md: "1.25rem" } : undefined,
    lineHeight: isCompact ? 1.25 : undefined,
  };
}

function buildSummaryBodySx(isCompact: boolean, clampSummary: boolean) {
  return {
    color: "text.secondary",
    display: clampSummary ? "-webkit-box" : undefined,
    lineHeight: isCompact ? 1.45 : undefined,
    overflow: clampSummary ? "hidden" : undefined,
    WebkitBoxOrient: clampSummary ? "vertical" : undefined,
    WebkitLineClamp: clampSummary ? 2 : undefined,
  };
}

function PersonalItemsReportStaleAlert({
  isCompact,
  t,
}: Pick<PersonalItemsReportSummaryProps, "isCompact" | "t">) {
  return (
    <Alert
      severity="warning"
      sx={{
        py: isCompact ? 0.25 : 0.5,
        "& .MuiAlert-message": {
          py: isCompact ? 0.25 : undefined,
        },
      }}
    >
      {t("wardrobe.reportOutdated")}
    </Alert>
  );
}

function PersonalItemsReportScoreBadge({
  isCompact,
  report,
}: Pick<PersonalItemsReportSummaryProps, "isCompact" | "report">) {
  const score = getPersonalItemsReportScore(report);
  const scoreTone = getPersonalItemsReportScoreTone(report);
  const scoreValue = score ?? 0;
  const badgeSize = isCompact ? { xs: 66, sm: 72, md: 78 } : 96;
  const ringRadius = 16;
  const ringStrokeWidth = 2.5;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringProgressOffset =
    ringCircumference * (1 - Math.min(100, Math.max(0, scoreValue)) / 100);

  return (
    <Box
      data-score-tone={scoreTone}
      data-testid="personal-items-report-score"
      data-density={isCompact ? "compact" : "default"}
      sx={{
        width: badgeSize,
        height: badgeSize,
        borderRadius: "var(--cw-radius-circle)",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        position: "relative",
        color: reportToneSx[scoreTone].color,
      }}
    >
      <Box
        component="svg"
        aria-hidden="true"
        viewBox="0 0 40 40"
        sx={{
          height: "100%",
          inset: 0,
          position: "absolute",
          width: "100%",
        }}
      >
        <circle
          cx="20"
          cy="20"
          fill="none"
          r={ringRadius}
          stroke="currentColor"
          strokeWidth={ringStrokeWidth}
          style={{ color: reportToneSx[scoreTone].ringTrackColor }}
        />
        <circle
          cx="20"
          cy="20"
          fill="none"
          r={ringRadius}
          stroke="currentColor"
          strokeDasharray={ringCircumference}
          strokeDashoffset={ringProgressOffset}
          strokeLinecap="round"
          strokeWidth={ringStrokeWidth}
          style={{
            color: reportToneSx[scoreTone].markerColor,
            transform: "rotate(-90deg)",
            transformOrigin: "50% 50%",
            transition:
              "stroke-dashoffset 220ms ease-out, color 180ms ease-out",
          }}
        />
      </Box>
      <Typography
        variant="h2"
        sx={{
          fontSize: isCompact
            ? { xs: "1.75rem", sm: "1.95rem", md: "2.1rem" }
            : "2.45rem",
          fontWeight: 550,
          lineHeight: 1,
          position: "relative",
        }}
      >
        {score ?? "-"}
      </Typography>
    </Box>
  );
}

function PersonalItemsReportSummaryCopy({
  isCompact,
  isExpanded,
  report,
  t,
}: Pick<
  PersonalItemsReportSummaryProps,
  "isCompact" | "isExpanded" | "report" | "t"
>) {
  const clampSummary = Boolean(isCompact && !isExpanded);
  const scoreTone = getPersonalItemsReportScoreTone(report);

  return (
    <Stack spacing={isCompact ? 0.25 : 0.5} sx={{ minWidth: 0 }}>
      <Typography
        data-score-tone={scoreTone}
        data-testid="personal-items-report-verdict"
        variant={isCompact ? "h6" : "h5"}
        sx={buildSummaryTitleSx(Boolean(isCompact), scoreTone)}
      >
        {getPersonalItemsReportVerdictLabel(report, t)}
      </Typography>
      <Typography
        variant="body2"
        sx={buildSummaryBodySx(Boolean(isCompact), clampSummary)}
      >
        {report.verdict?.summary || ""}
      </Typography>
    </Stack>
  );
}

function PersonalItemsReportSummaryChips({
  isCompact,
  report,
  t,
}: Pick<PersonalItemsReportSummaryProps, "isCompact" | "report" | "t">) {
  const chips = getPersonalItemsReportChipValues(report);
  const temperature = getPersonalItemsReportTemperatureLabel(report, t);
  if (!temperature && !chips.length) return null;

  const chipEdgePadding = isCompact ? 0.875 : 1.25;
  const chipSx = {
    bgcolor: "action.selected",
    color: "primary.dark",
    fontSize: isCompact ? "0.75rem" : undefined,
    fontWeight: 650,
    height: isCompact ? 24 : undefined,
    px: chipEdgePadding,
    "& .MuiChip-icon": {
      color: "primary.dark",
      fontSize: isCompact ? "0.85rem" : "0.95rem",
      ml: 0,
      mr: 0.125,
    },
    "& .MuiChip-label": {
      px: 0,
    },
    "& .MuiChip-icon + .MuiChip-label": {
      pl: 0.25,
    },
  };

  return (
    <Stack
      direction="row"
      useFlexGap
      spacing={isCompact ? 0.75 : 1}
      sx={{ flexWrap: "wrap" }}
    >
      {temperature ? (
        <Chip
          data-testid="personal-items-report-temperature-chip"
          icon={<FaTemperatureHalf aria-hidden="true" />}
          size="small"
          label={temperature}
          sx={chipSx}
        />
      ) : null}
      {chips.map((chip) => (
        <Chip
          key={chip}
          size="small"
          label={formatReportValue(chip)}
          sx={chipSx}
        />
      ))}
    </Stack>
  );
}

function PersonalItemsReportSummary({
  isCompact = false,
  isExpanded = true,
  isStale,
  report,
  t,
}: PersonalItemsReportSummaryProps) {
  return (
    <Stack spacing={isCompact ? 1.25 : 2}>
      {isStale ? (
        <PersonalItemsReportStaleAlert isCompact={isCompact} t={t} />
      ) : null}
      <Stack
        direction="row"
        spacing={isCompact ? 1.25 : 2}
        sx={{ alignItems: "center" }}
      >
        <PersonalItemsReportScoreBadge isCompact={isCompact} report={report} />
        <PersonalItemsReportSummaryCopy
          isCompact={isCompact}
          isExpanded={isExpanded}
          report={report}
          t={t}
        />
      </Stack>
      <PersonalItemsReportSummaryChips
        isCompact={isCompact}
        report={report}
        t={t}
      />
    </Stack>
  );
}

export { PersonalItemsReportSummary };
