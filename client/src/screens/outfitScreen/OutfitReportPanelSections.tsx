import {
  Box,
  Chip,
  Divider,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import type { OutfitReport } from "../../app/appTypes";
import {
  formatReportValue,
  getReportIssueIds,
  getReportScoreRows,
  getReportSuggestionIds,
  type OutfitReportTranslate,
} from "./OutfitReportPanelUtils";
import { ConfidenceSection } from "./OutfitReportPanelConfidence";
import {
  getScoreTone,
  HighlightRow,
  ReportSection,
  reportToneSx,
  TextList,
} from "./OutfitReportPanelSectionPrimitives";

type ReportContentProps = {
  onHighlightItemIds: (ids: string[]) => void;
  report: OutfitReport;
  t: OutfitReportTranslate;
};

const reportListTextSx = {
  fontSize: "0.875rem",
  lineHeight: 1.55,
} as const;

function ScoresSection({
  report,
  t,
}: Pick<ReportContentProps, "report" | "t">) {
  const rows = getReportScoreRows(report, t);
  if (!rows.length) return null;

  return (
    <ReportSection title={t("outfit.reportScores")}>
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

function IssuesSection({ onHighlightItemIds, report, t }: ReportContentProps) {
  const issues = report.issues || [];
  if (!issues.length && !report.compatibility?.mainRisks?.length) return null;

  return (
    <ReportSection
      title={t("outfit.reportIssues")}
      icon={<WarningAmberRoundedIcon color="warning" fontSize="small" />}
    >
      <Stack
        component="ul"
        spacing={0.75}
        sx={{
          listStyle: "none",
          m: 0,
          p: 0,
        }}
      >
        {issues.map((issue, index) => (
          <HighlightRow
            asListItem
            key={`${issue.code || issue.message || "issue"}-${index}`}
            ids={getReportIssueIds(issue)}
            onHighlightItemIds={onHighlightItemIds}
            tone="warning"
          >
            <Typography variant="body2" sx={reportListTextSx}>
              <Box component="span">{issue.message}</Box>
              {issue.suggestion ? (
                <Box
                  component="span"
                  data-testid="outfit-report-issue-suggestion"
                  sx={{ display: "block", mt: 0.25 }}
                >
                  <Box component="span" sx={{ fontWeight: 750 }}>
                    {t("outfit.reportIssueSuggestionLabel")}
                  </Box>{" "}
                  {issue.suggestion}
                </Box>
              ) : null}
            </Typography>
          </HighlightRow>
        ))}
        {(report.compatibility?.mainRisks || []).filter(Boolean).map((risk) => (
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
      title={t("outfit.reportSuggestions")}
      icon={<LightbulbOutlinedIcon color="primary" fontSize="small" />}
    >
      <Stack
        component="ul"
        spacing={0.75}
        sx={{
          listStyle: "none",
          m: 0,
          p: 0,
        }}
      >
        {suggestions.map((suggestion, index) => (
          <HighlightRow
            asListItem
            key={`${suggestion.type || "suggestion"}-${suggestion.message || index}`}
            ids={getReportSuggestionIds(suggestion)}
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

export function ReportDetails({
  onHighlightItemIds,
  report,
  t,
}: ReportContentProps) {
  return (
    <Stack spacing={2.5} divider={<Divider flexItem />}>
      <ScoresSection report={report} t={t} />
      <ReportSection
        title={t("outfit.reportStrengths")}
        icon={
          <CheckCircleOutlineRoundedIcon color="primary" fontSize="small" />
        }
      >
        <TextList items={report.compatibility?.mainStrengths} />
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
