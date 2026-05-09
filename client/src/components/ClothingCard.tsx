import { useEffect, useState } from "react";
import type { MouseEvent, ReactElement } from "react";
import { useI18n } from "../i18n/useI18n";
import { formatProductLabel } from "../utils/productLabel";
import { getSafeHttpUrl } from "../../../shared/urlSecurity.js";
import {
  buildProductImageThumbnailSizes,
  buildProductImageThumbnails,
  type ProductImageThumbnails,
} from "../utils/productImageThumbnails";
import { ClothingCardView, getMobileCardMetrics } from "./ClothingCardParts";
import type { ClothingCardItem } from "./ClothingCardTypes";

type ClothingCardImageSource = {
  src: string;
  srcSet?: string;
  sizes?: string;
};

type ClothingCardProps = {
  item: ClothingCardItem;
  isSelectable?: boolean;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  isRegenerating?: boolean;
  onToggleSelected?: (item: ClothingCardItem) => void;
  onProductMenuClick?: (
    event: MouseEvent<HTMLButtonElement>,
    productUrl: string,
    item: ClothingCardItem,
  ) => void;
  isMobile?: boolean;
  mobileColumns?: 1 | 2 | 3;
};

function normalizeClothingCardProps(props: ClothingCardProps) {
  return {
    item: props.item,
    isSelectable: props.isSelectable ?? false,
    isSelected: props.isSelected ?? false,
    isSelectionMode: props.isSelectionMode ?? false,
    isRegenerating: props.isRegenerating ?? false,
    onToggleSelected: props.onToggleSelected,
    onProductMenuClick: props.onProductMenuClick,
    isMobile: props.isMobile ?? false,
    mobileColumns: props.mobileColumns ?? 2,
  };
}

function buildClothingCardActionProps({
  showCardActions,
  actionState,
  handlers,
  t,
}: {
  showCardActions: boolean;
  actionState: {
    isMobile: boolean;
    isSelected: boolean;
    isRegenerating: boolean;
    showToggleButton: boolean;
    showProductMenuButton: boolean;
    showMobileProductMenuButton: boolean;
    showActionButtons: boolean;
    mobileCardMetrics: ReturnType<typeof getMobileCardMetrics>;
  };
  handlers: {
    onToggleSelected: (event: MouseEvent<HTMLButtonElement>) => void;
    onProductMenuClick: (event: MouseEvent<HTMLButtonElement>) => void;
    stopPropagation: (event: MouseEvent<HTMLElement>) => void;
  };
  t: (key: string) => string;
}) {
  return showCardActions ? { ...actionState, ...handlers, t } : null;
}

function getClothingCardLabels(
  item: ClothingCardItem,
  t: (key: string) => string,
) {
  const categoryName = String(item?.category || "");
  const categoryLabel = categoryName
    ? t(`options.categories.${categoryName}`)
    : "";

  return {
    categoryDisplayLabel: categoryLabel || categoryName,
    categoryName,
    label: formatProductLabel(item, ""),
  };
}

function ClothingCard(props: ClothingCardProps): ReactElement {
  const {
    item,
    isSelectable,
    isSelected,
    isSelectionMode,
    isRegenerating,
    onToggleSelected,
    onProductMenuClick,
    isMobile,
    mobileColumns,
  } = normalizeClothingCardProps(props);
  const { t } = useI18n();
  const imageUrl = getSafeHttpUrl(item?.image_url);
  const imageState = useResponsiveClothingCardImageState(
    item?.image_url,
    imageUrl,
    isMobile,
    mobileColumns,
  );
  const productUrl = getSafeHttpUrl(item?.url);
  const { categoryDisplayLabel, categoryName, label } = getClothingCardLabels(
    item,
    t,
  );
  const mobileCardMetrics = getMobileCardMetrics(mobileColumns);
  const showToggleButton = isSelectionMode && isSelectable;
  const showProductMenuButton = !isSelectionMode && Boolean(productUrl);
  const showCardActions = showToggleButton || showProductMenuButton;
  const showMobileProductMenuButton = isMobile && showProductMenuButton;
  const showActionButtons = isMobile || isSelected;

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
    if (productUrl && typeof onProductMenuClick === "function") {
      onProductMenuClick(event, productUrl, item);
    }
  };
  const actionProps = buildClothingCardActionProps({
    showCardActions,
    actionState: {
      isMobile,
      isSelected,
      isRegenerating,
      showToggleButton,
      showProductMenuButton,
      showMobileProductMenuButton,
      showActionButtons,
      mobileCardMetrics,
    },
    handlers: {
      onToggleSelected: handleToggleSelected,
      onProductMenuClick: handleProductMenuClick,
      stopPropagation: stopCardActionPropagation,
    },
    t,
  });

  return (
    <ClothingCardView
      item={item}
      displayImageSource={imageState.displayImageSource}
      showImageNotFound={imageState.imageMode === "missing"}
      showImagePlaceholder={imageState.imageMode !== "loading"}
      productUrl={productUrl}
      label={label}
      isMobile={isMobile}
      mobileColumns={mobileColumns}
      isSelected={isSelected}
      categoryName={categoryName}
      categoryDisplayLabel={categoryDisplayLabel}
      showCardActions={showCardActions}
      actionProps={actionProps}
      mobileCardMetrics={mobileCardMetrics}
      onImageError={imageState.handleImageError}
    />
  );
}

function toClothingCardImageSource(
  thumbnails: ProductImageThumbnails,
): ClothingCardImageSource {
  return {
    src: thumbnails.src,
    srcSet: thumbnails.srcSet,
    sizes: thumbnails.sizes,
  };
}

function useResponsiveClothingCardImageState(
  originalImageUrl: unknown,
  safeImageUrl: string | null,
  isMobile: boolean,
  mobileColumns: 1 | 2 | 3,
) {
  return useClothingCardImageState(
    originalImageUrl,
    safeImageUrl,
    buildProductImageThumbnailSizes({ isMobile, mobileColumns }),
  );
}

function useClothingCardImageState(
  originalImageUrl: unknown,
  safeImageUrl: string | null,
  imageSizes: string,
) {
  const [displayImageSource, setDisplayImageSource] =
    useState<ClothingCardImageSource | null>(null);
  const [imageMode, setImageMode] = useState<
    "loading" | "thumbnail" | "original" | "missing"
  >("loading");

  useEffect(() => {
    let isActive = true;

    setDisplayImageSource(null);
    setImageMode(safeImageUrl ? "loading" : "missing");

    if (!safeImageUrl) {
      return () => {
        isActive = false;
      };
    }

    buildProductImageThumbnails(originalImageUrl, { sizes: imageSizes }).then(
      (thumbnails) => {
        if (!isActive) {
          return;
        }

        if (thumbnails) {
          setDisplayImageSource(toClothingCardImageSource(thumbnails));
          setImageMode("thumbnail");
        } else {
          setDisplayImageSource({ src: safeImageUrl });
          setImageMode("original");
        }
      },
    );

    return () => {
      isActive = false;
    };
  }, [imageSizes, originalImageUrl, safeImageUrl]);

  return {
    displayImageSource,
    imageMode,
    handleImageError() {
      if (imageMode === "thumbnail" && safeImageUrl) {
        setDisplayImageSource({ src: safeImageUrl });
        setImageMode("original");
        return;
      }

      setDisplayImageSource(null);
      setImageMode("missing");
    },
  };
}
export default ClothingCard;
