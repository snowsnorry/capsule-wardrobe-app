import { Box, Chip, IconButton, Link as MuiLink, Stack, Typography } from "@mui/material";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import ThumbDownAltOutlinedIcon from "@mui/icons-material/ThumbDownAltOutlined";
import type { MouseEvent, ReactElement } from "react";
import type { IconType } from "react-icons";
import {
  GiBelt,
  GiConverseShoe,
  GiHoodie,
  GiLargeDress,
  GiMonclerJacket,
  GiShoppingBag,
  GiSleevelessTop,
  GiTShirt
} from "react-icons/gi";
import { PiPantsFill } from "react-icons/pi";
import { useI18n } from "../i18n/useI18n";
import { formatProductLabel } from "../utils/productLabel";
import ProductLabelText from "./ProductLabelText";
import { getSafeHttpUrl } from "../../../shared/urlSecurity.js";

type ClothingCardItem = {
  id?: string | number | null;
  name?: string | null;
  category?: string | null;
  image_url?: string | null;
  url?: string | null;
  audience?: string | null;
};

type ClothingCardProps = {
  item: ClothingCardItem;
  isSelectable?: boolean;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  isRegenerating?: boolean;
  onToggleSelected?: (item: ClothingCardItem) => void;
  onProductMenuClick?: (event: MouseEvent<HTMLButtonElement>, productUrl: string, item: ClothingCardItem) => void;
  isMobile?: boolean;
  mobileColumns?: 1 | 2 | 3;
};

const categoryIconByName: Record<string, IconType> = {
  outerwear: GiMonclerJacket,
  midlayer: GiHoodie,
  top: GiTShirt,
  bottom: PiPantsFill,
  dress: GiLargeDress,
  belt: GiBelt,
  shoes: GiConverseShoe,
  bag: GiShoppingBag,
  swimwear: GiSleevelessTop
};

