import type { OutfitItemSnapshot } from "../../app/appTypes";
import type { OutfitScreenProps } from "./OutfitScreenTypes";

function useOutfitReportState({
  activeOutfit,
  isMobile,
  isReportInspectorLayout,
  visibleItems,
}: Pick<OutfitScreenProps, "activeOutfit"> & {
  isMobile: boolean;
  isReportInspectorLayout: boolean;
  visibleItems: OutfitItemSnapshot[];
}) {
  const report = activeOutfit?.effective?.report || null;
  const reportIsStale = Boolean(activeOutfit?.effective?.reportMeta?.stale);
  const hasReport = Boolean(report);
  const hasOutfitItems = visibleItems.length > 0;
  const showFloatingReportInspector = Boolean(
    report && isReportInspectorLayout && !isMobile,
  );
  const showInlineCompactReport = Boolean(
    report && !showFloatingReportInspector,
  );
  const showOutfitImageActions = Boolean(activeOutfit && hasOutfitItems);

  return {
    hasOutfitItems,
    hasReport,
    report,
    reportIsStale,
    showFloatingReportInspector,
    showInlineCompactReport,
    showOutfitImageActions,
  };
}

export { useOutfitReportState };
