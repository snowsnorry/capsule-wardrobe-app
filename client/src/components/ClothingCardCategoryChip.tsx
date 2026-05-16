import { Chip, Stack } from "@mui/material";
import { isUploadedWardrobeItemNeedsReview } from "../utils/uploadedWardrobeItemStatus";
import type { ClothingCardItem } from "./ClothingCardTypes";

type CategoryChipTone = "category" | "failed" | "needsReview";

type ClothingCardBadgeLabels = {
  failedUploadLabel: string;
  needsReviewLabel: string;
  savedToWardrobeLabel: string;
};

function isFailedUploadedWardrobeItem(item: ClothingCardItem) {
  return item.source === "uploaded" && item.processing_status === "failed";
}

function isNeedsReviewUploadedWardrobeItem(item: ClothingCardItem) {
  return isUploadedWardrobeItemNeedsReview(item);
}

function getCategoryChip({
  item,
  categoryDisplayLabel,
  badgeLabels,
}: {
  item: ClothingCardItem;
  categoryDisplayLabel: string;
  badgeLabels: ClothingCardBadgeLabels;
}): { label: string; tone: CategoryChipTone } | null {
  if (isFailedUploadedWardrobeItem(item)) {
    return { label: badgeLabels.failedUploadLabel, tone: "failed" };
  }

  if (isNeedsReviewUploadedWardrobeItem(item)) {
    return { label: badgeLabels.needsReviewLabel, tone: "needsReview" };
  }

  return categoryDisplayLabel
    ? { label: categoryDisplayLabel, tone: "category" }
    : null;
}

function getCategoryChipColors(tone: CategoryChipTone) {
  if (tone === "failed") {
    return {
      bgcolor: "#fde2e1",
      color: "#b42318",
    };
  }

  if (tone === "needsReview") {
    return {
      bgcolor: "#fff1c2",
      color: "#8a5a00",
    };
  }

  return {
    bgcolor: "#dcefeb",
    color: "#15766f",
  };
}

function CategoryChip({
  label,
  tone,
}: {
  label: string;
  tone: CategoryChipTone;
}) {
  const colors = getCategoryChipColors(tone);

  return (
    <Stack
      className="wardrobe-card-category-wrapper"
      direction="row"
      spacing={1}
      sx={{ position: "absolute", top: 12, left: 12, zIndex: 1 }}
    >
      <Chip
        className={`wardrobe-card-category wardrobe-card-category-${tone}`}
        label={label}
        size="small"
        sx={{
          "&&": {
            bgcolor: colors.bgcolor,
            color: colors.color,
          },
          maxWidth: "100%",
          height: 28,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontSize: "12px",
          fontWeight: 800,
          padding: 0,
          "& .MuiChip-label": {
            px: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
          },
        }}
      />
    </Stack>
  );
}

export { CategoryChip, getCategoryChip };
export type { ClothingCardBadgeLabels };