function ClothingCard({
  item,
  isSelectable = false,
  isSelected = false,
  isSelectionMode = false,
  isRegenerating = false,
  onToggleSelected,
  onProductMenuClick,
  isMobile = false,
  mobileColumns = 2
}: ClothingCardProps): ReactElement {
  const { t } = useI18n();
  const imageUrl = getSafeHttpUrl(item?.image_url);
  const productUrl = getSafeHttpUrl(item?.url);
  const label = formatProductLabel(item, "");
  const categoryName = String(item?.category || "");
  const categoryLabel = categoryName ? t(`options.categories.${categoryName}`) : "";
  const CategoryIcon = categoryIconByName[categoryName];
  const showCategoryIcon = isMobile && Boolean(CategoryIcon);
  const showToggleButton = isSelectionMode && isSelectable;
  const showProductMenuButton = !isSelectionMode && Boolean(productUrl);
  const showCardActions = showToggleButton || showProductMenuButton;
  const showActionButtons = isMobile || isSelected;
  const isDenseMobileCard = isMobile && mobileColumns !== 1;
  const mobileCardMetrics = mobileColumns === 1
    ? {
        actionOffset: 12,
        categoryOffset: 12,
        categoryHeight: 28,
        categoryFontSize: "12px",
        categoryIconSize: "19px",
        categoryLabelPx: 1,
        detailPx: 2.5,
        detailPt: 2,
        detailPb: 2.25,
        detailMinHeight: 64,
        titleFontSize: "16px",
        titleLineHeight: 1.22
      }
    : mobileColumns === 3
      ? {
          actionOffset: 6,
          categoryOffset: 6,
          categoryHeight: 20,
          categoryFontSize: "8.5px",
          categoryIconSize: "14px",
          categoryLabelPx: 0.5,
          detailPx: 0.75,
          detailPt: 0.75,
          detailPb: 1,
          detailMinHeight: 42,
          titleFontSize: "11.5px",
          titleLineHeight: 1.12
        }
      : {
          actionOffset: 8,
          categoryOffset: 8,
          categoryHeight: 24,
          categoryFontSize: "10px",
          categoryIconSize: "16px",
          categoryLabelPx: 0.75,
          detailPx: 1,
          detailPt: 1,
          detailPb: 1.25,
          detailMinHeight: 50,
          titleFontSize: "13px",
          titleLineHeight: 1.18
        };

  const stopCardActionPropagation = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleToggleSelected = (event: MouseEvent<HTMLButtonElement>) => {
    stopCardActionPropagation(event);
    if (!isRegenerating && typeof onToggleSelected === "function") {
      onToggleSelected(item);
    }
  };

  const handleProductMenuClick = (event: MouseEvent<HTMLButtonElement>) => {
    stopCardActionPropagation(event);
    if (!productUrl || typeof onProductMenuClick !== "function") {
      return;
    }
    onProductMenuClick(event, productUrl, item);
  };

  const imageContent = (
    <>
      {imageUrl ? (
        <Box
          component="img"
          src={imageUrl}
          alt={label}
          sx={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center"
          }}
        />
      ) : (
        <Box
          sx={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            px: 2
          }}
        >
          <Typography variant="body2" color="text.secondary" align="center">
            {label}
          </Typography>
        </Box>
      )}
      {isSelected ? (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.38)",
            zIndex: 1,
            pointerEvents: "none"
          }}
        />
      ) : null}
    </>
  );

  return (
    <Box
      className="wardrobe-card-root"
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        borderRadius: isDenseMobileCard ? 0 : "8px",
        overflow: "hidden",
        backgroundColor: "background.paper",
        position: "relative",
        border: isDenseMobileCard ? "0.5px solid rgba(17, 36, 34, 0.44)" : "1px solid rgba(17, 36, 34, 0.08)",
        boxShadow: isDenseMobileCard ? "none" : "0 0px 8px rgba(17, 36, 34, 0.08)",
        ...(showCardActions && !isSelected && !isMobile
          ? {
              "& .wardrobe-card-actions": {
                opacity: 0,
                visibility: "hidden"
              },
              "&:hover .wardrobe-card-actions, &:focus-within .wardrobe-card-actions": {
                opacity: 0.72,
                visibility: "visible"
              }
            }
          : {})
      }}
    >
      <Box
        sx={{
          width: "100%",
          aspectRatio: "3 / 4",
          backgroundColor: "#f7f5f1",
          position: "relative",
          overflow: "hidden"
        }}
      >
        {showCardActions ? (
          <Stack
            className="wardrobe-card-actions"
            direction="row"
            spacing={isMobile ? 0.5 : 0.75}
            sx={{
              position: "absolute",
              top: isMobile ? mobileCardMetrics.actionOffset : 12,
              right: isMobile ? mobileCardMetrics.actionOffset : 12,
              zIndex: 4,
              opacity: showActionButtons ? 0.72 : undefined,
              visibility: showActionButtons ? "visible" : undefined,
              transition: "opacity 160ms ease, visibility 160ms ease",
              "&:hover, &:focus-within": {
                opacity: 1
              },
              "& .wardrobe-card-action-button": {
                width: 36,
                height: 36,
                bgcolor: "rgba(17, 17, 17, 0.42)",
                color: "#fff",
                transition: "background-color 160ms ease, color 160ms ease",
                "&:hover": {
                  bgcolor: "rgba(17, 17, 17, 0.62)"
                },
                "&.Mui-disabled": {
                  color: "#fff",
                  bgcolor: "rgba(17, 17, 17, 0.42)",
                  opacity: showActionButtons ? 0.72 : 0
                }
              },
              "& .wardrobe-card-regenerate.MuiIconButton-root": {
                bgcolor: isSelected ? "rgba(17, 17, 17, 0.92)" : "rgba(17, 17, 17, 0.42)",
                color: isSelected ? "#d24343" : "#fff",
                "&:hover": {
                  bgcolor: isSelected ? "rgba(17, 17, 17, 0.96)" : "rgba(17, 17, 17, 0.62)"
                },
                "&.Mui-disabled": {
                  color: isSelected ? "#d24343" : "#fff",
                  bgcolor: isSelected ? "rgba(17, 17, 17, 0.92)" : "rgba(17, 17, 17, 0.42)"
                }
              }
            }}
          >
            {showToggleButton ? (
              <IconButton
                aria-label={t("main.partialRegenerateToggle")}
                className="wardrobe-card-action-button wardrobe-card-regenerate"
                onMouseDown={stopCardActionPropagation}
                onPointerDown={stopCardActionPropagation}
                onClick={handleToggleSelected}
                disabled={isRegenerating}
              >
                <ThumbDownAltOutlinedIcon fontSize="small" />
              </IconButton>
            ) : null}
            {showProductMenuButton ? (
              <IconButton
                aria-label={t("capsule.openProductMenu")}
                className="wardrobe-card-action-button wardrobe-card-product-menu"
                onMouseDown={stopCardActionPropagation}
                onPointerDown={stopCardActionPropagation}
                onClick={handleProductMenuClick}
              >
                <MoreVertRoundedIcon fontSize="small" />
              </IconButton>
            ) : null}
          </Stack>
        ) : null}
        <Stack
          className="wardrobe-card-category-wrapper"
          direction="row"
          spacing={1}
          sx={{
            position: "absolute",
            top: isMobile ? mobileCardMetrics.categoryOffset : 12,
            left: isMobile ? mobileCardMetrics.categoryOffset : 12,
            zIndex: 1,
            maxWidth: isMobile
              ? mobileColumns === 3
                ? "calc(100% - 40px)"
                : "calc(100% - 92px)"
              : undefined
          }}
        >
          <Chip
            className="wardrobe-card-category"
            aria-label={showCategoryIcon ? categoryLabel || categoryName : undefined}
            icon={showCategoryIcon && CategoryIcon ? <CategoryIcon aria-hidden="true" focusable="false" /> : undefined}
            label={showCategoryIcon ? "" : categoryLabel || item.category || ""}
            size="small"
            sx={{
              maxWidth: "100%",
              width: showCategoryIcon ? mobileCardMetrics.categoryHeight : undefined,
              height: isMobile ? mobileCardMetrics.categoryHeight : 28,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontSize: isMobile ? mobileCardMetrics.categoryFontSize : "12px",
              fontWeight: 800,
              padding: 0,
              bgcolor: "#dcefeb",
              color: "#15766f",
              ...(showCategoryIcon
                ? {
                    minWidth: mobileCardMetrics.categoryHeight,
                    borderRadius: "999px",
                    justifyContent: "center",
                    "& .MuiChip-icon": {
                      m: 0,
                      color: "inherit",
                      fontSize: mobileCardMetrics.categoryIconSize
                    }
                  }
                : {}),
              "& .MuiChip-label": {
                display: showCategoryIcon ? "none" : undefined,
                px: isMobile ? mobileCardMetrics.categoryLabelPx : 1,
                overflow: "hidden",
                textOverflow: "ellipsis"
              }
            }}
          />
        </Stack>
        {productUrl ? (
          <MuiLink
            href={productUrl}
            target="_blank"
            rel="noopener noreferrer"
            underline="none"
            sx={{ position: "absolute", inset: 0, zIndex: 0 }}
          >
            {imageContent}
          </MuiLink>
        ) : (
          <Box sx={{ position: "absolute", inset: 0, zIndex: 0 }}>
            {imageContent}
          </Box>
        )}
      </Box>
      <Stack
        className="wardrobe-card-details"
        spacing={1.25}
        sx={{
          flexShrink: 0,
          flexGrow: 1,
          px: isMobile ? mobileCardMetrics.detailPx : 2.5,
          pt: isMobile ? mobileCardMetrics.detailPt : 2,
          pb: isMobile ? mobileCardMetrics.detailPb : 2.25,
          minHeight: isMobile ? mobileCardMetrics.detailMinHeight : 64,
          justifyContent: "flex-start",
          alignItems: "flex-start",
          backgroundColor: "#fff",
          borderTop: "1px solid rgba(15, 23, 42, 0.055)"
        }}
      >
        <Typography
          className="wardrobe-card-title"
          variant="subtitle1"
          sx={{
            color: "#202a33",
            fontWeight: 500,
            lineHeight: isMobile ? mobileCardMetrics.titleLineHeight : 1.22,
            letterSpacing: 0,
            fontSize: isMobile ? mobileCardMetrics.titleFontSize : "16px",
            ...(isMobile
              ? {
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 2,
                  overflow: "hidden"
                }
              : {})
          }}
        >
          <ProductLabelText
            item={item}
            fallbackLabel=""
            suffixSx={{
              fontSize: "0.72em",
              opacity: 0.72
            }}
          />
        </Typography>
      </Stack>
    </Box>
  );
}

export default ClothingCard;
