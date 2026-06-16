import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
import { Box, Typography } from "@mui/material";
import type { CSSProperties, ReactNode } from "react";
import { CardActions } from "./ClothingCardActions";
import {
  CategoryChip,
  getCategoryChip,
  type ClothingCardBadgeLabels,
} from "./ClothingCardCategoryChip";
import { ClothingCardImagePlaceholder } from "./ClothingCardImagePlaceholder";
import type { CardActionProps, ClothingCardItem } from "./ClothingCardTypes";

type ClothingCardDisplayImageSource = {
  src: string;
  srcSet?: string;
  sizes?: string;
};

function ClothingCardImageSection({
  item,
  displayImageSource,
  showImageNotFound,
  showImagePlaceholder,
  disableImageGestures,
  label,
  isSelected,
  isMobile,
  categoryDisplayLabel,
  badgeLabels,
  actionProps,
  onImageError,
}: {
  item: ClothingCardItem;
  displayImageSource: ClothingCardDisplayImageSource | null;
  showImageNotFound: boolean;
  showImagePlaceholder: boolean;
  disableImageGestures: boolean;
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
  const isLiked = Boolean(item.isLiked);

  return (
    <Box sx={imageSectionSx}>
      {actionProps ? <CardActions {...actionProps} /> : null}
      {isLiked ? <LikedIndicator label={badgeLabels.likedLabel} /> : null}
      {!isMobile && categoryChip ? (
        <CategoryChip {...categoryChip} left={isLiked ? 52 : 12} />
      ) : null}
      <CardImageFrame>
        <ProductImageContent
          displayImageSource={displayImageSource}
          showImageNotFound={showImageNotFound}
          showImagePlaceholder={showImagePlaceholder}
          disableImageGestures={disableImageGestures}
          label={label}
          isSelected={isSelected}
          onImageError={onImageError}
        />
      </CardImageFrame>
    </Box>
  );
}

function ProductImageContent({
  displayImageSource,
  showImageNotFound,
  showImagePlaceholder,
  disableImageGestures,
  label,
  isSelected,
  onImageError,
}: {
  displayImageSource: ClothingCardDisplayImageSource | null;
  showImageNotFound: boolean;
  showImagePlaceholder: boolean;
  disableImageGestures: boolean;
  label: string;
  isSelected: boolean;
  onImageError: () => void;
}) {
  return (
    <>
      {displayImageSource ? (
        <ProductImageElement
          displayImageSource={displayImageSource}
          disableImageGestures={disableImageGestures}
          label={label}
          onImageError={onImageError}
        />
      ) : (
        <ProductImageFallback
          label={label}
          showImageNotFound={showImageNotFound}
          showImagePlaceholder={showImagePlaceholder}
        />
      )}
      {isSelected ? <SelectionScrim /> : null}
    </>
  );
}

function ProductImageElement({
  displayImageSource,
  disableImageGestures,
  label,
  onImageError,
}: {
  displayImageSource: ClothingCardDisplayImageSource;
  disableImageGestures: boolean;
  label: string;
  onImageError: () => void;
}) {
  return (
    <Box
      component="img"
      src={displayImageSource.src}
      srcSet={displayImageSource.srcSet}
      sizes={displayImageSource.sizes}
      alt={label}
      draggable={false}
      loading="lazy"
      decoding="async"
      onError={onImageError}
      style={disableImageGestures ? imageGestureSuppressionStyle : undefined}
      sx={{
        ...productImageSx,
        touchAction: disableImageGestures ? "none" : undefined,
      }}
    />
  );
}

function ProductImageFallback({
  label,
  showImageNotFound,
  showImagePlaceholder,
}: {
  label: string;
  showImageNotFound: boolean;
  showImagePlaceholder: boolean;
}) {
  return (
    <Box sx={imageFallbackSx}>
      {!showImagePlaceholder ? null : showImageNotFound ? (
        <ClothingCardImagePlaceholder label={label} />
      ) : (
        <Typography variant="body2" color="text.secondary" align="center">
          {label}
        </Typography>
      )}
    </Box>
  );
}

const CardImageFrame = ({ children }: { children: ReactNode }) => (
  <Box sx={{ position: "absolute", inset: 0, zIndex: 0 }}>{children}</Box>
);

function SelectionScrim() {
  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        backgroundColor: "var(--cw-color-product-selection-scrim)",
        zIndex: 1,
        pointerEvents: "none",
      }}
    />
  );
}

function LikedIndicator({ label }: { label: string }) {
  return (
    <Box
      className="wardrobe-card-liked-indicator"
      aria-label={label}
      title={label}
      sx={likedIndicatorSx}
    >
      <FavoriteRoundedIcon
        sx={{
          display: "block",
          fontSize: 17,
          transform: "translateY(0.5px)",
        }}
      />
    </Box>
  );
}

const imageSectionSx = {
  width: "100%",
  aspectRatio: "3 / 4",
  backgroundColor: "var(--cw-color-product-image-wash)",
  position: "relative",
  overflow: "hidden",
} as const;

const imageFallbackSx = {
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  px: 2,
  textAlign: "center",
} as const;

const productImageSx = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "cover",
  objectPosition: "center",
  userSelect: "none",
  WebkitUserSelect: "none",
  WebkitTouchCallout: "none",
} as const;

const likedIndicatorSx = {
  position: "absolute",
  top: 12,
  left: 12,
  width: 28,
  height: 28,
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  color: "var(--cw-color-liked-indicator, #c62828)",
  backgroundColor: "var(--cw-color-liked-indicator-bg, #fffdf9)",
  border: "1px solid var(--cw-color-liked-indicator-border, #ebe8e2)",
  boxShadow: "var(--cw-shadow-image-toggle)",
  zIndex: 2,
  pointerEvents: "none",
} as const;

const imageGestureSuppressionStyle = {
  touchAction: "none",
  userSelect: "none",
  WebkitUserSelect: "none",
  WebkitTouchCallout: "none",
} as CSSProperties;

export { ClothingCardImageSection };
export type { ClothingCardDisplayImageSource };
