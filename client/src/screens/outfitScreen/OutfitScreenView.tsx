import { Box } from "@mui/material";
import type { ComponentProps } from "react";
import { OutfitHeader } from "./OutfitHeader";
import {
  OutfitScreenOverlays,
  OutfitScreenReportSlots,
  OutfitScreenScrollableContent,
} from "./OutfitScreenSections";
import {
  outfitContentSx,
  outfitHeaderSectionSx,
  outfitScreenSx,
} from "./OutfitScreenStyles";

export type OutfitScreenViewProps = {
  floatingReportProps: ComponentProps<typeof OutfitScreenReportSlots>;
  headerProps: ComponentProps<typeof OutfitHeader>;
  overlayProps: ComponentProps<typeof OutfitScreenOverlays>;
  scrollContentProps: ComponentProps<typeof OutfitScreenScrollableContent>;
};

export function OutfitScreenView({
  floatingReportProps,
  headerProps,
  overlayProps,
  scrollContentProps,
}: OutfitScreenViewProps) {
  return (
    <Box data-testid="outfit-screen" sx={outfitScreenSx}>
      <Box data-testid="outfit-content" sx={outfitContentSx}>
        <Box sx={outfitHeaderSectionSx}>
          <OutfitHeader {...headerProps} />
        </Box>
      </Box>
      <OutfitScreenScrollableContent {...scrollContentProps} />
      <OutfitScreenReportSlots {...floatingReportProps} />
      <OutfitScreenOverlays {...overlayProps} />
    </Box>
  );
}
