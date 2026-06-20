import { Box, LinearProgress } from "@mui/material";
import type { PersonalItemsReport } from "../app/appTypes";
import AppShellFloatingPortal from "../components/AppShellFloatingPortal";
import type { MainScreenItem } from "./mainScreen/MainScreenTypes";
import PersonalItemsReportPanel from "./PersonalItemsReportPanel";
import {
  wardrobeReportCompactSectionSx,
  wardrobeReportFloatingInspectorSx,
} from "./wardrobeScreenStyles";

function WardrobeReportProgress({
  isPending,
  t,
}: {
  isPending: boolean;
  t: (key: string) => string;
}) {
  return (
    <Box sx={{ height: 2, mt: -2.25, overflow: "hidden" }}>
      {isPending ? (
        <LinearProgress
          color="success"
          aria-label={t("wardrobe.reportGenerating")}
          sx={{ height: 2 }}
        />
      ) : null}
    </Box>
  );
}

function WardrobeReportSlots({
  disabled,
  isPending,
  isStale,
  items,
  onDelete,
  onHighlightItemIds,
  onRegenerate,
  report,
  showFloatingReportInspector,
  showInlineCompactReport,
  t,
}: {
  disabled: boolean;
  isPending: boolean;
  isStale: boolean;
  items: MainScreenItem[];
  onDelete: () => void;
  onHighlightItemIds: (ids: string[]) => void;
  onRegenerate: () => void;
  report: PersonalItemsReport | null;
  showFloatingReportInspector: boolean;
  showInlineCompactReport: boolean;
  t: (key: string, params?: Record<string, unknown>) => string;
}) {
  return (
    <>
      {showInlineCompactReport && report ? (
        <Box sx={wardrobeReportCompactSectionSx}>
          <PersonalItemsReportPanel
            disabled={disabled}
            isCompact
            isPending={isPending}
            isStale={isStale}
            items={items}
            report={report}
            t={t}
            onDelete={() => void onDelete()}
            onHighlightItemIds={onHighlightItemIds}
            onRegenerate={() => void onRegenerate()}
          />
        </Box>
      ) : null}
      {showFloatingReportInspector && report ? (
        <AppShellFloatingPortal>
          <Box
            data-testid="personal-items-report-floating-inspector"
            sx={wardrobeReportFloatingInspectorSx}
          >
            <PersonalItemsReportPanel
              disabled={disabled}
              isPending={isPending}
              isStale={isStale}
              items={items}
              report={report}
              t={t}
              onDelete={() => void onDelete()}
              onHighlightItemIds={onHighlightItemIds}
              onRegenerate={() => void onRegenerate()}
            />
          </Box>
        </AppShellFloatingPortal>
      ) : null}
    </>
  );
}

export { WardrobeReportProgress, WardrobeReportSlots };
