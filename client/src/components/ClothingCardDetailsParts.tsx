import BookmarkBorderRoundedIcon from "@mui/icons-material/BookmarkBorderRounded";
import { Box, Stack, Typography } from "@mui/material";
import type { ReactElement } from "react";
import type { IconType } from "react-icons";
import {
  GiBelt,
  GiConverseShoe,
  GiHoodie,
  GiLargeDress,
  GiMonclerJacket,
  GiShoppingBag,
  GiSleevelessTop,
  GiTShirt,
} from "react-icons/gi";
import { PiPantsFill } from "react-icons/pi";
import ProductLabelText from "./ProductLabelText";
import type { ClothingCardItem, MobileCardMetrics } from "./ClothingCardTypes";

const categoryIconByName: Record<string, IconType> = {
  outerwear: GiMonclerJacket,
  midlayer: GiHoodie,
  top: GiTShirt,
  bottom: PiPantsFill,
  dress: GiLargeDress,
  belt: GiBelt,
  shoes: GiConverseShoe,
  bag: GiShoppingBag,
  swimwear: GiSleevelessTop,
};

function CategoryPrefix({
  categoryName,
  categoryDisplayLabel,
}: {
  categoryName: string;
  categoryDisplayLabel: string;
}) {
  const CategoryIcon = categoryIconByName[categoryName];

  return (
    <Box
      component="span"
      className="wardrobe-card-title-category-prefix"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        color: "inherit",
        verticalAlign: "text-bottom",
        mr: 0.2,
      }}
    >
      {CategoryIcon ? (
        <Box
          component="span"
          aria-label={categoryDisplayLabel}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            color: "inherit",
            lineHeight: 1,
            verticalAlign: "text-bottom",
            "& svg": { display: "block", width: "0.9em", height: "0.9em" },
          }}
        >
          <CategoryIcon aria-hidden="true" focusable="false" />
        </Box>
      ) : (
        <Box
          component="span"
          className="wardrobe-card-title-category-text"
          sx={{ display: "inline", color: "inherit" }}
        >
          {categoryDisplayLabel}
        </Box>
      )}
      <Box
        component="span"
        className="wardrobe-card-title-separator"
        aria-hidden="true"
        sx={{ color: "inherit", mx: 0.4 }}
      >
        {"•"}
      </Box>
    </Box>
  );
}

function ClothingCardDetails({
  item,
  isMobile,
  mobileCardMetrics,
  showMobileCategoryPrefix,
  categoryName,
  categoryDisplayLabel,
  isSavedToWardrobe,
  savedToWardrobeLabel,
}: {
  item: ClothingCardItem;
  isMobile: boolean;
  mobileCardMetrics: MobileCardMetrics;
  showMobileCategoryPrefix: boolean;
  categoryName: string;
  categoryDisplayLabel: string;
  isSavedToWardrobe: boolean;
  savedToWardrobeLabel: string;
}): ReactElement {
  return (
    <Stack
      className="wardrobe-card-details"
      sx={{
        display: "grid",
        alignContent: "center",
        rowGap: isMobile ? 0.5 : 0.75,
        flexShrink: 0,
        flexGrow: 1,
        width: "100%",
        minWidth: 0,
        px: isMobile ? mobileCardMetrics.detailPx : 2.5,
        pt: isMobile ? mobileCardMetrics.detailPt : 2,
        pb: isMobile ? mobileCardMetrics.detailPb : 2.25,
        minHeight: isMobile ? mobileCardMetrics.detailMinHeight : 64,
        backgroundColor: "#fffdf9",
        borderTop: "1px solid rgba(15, 23, 42, 0.055)",
      }}
    >
      <Typography
        className="wardrobe-card-title"
        variant="subtitle1"
        sx={{
          color: "#1f2933",
          width: "100%",
          minWidth: 0,
          maxWidth: "100%",
          fontWeight: 600,
          lineHeight: isMobile ? mobileCardMetrics.titleLineHeight : 1.22,
          letterSpacing: 0,
          fontSize: isMobile ? mobileCardMetrics.titleFontSize : "16px",
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: isMobile ? 2 : 3,
          overflow: "hidden",
          overflowWrap: "anywhere",
        }}
      >
        {showMobileCategoryPrefix ? (
          <CategoryPrefix
            categoryName={categoryName}
            categoryDisplayLabel={categoryDisplayLabel}
          />
        ) : null}
        {isSavedToWardrobe ? (
          <SavedToWardrobeIcon
            isMobile={isMobile}
            label={savedToWardrobeLabel}
          />
        ) : null}
        <ProductLabelText
          item={item}
          fallbackLabel=""
          suffixSx={{ fontSize: "0.72em", opacity: 0.72 }}
        />
      </Typography>
    </Stack>
  );
}

function SavedToWardrobeIcon({
  isMobile,
  label,
}: {
  isMobile: boolean;
  label: string;
}) {
  return (
    <BookmarkBorderRoundedIcon
      className="wardrobe-card-saved-icon"
      titleAccess={label}
      aria-label={label}
      sx={{
        display: "inline-block",
        color: "#15766f",
        fontSize: isMobile ? 14 : 16,
        mr: 0.45,
        verticalAlign: "-0.16em",
      }}
    />
  );
}

export { ClothingCardDetails };
