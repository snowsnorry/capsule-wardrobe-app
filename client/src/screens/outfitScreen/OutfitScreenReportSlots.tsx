import { Box } from "@mui/material";
import type { OutfitScreenProps } from "./OutfitScreenTypes";
import OutfitReportPanel from "./OutfitReportPanel";
import {
  outfitReportCompactSectionSx,
  outfitReportFloatingInspectorSx,
} from "./OutfitScreenStyles";

type Translate = (key: string, params?: Record<string, unknown>) => string;
type OutfitReport = NonNullable<
  OutfitScreenProps["activeOutfit"]
>["effective"]["report"];

export type OutfitScreenReportSlotsProps = Pick<
  OutfitScreenProps,
  | "activeOutfit"
  | "isContentBusy"
  | "isReportPending"
  | "onDeleteOutfitReport"
  | "onGenerateOutfitReport"
> & {
  onHighlightItemIds: (ids: string[]) => void;
  report: OutfitReport | null;
  reportIsStale: boolean;
  showFloatingReportInspector: boolean;
  showInlineCompactReport: boolean;
  t: Translate;
};

export function OutfitScreenReportSlots({
  activeOutfit,
  isContentBusy,
  isReportPending,
  onDeleteOutfitReport,
  onGenerateOutfitReport,
  onHighlightItemIds,
  report,
  reportIsStale,
  showFloatingReportInspector,
  showInlineCompactReport,
  t,
}: OutfitScreenReportSlotsProps) {
  return (
    <>
      {showInlineCompactReport ? (
        <Box sx={outfitReportCompactSectionSx}>
          <OutfitReportPanel
            disabled={isContentBusy}
            isCompact
            isPending={isReportPending}
            isStale={reportIsStale}
            report={report}
            t={t}
            onDelete={() => void onDeleteOutfitReport?.(activeOutfit?.id)}
            onHighlightItemIds={onHighlightItemIds}
            onRegenerate={() => void onGenerateOutfitReport?.(activeOutfit?.id)}
          />
        </Box>
      ) : null}
      {showFloatingReportInspector ? (
        <Box
          data-testid="outfit-report-floating-inspector"
          sx={outfitReportFloatingInspectorSx}
        >
          <OutfitReportPanel
            disabled={isContentBusy}
            isPending={isReportPending}
            isStale={reportIsStale}
            report={report!}
            t={t}
            onDelete={() => void onDeleteOutfitReport?.(activeOutfit?.id)}
            onHighlightItemIds={onHighlightItemIds}
            onRegenerate={() => void onGenerateOutfitReport?.(activeOutfit?.id)}
          />
        </Box>
      ) : null}
    </>
  );
}
