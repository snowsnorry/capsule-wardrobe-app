import type { ReactNode } from "react";
import {
  Alert,
  Box,
  Chip,
  Divider,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import type { OutfitReport } from "../../app/appTypes";
import {
  formatReportValue,
  getReportChipValues,
  getReportIssueIds,
  getReportScore,
  getReportScoreRows,
  getReportSuggestionIds,
  getReportVerdictLabel,
  toPercent,
  type OutfitReportTranslate,
} from "./OutfitReportPanelUtils";

type ReportContentProps = {
  onHighlightItemIds: (ids: string[]) => void;
  report: OutfitReport;
  t: OutfitReportTranslate;
};

function ReportSection({
  children,
  icon,
  title,
}: {
  children: ReactNode;
  icon?: ReactNode;
  title: string;
}) {
  return (
    <Stack spacing={1.25}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        {icon}
        <Typography variant="subtitle1" sx={{ fontWeight: 750 }}>
          {title}
        </Typography>
      </Stack>
      {children}
    </Stack>
  );
}

function TextList({ items }: { items: string[] | null | undefined }) {
  const values = (items || []).filter(Boolean);
  if (!values.length) return null;

  return (
    <Stack component="ul" spacing={0.75} sx={{ m: 0, pl: 2.5 }}>
      {values.map((item) => (
        <Typography key={item} component="li" variant="body2">
          {item}
        </Typography>
      ))}
    </Stack>
  );
}

function HighlightRow({
  children,
  ids,
  onHighlightItemIds,
}: {
  children: ReactNode;
  ids: string[];
  onHighlightItemIds: ReportContentProps["onHighlightItemIds"];
}) {
  const hasTargets = ids.length > 0;
  return (
    <Box
      tabIndex={hasTargets ? 0 : undefined}
      onBlur={() => onHighlightItemIds([])}
      onFocus={() => onHighlightItemIds(ids)}
      onMouseEnter={() => onHighlightItemIds(ids)}
      onMouseLeave={() => onHighlightItemIds([])}
      sx={{
        borderRadius: "var(--cw-radius-card)",
        p: 1,
        mx: -1,
        outline: "none",
        "&:focus-visible": hasTargets
          ? {
              boxShadow: "0 0 0 2px var(--cw-color-primary)",
            }
          : undefined,
      }}
    >
      {children}
    </Box>
  );
}

function ScoresSection({
  report,
  t,
}: Pick<ReportContentProps, "report" | "t">) {
  const rows = getReportScoreRows(report, t);
  if (!rows.length) return null;

  return (
    <ReportSection title={t("outfit.reportScores")}>
      <Stack spacing={1.25}>
        {rows.map((row) => (
          <Stack
            key={row.key}
            direction="row"
            spacing={1.5}
            sx={{ alignItems: "center" }}
          >
            <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
              {row.label}
            </Typography>
            <LinearProgress
              aria-label={row.label}
              variant="determinate"
              value={row.percent || 0}
              sx={{
                width: 116,
                height: 6,
                borderRadius: "var(--cw-radius-pill)",
                bgcolor: "divider",
                "& .MuiLinearProgress-bar": {
                  borderRadius: "var(--cw-radius-pill)",
                },
              }}
            />
            <Typography variant="body2" sx={{ fontWeight: 750, width: 42 }}>
              {row.percent}%
            </Typography>
          </Stack>
        ))}
      </Stack>
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
      <Stack spacing={0.75}>
        {issues.map((issue, index) => (
          <HighlightRow
            key={`${issue.code || issue.message || "issue"}-${index}`}
            ids={getReportIssueIds(issue)}
            onHighlightItemIds={onHighlightItemIds}
          >
            <Stack spacing={0.4}>
              <Typography variant="body2">{issue.message}</Typography>
              {issue.suggestion ? (
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  {issue.suggestion}
                </Typography>
              ) : null}
            </Stack>
          </HighlightRow>
        ))}
        <TextList items={report.compatibility?.mainRisks} />
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
      <Stack spacing={0.75}>
        {suggestions.map((suggestion, index) => (
          <HighlightRow
            key={`${suggestion.type || "suggestion"}-${suggestion.message || index}`}
            ids={getReportSuggestionIds(suggestion)}
            onHighlightItemIds={onHighlightItemIds}
          >
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "flex-start" }}
            >
              <Typography variant="body2" sx={{ flex: 1 }}>
                {suggestion.message}
              </Typography>
              {suggestion.priority ? (
                <Chip
                  size="small"
                  label={formatReportValue(suggestion.priority)}
                  sx={{ height: 22, fontSize: "0.7rem" }}
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
  const lowConfidenceAspects = report.confidence?.lowConfidenceAspects || [];
  if (percent === null && !assumptions.length && !lowConfidenceAspects.length) {
    return null;
  }

  return (
    <ReportSection
      title={t("outfit.reportConfidence")}
      icon={<ShieldOutlinedIcon color="primary" fontSize="small" />}
    >
      <Stack spacing={1}>
        {percent !== null ? (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {t("outfit.reportConfidenceValue", { percent })}
          </Typography>
        ) : null}
        <TextList items={assumptions} />
        {lowConfidenceAspects.length ? (
          <Stack
            direction="row"
            useFlexGap
            spacing={0.75}
            sx={{ flexWrap: "wrap" }}
          >
            {lowConfidenceAspects.map((aspect) => (
              <Chip
                key={aspect}
                size="small"
                label={formatReportValue(aspect)}
              />
            ))}
          </Stack>
        ) : null}
      </Stack>
    </ReportSection>
  );
}

export function ReportSummary({
  isStale,
  report,
  t,
}: Pick<ReportContentProps, "report" | "t"> & { isStale?: boolean }) {
  const score = getReportScore(report);
  const chips = getReportChipValues(report);

  return (
    <Stack spacing={2}>
      {isStale ? (
        <Alert severity="warning" sx={{ py: 0.5 }}>
          {t("outfit.reportOutdated")}
        </Alert>
      ) : null}
      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        <Box
          sx={{
            width: 92,
            height: 74,
            borderRadius: "var(--cw-radius-detail)",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            color: "primary.dark",
            backgroundColor: "action.selected",
          }}
        >
          <Typography variant="h2" sx={{ fontWeight: 750, lineHeight: 1 }}>
            {score ?? "-"}
          </Typography>
        </Box>
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          <Typography variant="h5" sx={{ color: "primary.main" }}>
            {getReportVerdictLabel(report, t)}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {report.verdict?.summary || ""}
          </Typography>
        </Stack>
      </Stack>
      {chips.length ? (
        <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: "wrap" }}>
          {chips.map((chip) => (
            <Chip
              key={chip}
              size="small"
              label={formatReportValue(chip)}
              sx={{
                bgcolor: "action.selected",
                color: "primary.dark",
                fontWeight: 650,
              }}
            />
          ))}
        </Stack>
      ) : null}
    </Stack>
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
