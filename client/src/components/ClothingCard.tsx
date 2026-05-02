import { Box, Chip, IconButton, Link as MuiLink, Stack, Typography } from "@mui/material";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import ThumbDownAltOutlinedIcon from "@mui/icons-material/ThumbDownAltOutlined";
import type { MouseEvent, ReactElement } from "react";
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
  isRegenerating?: boolean;
  onToggleSelected?: (item: ClothingCardItem) => void;
  onProductMenuClick?: (event: MouseEvent<HTMLButtonElement>, productUrl: string, item: ClothingCardItem) => void;
  isMobile?: boolean;
};

function ClothingCard({
  item,
  isSelectable = false,
  isSelected = false,
  isRegenerating = false,
  onToggleSelected,
  onProductMenuClick,
  isMobile = false
}: ClothingCardProps): ReactElement {
  const { t } = useI18n();
  const imageUrl = getSafeHttpUrl(item?.image_url);
  const productUrl = getSafeHttpUrl(item?.url);
  const label = formatProductLabel(item, "");
  const categoryLabel = item?.category ? t(`options.categories.${item.category}`) : "";
  const showActionButtons = isMobile || isSelected;

  const handleToggleSelected = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isRegenerating && typeof onToggleSelected === "function") {
      onToggleSelected(item);
    }
  };

  const handleProductMenuClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!productUrl || typeof onProductMenuClick !== "function") {
      return;
    }
    onProductMenuClick(event, productUrl, item);
  };

  const cardContent = (
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
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(10,12,12,0.55) 100%)"
        }}
      />
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
      <Box
        sx={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          p: 2,
          zIndex: 2
        }}
      >
        <Typography
          variant="subtitle1"
          sx={{
            color: "#fff",
            fontWeight: 600,
            textShadow: "0 2px 12px rgba(0,0,0,0.45)"
          }}
        >
          <ProductLabelText
            item={item}
            fallbackLabel=""
            suffixSx={{
              fontSize: "0.72em",
              opacity: 0.88
            }}
          />
        </Typography>
      </Box>
    </>
  );

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        borderRadius: 0.3,
        overflow: "hidden",
        backgroundColor: "background.paper",
        position: "relative",
        boxShadow: "0 16px 40px rgba(17, 36, 34, 0.08)",
        transition: "transform 200ms ease, box-shadow 200ms ease",
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          borderRadius: 0.3,
          padding: "1px",
          background:
            "linear-gradient(140deg, rgba(28,124,124,0.35), rgba(240,180,41,0.35))",
          WebkitMask:
            "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          pointerEvents: "none"
        },
        ...((isSelectable || productUrl) && !isSelected && !isMobile
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
          : {}),
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: "0 20px 50px rgba(17, 36, 34, 0.14)"
        }
      }}
    >
      <Box
        sx={{
          width: "100%",
          aspectRatio: "3 / 4",
          background:
            "radial-gradient(circle at top, rgba(28,124,124,0.12), transparent 55%), #f6f4f1",
          position: "relative",
          overflow: "hidden"
        }}
      >
        {isSelectable || productUrl ? (
          <Stack
            className="wardrobe-card-actions"
            direction="row"
            spacing={0.75}
            sx={{
              position: "absolute",
              top: 12,
              right: 12,
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
            {isSelectable ? (
              <IconButton
                aria-label={t("main.partialRegenerateToggle")}
                className="wardrobe-card-action-button wardrobe-card-regenerate"
                onClick={handleToggleSelected}
                disabled={isRegenerating}
              >
                <ThumbDownAltOutlinedIcon fontSize="small" />
              </IconButton>
            ) : null}
            {productUrl ? (
              <IconButton
                aria-label={t("capsule.openProductMenu")}
                className="wardrobe-card-action-button wardrobe-card-product-menu"
                onClick={handleProductMenuClick}
              >
                <MoreVertRoundedIcon fontSize="small" />
              </IconButton>
            ) : null}
          </Stack>
        ) : null}
        <Stack
          direction="row"
          spacing={1}
          sx={{ position: "absolute", top: 12, left: 12, zIndex: 1 }}
        >
          <Chip
            label={categoryLabel || item.category || ""}
            size="small"
            sx={{
              textTransform: "uppercase",
              letterSpacing: 0.6,
              fontSize: "0.65rem",
              fontWeight: 700,
              bgcolor: "rgba(28,124,124,0.12)",
              color: "primary.main"
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
            {cardContent}
          </MuiLink>
        ) : (
          <Box sx={{ position: "absolute", inset: 0, zIndex: 0 }}>
            {cardContent}
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default ClothingCard;
