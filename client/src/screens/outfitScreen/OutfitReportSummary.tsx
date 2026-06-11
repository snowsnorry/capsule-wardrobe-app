import { Alert, Box, Chip, Stack, Typography } from "@mui/material";
import type { OutfitReport } from "../../app/appTypes";
import {
  formatReportValue,
  getReportChipValues,
  getReportScore,
  getReportVerdictLabel,
  type OutfitReportTranslate,
} from "./OutfitReportPanelUtils";
import {
  getScoreTone,
  reportToneSx,
  type ReportTone,
} from "./OutfitReportPanelSectionPrimitives";

type ReportSummaryProps = {
  isCompact?: boolean;
  isExpanded?: boolean;
  isStale?: boolean;
  report: OutfitReport;
  t: OutfitReportTranslate;
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

function ReportStaleAlert({
  isCompact,
  t,
}: Pick<ReportSummaryProps, "isCompact" | "t">) {
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
      {t("outfit.reportOutdated")}
    </Alert>
  );
}

function ReportScoreBadge({
  isCompact,
  report,
}: Pick<ReportSummaryProps, "isCompact" | "report">) {
  const score = getReportScore(report);
  const scoreTone = getScoreTone(score);
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
      data-testid="outfit-report-score"
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

function ReportSummaryCopy({
  isCompact,
  isExpanded,
  report,
  t,
}: Pick<ReportSummaryProps, "isCompact" | "isExpanded" | "report" | "t">) {
  const clampSummary = Boolean(isCompact && !isExpanded);
  const bodySx = buildSummaryBodySx(Boolean(isCompact), clampSummary);
  const scoreTone = getScoreTone(getReportScore(report));
  const titleSx = buildSummaryTitleSx(Boolean(isCompact), scoreTone);

  return (
    <Stack spacing={isCompact ? 0.25 : 0.5} sx={{ minWidth: 0 }}>
      <Typography
        data-score-tone={scoreTone}
        data-testid="outfit-report-verdict"
        variant={isCompact ? "h6" : "h5"}
        sx={titleSx}
      >
        {getReportVerdictLabel(report, t)}
      </Typography>
      <Typography variant="body2" sx={bodySx}>
        {report.verdict?.summary || ""}
      </Typography>
    </Stack>
  );
}

function ReportSummaryChips({
  isCompact,
  report,
}: Pick<ReportSummaryProps, "isCompact" | "report">) {
  const chips = getReportChipValues(report);
  if (!chips.length) return null;

  return (
    <Stack
      direction="row"
      useFlexGap
      spacing={isCompact ? 0.75 : 1}
      sx={{ flexWrap: "wrap" }}
    >
      {chips.map((chip) => (
        <Chip
          key={chip}
          size="small"
          label={formatReportValue(chip)}
          sx={{
            bgcolor: "action.selected",
            color: "primary.dark",
            fontSize: isCompact ? "0.75rem" : undefined,
            fontWeight: 650,
            height: isCompact ? 24 : undefined,
            "& .MuiChip-label": {
              px: isCompact ? 1 : undefined,
            },
          }}
        />
      ))}
    </Stack>
  );
}

export function ReportSummary({
  isCompact = false,
  isExpanded = true,
  isStale,
  report,
  t,
}: ReportSummaryProps) {
  return (
    <Stack spacing={isCompact ? 1.25 : 2}>
      {isStale ? <ReportStaleAlert isCompact={isCompact} t={t} /> : null}
      <Stack
        direction="row"
        spacing={isCompact ? 1.25 : 2}
        sx={{ alignItems: "center" }}
      >
        <ReportScoreBadge isCompact={isCompact} report={report} />
        <ReportSummaryCopy
          isCompact={isCompact}
          isExpanded={isExpanded}
          report={report}
          t={t}
        />
      </Stack>
      <ReportSummaryChips isCompact={isCompact} report={report} />
    </Stack>
  );
}
