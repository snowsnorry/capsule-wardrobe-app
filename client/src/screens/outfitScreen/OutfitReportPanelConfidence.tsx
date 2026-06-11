import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import type { OutfitReport } from "../../app/appTypes";
import {
  toPercent,
  type OutfitReportTranslate,
} from "./OutfitReportPanelUtils";
import { ReportSection, TextList } from "./OutfitReportPanelSectionPrimitives";

type ConfidenceSectionProps = {
  report: OutfitReport;
  t: OutfitReportTranslate;
};

function getConfidenceTitle(percent: number | null, t: OutfitReportTranslate) {
  if (percent === null) return t("outfit.reportConfidence");
  return `${t("outfit.reportConfidence")}: ${percent}%`;
}

function ConfidenceDetails({ assumptions }: { assumptions: string[] }) {
  return <TextList items={assumptions} />;
}

function ConfidenceSection({ report, t }: ConfidenceSectionProps) {
  const percent = toPercent(report.confidence?.overall);
  const assumptions = report.confidence?.assumptions || [];
  if (percent === null && !assumptions.length) {
    return null;
  }

  return (
    <ReportSection
      title={getConfidenceTitle(percent, t)}
      icon={<ShieldOutlinedIcon color="primary" fontSize="small" />}
    >
      <ConfidenceDetails assumptions={assumptions} />
    </ReportSection>
  );
}

export { ConfidenceSection };
