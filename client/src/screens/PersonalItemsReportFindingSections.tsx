import { Box, Chip, Stack, Typography } from "@mui/material";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import type { PersonalItemsReportSuggestion } from "../app/personalItemsReportTypes";
import {
  HighlightRow,
  ReportSection,
  TextList,
} from "./outfitScreen/OutfitReportPanelSectionPrimitives";
import {
  formatReportValue,
  getPersonalItemsReportIssueIds,
  getPersonalItemsReportStrengthIds,
  getPersonalItemsReportSuggestionIds,
  toPercent,
} from "./PersonalItemsReportPanelUtils";
import {
  RelatedItems,
  reportListTextSx,
  type ReportContentProps,
  optionalRow,
  severityToTone,
  ValueRows,
} from "./PersonalItemsReportSectionPrimitives";

function StrengthsSection({
  onHighlightItemIds,
  report,
  resolveItems,
  t,
}: ReportContentProps) {
  const strengths = report.strengths || [];
  if (!strengths.length) return null;

  return (
    <ReportSection
      title={t("wardrobe.reportStrengths")}
      icon={<CheckCircleOutlineRoundedIcon color="primary" fontSize="small" />}
    >
      <Stack
        component="ul"
        spacing={0.75}
        sx={{ listStyle: "none", m: 0, p: 0 }}
      >
        {strengths.map((strength, index) => {
          const ids = getPersonalItemsReportStrengthIds(strength);
          return (
            <HighlightRow
              asListItem
              key={`${strength.dimension || "strength"}-${index}`}
              ids={ids}
              onHighlightItemIds={onHighlightItemIds}
            >
              <Stack spacing={0.35}>
                <Typography
                  component="div"
                  variant="body2"
                  sx={reportListTextSx}
                >
                  {strength.dimension ? (
                    <Box component="span" sx={{ fontWeight: 750 }}>
                      {formatReportValue(strength.dimension)}:{" "}
                    </Box>
                  ) : null}
                  {strength.message}
                </Typography>
                <RelatedItems ids={ids} resolveItems={resolveItems} t={t} />
              </Stack>
            </HighlightRow>
          );
        })}
      </Stack>
    </ReportSection>
  );
}

function IssuesSection({
  onHighlightItemIds,
  report,
  resolveItems,
  t,
}: ReportContentProps) {
  const issues = report.issues || [];
  if (!issues.length) return null;

  return (
    <ReportSection
      title={t("wardrobe.reportIssues")}
      icon={<WarningAmberRoundedIcon color="warning" fontSize="small" />}
    >
      <Stack
        component="ul"
        spacing={0.75}
        sx={{ listStyle: "none", m: 0, p: 0 }}
      >
        {issues.map((issue, index) => {
          const ids = getPersonalItemsReportIssueIds(issue);
          return (
            <HighlightRow
              asListItem
              key={`${issue.code || issue.message || "issue"}-${index}`}
              ids={ids}
              onHighlightItemIds={onHighlightItemIds}
              tone={severityToTone(issue.severity)}
            >
              <Stack spacing={0.35}>
                <IssueMessage issue={issue} t={t} />
                <RelatedItems ids={ids} resolveItems={resolveItems} t={t} />
              </Stack>
            </HighlightRow>
          );
        })}
      </Stack>
    </ReportSection>
  );
}

function IssueMessage({
  issue,
  t,
}: {
  issue: NonNullable<ReportContentProps["report"]["issues"]>[number];
  t: ReportContentProps["t"];
}) {
  return (
    <Typography component="div" variant="body2" sx={reportListTextSx}>
      {issue.severity ? (
        <Chip
          size="small"
          label={formatReportValue(issue.severity)}
          sx={{
            bgcolor: "action.selected",
            color: "text.secondary",
            fontSize: "0.7rem",
            fontWeight: 650,
            height: 22,
            mr: 0.75,
          }}
        />
      ) : null}
      {issue.dimension ? (
        <Box component="span" sx={{ fontWeight: 750 }}>
          {formatReportValue(issue.dimension)}:{" "}
        </Box>
      ) : null}
      {issue.message}
      {issue.suggestion ? (
        <Box
          component="span"
          data-testid="personal-items-report-issue-suggestion"
          sx={{ display: "block", mt: 0.25 }}
        >
          <Box component="span" sx={{ fontWeight: 750 }}>
            {t("wardrobe.reportIssueSuggestionLabel")}
          </Box>{" "}
          {issue.suggestion}
        </Box>
      ) : null}
    </Typography>
  );
}

