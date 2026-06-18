import { Alert, Box, Button, Snackbar, Stack } from "@mui/material";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import { SummaryLine } from "../../components/SummaryLine";
import {
  buildOutfitSetCategorySummaryItems,
  buildOutfitSetCompactSummary,
  MAIN_SCREEN_CONTENT_COLUMN_SX,
} from "./MainScreenHelpers";
import type { MainScreenViewProps } from "./MainScreenViewTypes";

const outfitActionRowSx = {
  ...MAIN_SCREEN_CONTENT_COLUMN_SX,
  px: { xs: 2, md: 3 },
  py: { xs: 1, md: 1.25 },
} as const;

function getOutfitSummaryItems(model: MainScreenViewProps) {
  const activeSet = model.display.activeSet;
  if (!activeSet) {
    return [];
  }
  if (model.isOverlaySidebar) {
    return [
      buildOutfitSetCompactSummary({
        items: activeSet.items,
        t: model.t,
      }),
    ];
  }
  return buildOutfitSetCategorySummaryItems({
    items: activeSet.items,
    locale: model.locale,
    t: model.t,
  });
}

export function CopyOutfitActionRow(model: MainScreenViewProps) {
  const { activeName, activeSet } = model.display;
  if (!activeSet) {
    return null;
  }

  const summaryItems = getOutfitSummaryItems(model);
  const outfitLabel = model.t("capsule.outfitSet", { number: activeSet.label });

  return (
    <Box sx={outfitActionRowSx}>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{
          minHeight: "var(--cw-control-action-height)",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1.5,
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <SummaryLine items={summaryItems} testId="outfit-summary" />
        </Box>
        <Button
          size="small"
          variant="text"
          startIcon={<ContentCopyRoundedIcon fontSize="small" />}
          disabled={model.interactionDisabled}
          onClick={() =>
            model.setCopyOutfitDialog({
              open: true,
              value: `${activeName}: ${outfitLabel}`,
            })
          }
          sx={{
            flexShrink: 0,
            fontWeight: 700,
            px: 1,
            color: "primary.main",
          }}
        >
          {model.t("capsule.copyOutfitToOutfits")}
        </Button>
      </Stack>
    </Box>
  );
}

export function CopyOutfitFeedbackSnackbar(model: MainScreenViewProps) {
  const outfitId = String(model.copiedOutfit?.id || "");
  return (
    <Snackbar
      open={Boolean(model.copiedOutfit)}
      autoHideDuration={6000}
      onClose={() => model.setCopiedOutfit(null)}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
    >
      <Alert
        severity="success"
        action={
          outfitId ? (
            <Button
              size="small"
              onClick={() => {
                model.setCopiedOutfit(null);
                void model.props.onOpenOutfit?.(outfitId);
              }}
              sx={{ color: "primary.main", fontWeight: 700 }}
            >
              {model.t("capsule.openCopiedOutfit")}
            </Button>
          ) : null
        }
        onClose={() => model.setCopiedOutfit(null)}
        sx={{ width: "min(680px, calc(100vw - 32px))" }}
      >
        {model.t("capsule.outfitCopied")}
      </Alert>
    </Snackbar>
  );
}
