import { Box, Chip, Link as MuiLink, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { CardActions } from "./ClothingCardActions";
import { ClothingCardDetails } from "./ClothingCardDetailsParts";
import type {
  CardActionProps,
  ClothingCardItem,
  MobileCardMetrics,
} from "./ClothingCardTypes";

function getMobileCardMetrics(mobileColumns: 1 | 2 | 3): MobileCardMetrics {
  if (mobileColumns === 1) {
    return {
      actionOffset: 12,
      detailPx: 2.5,
      detailPt: 2,
      detailPb: 2.25,
      detailMinHeight: 64,
      titleFontSize: "16px",
      titleLineHeight: 1.22,
    };
  }

  if (mobileColumns === 3) {
    return {
      actionOffset: 6,
      detailPx: 0.75,
      detailPt: 0.75,
      detailPb: 1,
      detailMinHeight: 42,
      titleFontSize: "11.5px",
      titleLineHeight: 1.12,
    };
  }

  return {
    actionOffset: 8,
    detailPx: 1,
    detailPt: 1,
    detailPb: 1.25,
    detailMinHeight: 50,
    titleFontSize: "13px",
    titleLineHeight: 1.18,
  };
}

function getCardRootSx({
  isDenseMobileCard,
  showCardActions,
  isSelected,
  isMobile,
}: {
  isDenseMobileCard: boolean;
  showCardActions: boolean;
  isSelected: boolean;
  isMobile: boolean;
}) {
  return {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    borderRadius: isDenseMobileCard ? 0 : "8px",
    overflow: "hidden",
    backgroundColor: "background.paper",
    position: "relative",
    border: isDenseMobileCard
      ? "0.5px solid rgba(17, 36, 34, 0.44)"
      : "1px solid rgba(17, 36, 34, 0.08)",
    boxShadow: isDenseMobileCard ? "none" : "0 0px 8px rgba(17, 36, 34, 0.08)",
    ...(showCardActions && !isSelected && !isMobile
      ? {
          "& .wardrobe-card-actions": {
            opacity: 0,
            visibility: "hidden",
          },
          "&:hover .wardrobe-card-actions, &:focus-within .wardrobe-card-actions":
            {
              opacity: 0.72,
              visibility: "visible",
            },
        }
      : {}),
  } as const;
}

function ProductImageContent({
  displayImageUrl,
  label,
  isSelected,
  onImageError,
}: {
  displayImageUrl: string | null;
  label: string;
  isSelected: boolean;
  onImageError: () => void;
}) {
  return (
    <>
      {displayImageUrl ? (
        <Box
          component="img"
          src={displayImageUrl}
          alt={label}
          onError={onImageError}
          sx={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
          }}
        />
      ) : (
        <Box
          sx={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            px: 2,
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
            pointerEvents: "none",
          }}
        />
      ) : null}
    </>
  );
}

function ClothingCardImageSection({
  productUrl,
  displayImageUrl,
  label,
  isSelected,
  isMobile,
  categoryDisplayLabel,
  actionProps,
  onImageError,
}: {
  productUrl: string | null;
  displayImageUrl: string | null;
  label: string;
  isSelected: boolean;
  isMobile: boolean;
  categoryDisplayLabel: string;
  actionProps: CardActionProps | null;
  onImageError: () => void;
}) {
  return (
    <Box
      sx={{
        width: "100%",
        aspectRatio: "3 / 4",
        backgroundColor: "#f7f5f1",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {actionProps ? <CardActions {...actionProps} /> : null}
      {!isMobile ? <CategoryChip label={categoryDisplayLabel} /> : null}
      <CardImageFrame productUrl={productUrl}>
        <ProductImageContent
          displayImageUrl={displayImageUrl}
          label={label}
          isSelected={isSelected}
          onImageError={onImageError}
        />
      </CardImageFrame>
    </Box>
  );
}

function ClothingCardView({
  item,
  displayImageUrl,
  productUrl,
  label,
  isMobile,
  mobileColumns,
  isSelected,
  categoryName,
  categoryDisplayLabel,
  showCardActions,
  actionProps,
  mobileCardMetrics,
  onImageError,
}: {
  item: ClothingCardItem;
  displayImageUrl: string | null;
  productUrl: string | null;
  label: string;
  isMobile: boolean;
  mobileColumns: 1 | 2 | 3;
  isSelected: boolean;
  categoryName: string;
  categoryDisplayLabel: string;
  showCardActions: boolean;
  actionProps: CardActionProps | null;
  mobileCardMetrics: MobileCardMetrics;
  onImageError: () => void;
}) {
  return (
    <Box
      className="wardrobe-card-root"
      sx={getCardRootSx({
        isDenseMobileCard: isMobile && mobileColumns !== 1,
        showCardActions,
        isSelected,
        isMobile,
      })}
    >
      <ClothingCardImageSection
        productUrl={productUrl}
        displayImageUrl={displayImageUrl}
        label={label}
        isSelected={isSelected}
        isMobile={isMobile}
        categoryDisplayLabel={categoryDisplayLabel}
        actionProps={actionProps}
        onImageError={onImageError}
      />
      <ClothingCardDetails
        item={item}
        isMobile={isMobile}
        mobileCardMetrics={mobileCardMetrics}
        showMobileCategoryPrefix={isMobile && Boolean(categoryDisplayLabel)}
        categoryName={categoryName}
        categoryDisplayLabel={categoryDisplayLabel}
      />
    </Box>
  );
}

function CategoryChip({ label }: { label: string }) {
  return (
    <Stack
      className="wardrobe-card-category-wrapper"
      direction="row"
      spacing={1}
      sx={{ position: "absolute", top: 12, left: 12, zIndex: 1 }}
    >
      <Chip
        className="wardrobe-card-category"
        label={label}
        size="small"
        sx={{
          maxWidth: "100%",
          height: 28,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontSize: "12px",
          fontWeight: 800,
          padding: 0,
          bgcolor: "#dcefeb",
          color: "#15766f",
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

function CardImageFrame({
  children,
  productUrl,
}: {
  children: ReactNode;
  productUrl: string | null;
}) {
  if (productUrl) {
    return (
      <MuiLink
        href={productUrl}
        target="_blank"
        rel="noopener noreferrer"
        underline="none"
        sx={{ position: "absolute", inset: 0, zIndex: 0 }}
      >
        {children}
      </MuiLink>
    );
  }

  return (
    <Box sx={{ position: "absolute", inset: 0, zIndex: 0 }}>{children}</Box>
  );
}

export { ClothingCardView, getMobileCardMetrics };
