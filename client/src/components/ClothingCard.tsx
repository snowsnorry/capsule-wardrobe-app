import { useEffect, useState } from "react";
import type { MouseEvent, ReactElement } from "react";
import { useI18n } from "../i18n/useI18n";
import { formatProductLabel } from "../utils/productLabel";
import { getSafeHttpUrl } from "../../../shared/urlSecurity.js";
import { buildCachedProductImageUrl } from "../utils/cachedProductImage";
import { ClothingCardView, getMobileCardMetrics } from "./ClothingCardParts";
import type { ClothingCardItem } from "./ClothingCardTypes";

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
  const imageState = useClothingCardImageState(imageUrl);
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

  const handleImageError = async () => {
    if (imageState.imageFallbackAttempted) {
      return;
    }
    imageState.setImageFallbackAttempted(true);
    const cachedImageUrl = await buildCachedProductImageUrl(item?.image_url);
    if (cachedImageUrl) {
      imageState.setDisplayImageUrl(cachedImageUrl);
    }
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
      displayImageUrl={imageState.displayImageUrl}
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
      onImageError={handleImageError}
    />
  );
}

function useClothingCardImageState(imageUrl: string | null) {
  const [displayImageUrl, setDisplayImageUrl] = useState(imageUrl);
  const [imageFallbackAttempted, setImageFallbackAttempted] = useState(false);

  useEffect(() => {
    setDisplayImageUrl(imageUrl);
    setImageFallbackAttempted(false);
  }, [imageUrl]);

  return {
    displayImageUrl,
    imageFallbackAttempted,
    setDisplayImageUrl,
    setImageFallbackAttempted,
  };
}
export default ClothingCard;
