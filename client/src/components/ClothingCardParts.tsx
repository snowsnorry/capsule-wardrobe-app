import { Box, Chip, Stack, Typography } from "@mui/material";
import type { KeyboardEvent } from "react";
import type { ReactNode } from "react";
import { CardActions } from "./ClothingCardActions";
import { ClothingCardDetails } from "./ClothingCardDetailsParts";
import { ClothingCardImagePlaceholder } from "./ClothingCardImagePlaceholder";
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
  isInteractive,
}: {
  isDenseMobileCard: boolean;
  showCardActions: boolean;
  isSelected: boolean;
  isMobile: boolean;
  isInteractive: boolean;
}) {
  return {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    borderRadius: isDenseMobileCard ? 0 : "8px",
    overflow: "hidden",
    backgroundColor: "#fffdf9",
    position: "relative",
    border: isDenseMobileCard
      ? "0.5px solid rgba(17, 36, 34, 0.44)"
      : "1px solid rgba(17, 36, 34, 0.08)",
    boxShadow: isDenseMobileCard ? "none" : "0 0px 8px rgba(17, 36, 34, 0.08)",
    cursor: isInteractive ? "pointer" : "default",
    "&:focus-visible": isInteractive
      ? {
          outline: "3px solid",
          outlineColor: "primary.main",
          outlineOffset: 3,
        }
      : undefined,
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
  displayImageSource,
  showImageNotFound,
  showImagePlaceholder,
  label,
  isSelected,
  onImageError,
}: {
  displayImageSource: {
    src: string;
    srcSet?: string;
    sizes?: string;
  } | null;
  showImageNotFound: boolean;
  showImagePlaceholder: boolean;
  label: string;
  isSelected: boolean;
  onImageError: () => void;
}) {
  return (
    <>
      {displayImageSource ? (
        <Box
          component="img"
          src={displayImageSource.src}
          srcSet={displayImageSource.srcSet}
          sizes={displayImageSource.sizes}
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
            textAlign: "center",
          }}
        >
          {!showImagePlaceholder ? null : showImageNotFound ? (
            <ClothingCardImagePlaceholder label={label} />
          ) : (
            <Typography variant="body2" color="text.secondary" align="center">
              {label}
            </Typography>
          )}
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
  displayImageSource,
  showImageNotFound,
  showImagePlaceholder,
  label,
  isSelected,
  isMobile,
  categoryDisplayLabel,
  actionProps,
  onImageError,
}: {
  displayImageSource: {
    src: string;
    srcSet?: string;
    sizes?: string;
  } | null;
  showImageNotFound: boolean;
  showImagePlaceholder: boolean;
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
      <CardImageFrame>
        <ProductImageContent
          displayImageSource={displayImageSource}
          showImageNotFound={showImageNotFound}
          showImagePlaceholder={showImagePlaceholder}
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
  displayImageSource,
  showImageNotFound,
  showImagePlaceholder,
  label,
  isMobile,
  mobileColumns,
  isSelected,
  categoryName,
  categoryDisplayLabel,
  isSavedToWardrobe,
  savedToWardrobeLabel,
  showCardActions,
  actionProps,
  mobileCardMetrics,
  onCardClick,
  onImageError,
}: {
  item: ClothingCardItem;
  displayImageSource: {
    src: string;
    srcSet?: string;
    sizes?: string;
  } | null;
  showImageNotFound: boolean;
  showImagePlaceholder: boolean;
  label: string;
  isMobile: boolean;
  mobileColumns: 1 | 2 | 3;
  isSelected: boolean;
  categoryName: string;
  categoryDisplayLabel: string;
  isSavedToWardrobe: boolean;
  savedToWardrobeLabel: string;
  showCardActions: boolean;
  actionProps: CardActionProps | null;
  mobileCardMetrics: MobileCardMetrics;
  onCardClick?: () => void;
  onImageError: () => void;
}) {
  const isInteractive = typeof onCardClick === "function";
  const handleKeyDown = createCardKeyDownHandler(onCardClick);

  return (
    <Box
      className="wardrobe-card-root"
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={isInteractive ? label : undefined}
      onClick={onCardClick}
      onKeyDown={handleKeyDown}
      sx={getCardRootSx({
        isDenseMobileCard: isMobile && mobileColumns !== 1,
        showCardActions,
        isSelected,
        isMobile,
        isInteractive,
      })}
    >
      <ClothingCardImageSection
        displayImageSource={displayImageSource}
        showImageNotFound={showImageNotFound}
        showImagePlaceholder={showImagePlaceholder}
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
        isSavedToWardrobe={isSavedToWardrobe}
        savedToWardrobeLabel={savedToWardrobeLabel}
      />
    </Box>
  );
}

function createCardKeyDownHandler(onCardClick?: () => void) {
  return (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onCardClick) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onCardClick();
    }
  };
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
          "&&": {
            bgcolor: "#dcefeb",
            color: "#15766f",
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

function CardImageFrame({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ position: "absolute", inset: 0, zIndex: 0 }}>{children}</Box>
  );
}

export { ClothingCardView, getMobileCardMetrics };
