import { Box, Stack } from "@mui/material";
import type { OutfitScreenMainContentProps } from "./OutfitScreenMainContent";
import { OutfitScreenMainContent } from "./OutfitScreenMainContent";
import type { OutfitScreenReportSlotsProps } from "./OutfitScreenReportSlots";
import { OutfitScreenReportSlots } from "./OutfitScreenReportSlots";
import {
  outfitCardsContentSpacing,
  outfitCardsScrollSx,
  outfitContentSx,
} from "./OutfitScreenStyles";

export type OutfitScreenScrollableContentProps = {
  mainContentProps: OutfitScreenMainContentProps;
  reportProps: OutfitScreenReportSlotsProps;
};

export function OutfitScreenScrollableContent({
  mainContentProps,
  reportProps,
}: OutfitScreenScrollableContentProps) {
  return (
    <Box
      data-app-primary-scroll-target="true"
      data-testid="outfit-cards-scroll"
      sx={outfitCardsScrollSx}
    >
      <Stack
        data-testid="outfit-cards-content"
        spacing={outfitCardsContentSpacing}
        sx={outfitContentSx}
      >
        <OutfitScreenReportSlots {...reportProps} />
        <OutfitScreenMainContent {...mainContentProps} />
      </Stack>
    </Box>
  );
}
