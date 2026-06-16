import { Box } from "@mui/material";
import AppShellFloatingPortal from "../../components/AppShellFloatingPortal";
import CapsuleReportPanel from "./CapsuleReportPanel";
import type { MainScreenViewProps } from "./MainScreenViewTypes";

const CAPSULE_REPORT_FLOATING_WIDTH_LG = 380;
const CAPSULE_REPORT_FLOATING_WIDTH_XL = 420;
const CAPSULE_REPORT_FLOATING_GAP = 24;
const CAPSULE_REPORT_FLOATING_INSET_LG = 16;
const CAPSULE_REPORT_FLOATING_INSET_XL = 24;

const capsuleReportFloatingInspectorSx = {
  position: "fixed",
  top: { lg: 16, xl: 20 },
  right: { lg: 16, xl: 24 },
  bottom: { lg: 16, xl: 20 },
  width: {
    lg: CAPSULE_REPORT_FLOATING_WIDTH_LG,
    xl: CAPSULE_REPORT_FLOATING_WIDTH_XL,
  },
  maxWidth: "calc(100% - 32px)",
  minHeight: 0,
  zIndex: 2,
} as const;

const capsuleWithFloatingReportSx = {
  pr: {
    lg: `${CAPSULE_REPORT_FLOATING_WIDTH_LG + CAPSULE_REPORT_FLOATING_GAP + CAPSULE_REPORT_FLOATING_INSET_LG}px`,
    xl: `${CAPSULE_REPORT_FLOATING_WIDTH_XL + CAPSULE_REPORT_FLOATING_GAP + CAPSULE_REPORT_FLOATING_INSET_XL}px`,
  },
} as const;

const capsuleReportCompactSectionSx = {
  px: { xs: 1, sm: 2, md: 3 },
  pt: { xs: 1, md: 2 },
} as const;

type CapsuleReportSlotsProps = Pick<
  MainScreenViewProps,
  "interactionDisabled" | "props" | "t"
> & {
  onHighlightItemIds: (ids: string[]) => void;
  reportIsStale: boolean;
  showFloatingReportInspector: boolean;
  showInlineCompactReport: boolean;
};

function MainScreenInlineCapsuleReportSlot({
  interactionDisabled,
  onHighlightItemIds,
  props,
  reportIsStale,
  showInlineCompactReport,
  t,
}: CapsuleReportSlotsProps) {
  const report = props.activeCapsule?.effective?.report || null;
  if (!showInlineCompactReport) {
    return null;
  }

  return (
    <Box sx={capsuleReportCompactSectionSx}>
      <CapsuleReportPanel
        disabled={interactionDisabled}
        isCompact
        isPending={props.isCapsuleReportPending}
        isStale={reportIsStale}
        report={report}
        t={t}
        onDelete={() =>
          void props.onDeleteCapsuleReport?.(props.activeCapsule?.id)
        }
        onHighlightItemIds={onHighlightItemIds}
        onRegenerate={() =>
          void props.onGenerateCapsuleReport?.(props.activeCapsule?.id)
        }
      />
    </Box>
  );
}

function MainScreenFloatingCapsuleReportSlot({
  interactionDisabled,
  onHighlightItemIds,
  props,
  reportIsStale,
  showFloatingReportInspector,
  t,
}: CapsuleReportSlotsProps) {
  const report = props.activeCapsule?.effective?.report || null;
  if (!showFloatingReportInspector) {
    return null;
  }

  return (
    <AppShellFloatingPortal>
      <Box
        data-testid="capsule-report-floating-inspector"
        sx={capsuleReportFloatingInspectorSx}
      >
        <CapsuleReportPanel
          disabled={interactionDisabled}
          isPending={props.isCapsuleReportPending}
          isStale={reportIsStale}
          report={report}
          t={t}
          onDelete={() =>
            void props.onDeleteCapsuleReport?.(props.activeCapsule?.id)
          }
          onHighlightItemIds={onHighlightItemIds}
          onRegenerate={() =>
            void props.onGenerateCapsuleReport?.(props.activeCapsule?.id)
          }
        />
      </Box>
    </AppShellFloatingPortal>
  );
}

export {
  MainScreenFloatingCapsuleReportSlot,
  MainScreenInlineCapsuleReportSlot,
  capsuleWithFloatingReportSx,
};
