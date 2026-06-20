import { Divider, Stack } from "@mui/material";
import {
  CoverageSection,
  OutfitReadinessSection,
  OverviewSection,
  ScoresSection,
  VersatilitySection,
} from "./PersonalItemsReportBasicSections";
import {
  ConfidenceSection,
  IssuesSection,
  StrengthsSection,
  SuggestionsSection,
} from "./PersonalItemsReportFindingSections";
import {
  ColorAnalysisSection,
  EfficiencySection,
  SeasonalitySection,
  StyleProfileSection,
} from "./PersonalItemsReportProfileSections";
import type { ReportContentProps } from "./PersonalItemsReportSectionPrimitives";

function PersonalItemsReportDetails(props: ReportContentProps) {
  return (
    <Stack spacing={2.5} divider={<Divider flexItem />}>
      <ScoresSection report={props.report} t={props.t} />
      <OverviewSection report={props.report} t={props.t} />
      <CoverageSection report={props.report} t={props.t} />
      <OutfitReadinessSection report={props.report} t={props.t} />
      <VersatilitySection report={props.report} t={props.t} />
      <StyleProfileSection {...props} />
      <SeasonalitySection report={props.report} t={props.t} />
      <ColorAnalysisSection report={props.report} t={props.t} />
      <EfficiencySection {...props} />
      <StrengthsSection {...props} />
      <IssuesSection {...props} />
      <SuggestionsSection {...props} />
      <ConfidenceSection report={props.report} t={props.t} />
    </Stack>
  );
}

export { PersonalItemsReportDetails };
