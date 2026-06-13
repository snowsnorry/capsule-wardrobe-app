import {
  Box,
  Chip,
  Divider,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import type { CapsuleReport } from "../../app/appTypes";
import {
  formatReportValue,
  toPercent,
} from "../outfitScreen/OutfitReportPanelUtils";
import {
  getScoreTone,
  HighlightRow,
  ReportSection,
  reportToneSx,
  TextList,
} from "../outfitScreen/OutfitReportPanelSectionPrimitives";
import {
  getCapsuleOverviewLines,
  getCapsuleReportIssueIds,
  getCapsuleReportScoreRows,
  getCapsuleReportStrengths,
  getCapsuleReportSuggestionIds,
  type CapsuleReportTranslate,
} from "./CapsuleReportPanelUtils";

type ReportContentProps = {
  onHighlightItemIds: (ids: string[]) => void;
  report: CapsuleReport;
  t: CapsuleReportTranslate;
};

const reportListTextSx = {
  fontSize: "0.875rem",
  lineHeight: 1.55,
} as const;

function ScoresSection({
  report,
  t,
}: Pick<ReportContentProps, "report" | "t">) {
  const rows = getCapsuleReportScoreRows(report, t);
  if (!rows.length) return null;

  return (
    <ReportSection title={t("capsule.reportScores")}>
      <Box
        sx={{
          alignItems: "center",
          columnGap: 1.5,
          display: "grid",
          gridTemplateColumns: "max-content minmax(96px, 1fr) max-content",
          rowGap: 1.25,
        }}
      >
        {rows.map((row) => {
          const tone = getScoreTone(row.percent);
          return (
            <Box key={row.key} sx={{ display: "contents" }}>
              <Typography variant="body2" noWrap>
                {row.label}
              </Typography>
              <LinearProgress
                aria-label={row.label}
                variant="determinate"
                value={row.percent || 0}
                sx={{
                  width: "100%",
                  height: 6,
                  borderRadius: "var(--cw-radius-pill)",
                  bgcolor: "divider",
                  "& .MuiLinearProgress-bar": {
                    bgcolor: reportToneSx[tone].markerColor,
                    borderRadius: "var(--cw-radius-pill)",
                  },
                }}
              />
              <Typography
                variant="body2"
                sx={{
                  color: reportToneSx[tone].color,
                  fontWeight: 750,
                  minWidth: 42,
                  textAlign: "right",
                }}
              >
                {row.percent}%
              </Typography>
            </Box>
          );
        })}
      </Box>
    </ReportSection>
  );
}

function OverviewSection({
  report,
  t,
}: Pick<ReportContentProps, "report" | "t">) {
  const lines = getCapsuleOverviewLines(report, t);
  if (!lines.length) return null;

  return (
    <ReportSection
      title={t("capsule.reportOverview")}
      icon={<InfoOutlinedIcon color="primary" fontSize="small" />}
    >
      <TextList items={lines} tone="neutral" />
    </ReportSection>
  );
}

function IssuesSection({ onHighlightItemIds, report, t }: ReportContentProps) {
  const issues = report.issues || [];
  if (!issues.length && !report.cohesion?.mainRisks?.length) return null;

  return (
    <ReportSection
      title={t("capsule.reportIssues")}
      icon={<WarningAmberRoundedIcon color="warning" fontSize="small" />}
    >
      <Stack
        component="ul"
        spacing={0.75}
        sx={{ listStyle: "none", m: 0, p: 0 }}
      >
        {issues.map((issue, index) => (
          <HighlightRow
            asListItem
            key={`${issue.code || issue.message || "issue"}-${index}`}
            ids={getCapsuleReportIssueIds(issue)}
            onHighlightItemIds={onHighlightItemIds}
            tone="warning"
          >
            <Typography variant="body2" sx={reportListTextSx}>
              <Box component="span">{issue.message}</Box>
              {issue.suggestion ? (
                <Box
                  component="span"
                  data-testid="capsule-report-issue-suggestion"
                  sx={{ display: "block", mt: 0.25 }}
                >
                  <Box component="span" sx={{ fontWeight: 750 }}>
                    {t("capsule.reportIssueSuggestionLabel")}
                  </Box>{" "}
                  {issue.suggestion}
                </Box>
              ) : null}
            </Typography>
          </HighlightRow>
        ))}
        {(report.cohesion?.mainRisks || []).filter(Boolean).map((risk) => (
          <Box
            key={risk}
            component="li"
            sx={{
              columnGap: 1,
              display: "grid",
              gridTemplateColumns: "20px minmax(0, 1fr)",
              listStyle: "none",
            }}
          >
            <Box
              aria-hidden="true"
              sx={{
                alignSelf: "start",
                bgcolor: reportToneSx.warning.markerColor,
                borderRadius: "var(--cw-radius-pill)",
                height: 5,
                justifySelf: "center",
                mt: "0.58em",
                width: 5,
              }}
            />
            <Typography variant="body2" sx={reportListTextSx}>
              {risk}
            </Typography>
          </Box>
        ))}
      </Stack>
    </ReportSection>
  );
}

function SuggestionsSection({
  onHighlightItemIds,
  report,
  t,
}: ReportContentProps) {
  const suggestions = report.suggestions || [];
  if (!suggestions.length) return null;

  return (
    <ReportSection
      title={t("capsule.reportSuggestions")}
      icon={<LightbulbOutlinedIcon color="primary" fontSize="small" />}
    >
      <Stack
        component="ul"
        spacing={0.75}
        sx={{ listStyle: "none", m: 0, p: 0 }}
      >
        {suggestions.map((suggestion, index) => (
          <HighlightRow
            asListItem
            key={`${suggestion.type || "suggestion"}-${suggestion.message || index}`}
            ids={getCapsuleReportSuggestionIds(suggestion)}
            onHighlightItemIds={onHighlightItemIds}
          >
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "flex-start" }}
            >
              <Typography variant="body2" sx={{ ...reportListTextSx, flex: 1 }}>
                {suggestion.message}
              </Typography>
              {suggestion.priority ? (
                <Chip
                  size="small"
                  label={formatReportValue(suggestion.priority)}
                  sx={{
                    bgcolor: "action.selected",
                    color: "text.secondary",
                    flexShrink: 0,
                    fontSize: "0.7rem",
                    fontWeight: 650,
                    height: 22,
                  }}
                />
              ) : null}
            </Stack>
          </HighlightRow>
        ))}
      </Stack>
    </ReportSection>
  );
}

