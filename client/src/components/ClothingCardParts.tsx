/* eslint-disable max-lines */
import { Box, Typography } from "@mui/material";
import type { KeyboardEvent } from "react";
import type { ReactNode } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { CardActions } from "./ClothingCardActions";
import {
  CategoryChip,
  getCategoryChip,
  type ClothingCardBadgeLabels,
} from "./ClothingCardCategoryChip";
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
  isPressing,
}: {
  isDenseMobileCard: boolean;
  showCardActions: boolean;
  isSelected: boolean;
  isMobile: boolean;
  isInteractive: boolean;
  isPressing: boolean;
}) {
  return {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    borderRadius: isDenseMobileCard ? 0 : "var(--cw-radius-card)",
    overflow: "hidden",
    backgroundColor: "var(--cw-color-product-card-bg)",
    position: "relative",
    border: isDenseMobileCard
      ? "0.5px solid var(--cw-color-product-dense-border)"
      : "1px solid var(--cw-color-product-border)",
    boxShadow: isDenseMobileCard ? "none" : "var(--cw-shadow-wardrobe-card)",
    cursor: isInteractive ? "pointer" : "default",
    transform: isPressing ? "scale(0.975)" : "scale(1)",
    transformOrigin: "center",
    transition:
      "transform 180ms cubic-bezier(0.2, 0, 0, 1), box-shadow 180ms ease",
    touchAction: isMobile ? "manipulation" : undefined,
    "@media (prefers-reduced-motion: reduce)": {
      transition: "none",
      transform: "none",
    },
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
          loading="lazy"
          decoding="async"
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
            backgroundColor: "var(--cw-color-product-selection-scrim)",
            zIndex: 1,
            pointerEvents: "none",
          }}
        />
      ) : null}
    </>
  );
}

function ClothingCardImageSection({
  item,
  displayImageSource,
  showImageNotFound,
  showImagePlaceholder,
  label,
  isSelected,
  isMobile,
  categoryDisplayLabel,
  badgeLabels,
  actionProps,
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
  isSelected: boolean;
  isMobile: boolean;
  categoryDisplayLabel: string;
  badgeLabels: ClothingCardBadgeLabels;
  actionProps: CardActionProps | null;
  onImageError: () => void;
}) {
  const categoryChip = getCategoryChip({
    item,
    categoryDisplayLabel,
    badgeLabels,
  });

  return (
    <Box
      sx={{
        width: "100%",
        aspectRatio: "3 / 4",
        backgroundColor: "var(--cw-color-product-image-wash)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {actionProps ? <CardActions {...actionProps} /> : null}
      {!isMobile && categoryChip ? <CategoryChip {...categoryChip} /> : null}
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

// The view keeps root semantics, media, details, and gesture handlers wired together.
// eslint-disable-next-line max-lines-per-function
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
  badgeLabels,
  showCardActions,
  actionProps,
  mobileCardMetrics,
  onCardClick,
  onContextMenuOpen,
  onImageError,
  onPointerCancel,
  onPointerDown,
  onPointerLeave,
  onPointerMove,
  onPointerUp,
  isPressing,
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
  badgeLabels: ClothingCardBadgeLabels;
  showCardActions: boolean;
  actionProps: CardActionProps | null;
  mobileCardMetrics: MobileCardMetrics;
  onCardClick?: () => void;
  onContextMenuOpen?: (anchor: HTMLElement) => void;
  onImageError: () => void;
  onPointerCancel?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerLeave?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  isPressing: boolean;
}) {
  const isInteractive = typeof onCardClick === "function";
  const handleKeyDown = createCardKeyDownHandler({
    onCardClick,
    onContextMenuOpen,
  });

  return (
    <Box
      className="wardrobe-card-root"
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={isInteractive ? label : undefined}
      aria-haspopup={onContextMenuOpen ? "menu" : undefined}
      aria-keyshortcuts={onContextMenuOpen ? "Shift+F10" : undefined}
      onClick={onCardClick}
      onKeyDown={handleKeyDown}
      onContextMenu={
        onContextMenuOpen
          ? (event) => {
              event.preventDefault();
              onContextMenuOpen(event.currentTarget);
            }
          : undefined
      }
      onPointerCancel={onPointerCancel}
      onPointerDown={onPointerDown}
      onPointerLeave={onPointerLeave}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      sx={getCardRootSx({
        isDenseMobileCard: isMobile && mobileColumns !== 1,
        showCardActions,
        isSelected,
        isMobile,
        isInteractive,
        isPressing,
      })}
    >
      <ClothingCardImageSection
        item={item}
        displayImageSource={displayImageSource}
        showImageNotFound={showImageNotFound}
        showImagePlaceholder={showImagePlaceholder}
        label={label}
        isSelected={isSelected}
        isMobile={isMobile}
        categoryDisplayLabel={categoryDisplayLabel}
        badgeLabels={badgeLabels}
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
        savedToWardrobeLabel={badgeLabels.savedToWardrobeLabel}
      />
    </Box>
  );
}

function createCardKeyDownHandler({
  onCardClick,
  onContextMenuOpen,
}: {
  onCardClick?: () => void;
  onContextMenuOpen?: (anchor: HTMLElement) => void;
}) {
  return (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      onContextMenuOpen &&
      (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))
    ) {
      event.preventDefault();
      onContextMenuOpen(event.currentTarget);
      return;
    }

    if (!onCardClick) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onCardClick();
    }
  };
}

const CardImageFrame = ({ children }: { children: ReactNode }) => (
  <Box sx={{ position: "absolute", inset: 0, zIndex: 0 }}>{children}</Box>
);

export { ClothingCardView, getMobileCardMetrics };