function SuggestionsSection(props: ReportContentProps) {
  const suggestions = props.report.suggestions || [];
  if (!suggestions.length) return null;

  return (
    <ReportSection
      title={props.t("wardrobe.reportSuggestions")}
      icon={<LightbulbOutlinedIcon color="primary" fontSize="small" />}
    >
      <SuggestionList suggestions={suggestions} {...props} />
    </ReportSection>
  );
}

function SuggestionList({
  onHighlightItemIds,
  resolveItems,
  suggestions,
  t,
}: Omit<ReportContentProps, "report"> & {
  suggestions: PersonalItemsReportSuggestion[];
}) {
  return (
    <Stack component="ul" spacing={0.75} sx={{ listStyle: "none", m: 0, p: 0 }}>
      {suggestions.map((suggestion, index) => (
        <SuggestionItem
          key={`${suggestion.type || "suggestion"}-${suggestion.message || index}`}
          onHighlightItemIds={onHighlightItemIds}
          resolveItems={resolveItems}
          suggestion={suggestion}
          t={t}
        />
      ))}
    </Stack>
  );
}

function SuggestionItem({
  onHighlightItemIds,
  resolveItems,
  suggestion,
  t,
}: Omit<ReportContentProps, "report"> & {
  suggestion: PersonalItemsReportSuggestion;
}) {
  const ids = getPersonalItemsReportSuggestionIds(suggestion);
  return (
    <HighlightRow asListItem ids={ids} onHighlightItemIds={onHighlightItemIds}>
      <Stack spacing={0.5}>
        <SuggestionMessage suggestion={suggestion} />
        <ValueRows rows={suggestionRows(suggestion, t)} />
        <RelatedItems ids={ids} resolveItems={resolveItems} t={t} />
      </Stack>
    </HighlightRow>
  );
}

function SuggestionMessage({
  suggestion,
}: {
  suggestion: PersonalItemsReportSuggestion;
}) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
      <Typography variant="body2" sx={{ ...reportListTextSx, flex: 1 }}>
        {suggestion.type ? (
          <Box component="span" sx={{ fontWeight: 750 }}>
            {formatReportValue(suggestion.type)}:{" "}
          </Box>
        ) : null}
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
  );
}

function suggestionRows(
  suggestion: PersonalItemsReportSuggestion,
  t: ReportContentProps["t"],
) {
  return [
    optionalRow(
      "impact",
      t("wardrobe.reportExpectedImpact"),
      suggestion.expectedImpact,
    ),
    optionalRow(
      "target",
      t("wardrobe.reportTargetCategory"),
      suggestion.targetCategory,
    ),
    optionalRow(
      "replacement-category",
      t("wardrobe.reportReplacementCategory"),
      suggestion.replacementCategory,
    ),
    optionalRow(
      "replacement-description",
      t("wardrobe.reportReplacementDescription"),
      suggestion.replacementDescription,
    ),
  ];
}

function ConfidenceSection({
  report,
  t,
}: Pick<ReportContentProps, "report" | "t">) {
  const percent = toPercent(report.confidence?.overall);
  const lowConfidenceAspects = report.confidence?.lowConfidenceAspects || [];
  const assumptions = report.confidence?.assumptions || [];
  if (percent === null && !lowConfidenceAspects.length && !assumptions.length) {
    return null;
  }

  return (
    <ReportSection
      title={
        percent === null
          ? t("wardrobe.reportConfidence")
          : `${t("wardrobe.reportConfidence")}: ${percent}%`
      }
      icon={<ShieldOutlinedIcon color="primary" fontSize="small" />}
    >
      <Stack spacing={1}>
        {lowConfidenceAspects.length ? (
          <Stack spacing={0.5}>
            <Typography variant="body2" sx={{ fontWeight: 750 }}>
              {t("wardrobe.reportLowConfidenceAspects")}
            </Typography>
            <TextList items={lowConfidenceAspects} tone="warning" />
          </Stack>
        ) : null}
        {assumptions.length ? (
          <Stack spacing={0.5}>
            <Typography variant="body2" sx={{ fontWeight: 750 }}>
              {t("wardrobe.reportAssumptions")}
            </Typography>
            <TextList items={assumptions} />
          </Stack>
        ) : null}
      </Stack>
    </ReportSection>
  );
}

export {
  ConfidenceSection,
  IssuesSection,
  StrengthsSection,
  SuggestionsSection,
};