function ConfidenceSection({
  report,
  t,
}: Pick<ReportContentProps, "report" | "t">) {
  const percent = toPercent(report.confidence?.overall);
  const assumptions = report.confidence?.assumptions || [];
  if (percent === null && !assumptions.length) {
    return null;
  }

  return (
    <ReportSection
      title={
        percent === null
          ? t("capsule.reportConfidence")
          : `${t("capsule.reportConfidence")}: ${percent}%`
      }
      icon={<ShieldOutlinedIcon color="primary" fontSize="small" />}
    >
      <TextList items={assumptions} />
    </ReportSection>
  );
}

export function CapsuleReportDetails({
  onHighlightItemIds,
  report,
  t,
}: ReportContentProps) {
  return (
    <Stack spacing={2.5} divider={<Divider flexItem />}>
      <ScoresSection report={report} t={t} />
      <OverviewSection report={report} t={t} />
      <ReportSection
        title={t("capsule.reportStrengths")}
        icon={
          <CheckCircleOutlineRoundedIcon color="primary" fontSize="small" />
        }
      >
        <TextList items={getCapsuleReportStrengths(report)} />
      </ReportSection>
      <IssuesSection
        onHighlightItemIds={onHighlightItemIds}
        report={report}
        t={t}
      />
      <SuggestionsSection
        onHighlightItemIds={onHighlightItemIds}
        report={report}
        t={t}
      />
      <ConfidenceSection report={report} t={t} />
    </Stack>
  );
}
