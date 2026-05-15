import type { MouseEvent, ReactElement } from "react";
import { useI18n } from "../i18n/useI18n";
import { formatProductLabel } from "../utils/productLabel";
import { getSafeHttpUrl } from "../../../shared/urlSecurity.js";
import { isSavedToWardrobe } from "../utils/savedWardrobeState";
import { useResponsiveClothingCardImageState } from "./ClothingCardImageState";
import { ClothingCardView, getMobileCardMetrics } from "./ClothingCardParts";
import type { ClothingCardItem } from "./ClothingCardTypes";

type ClothingCardProps = {
  item: ClothingCardItem;
  isSelectable?: boolean;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  isRegenerating?: boolean;
  onToggleSelected?: (item: ClothingCardItem) => void;
  onProductClick?: (item: ClothingCardItem) => void;
  onProductMenuClick?: (
    event: MouseEvent<HTMLButtonElement>,
    productUrl: string,
    item: ClothingCardItem,
  ) => void;
  showProductMenu?: boolean;
  isMobile?: boolean;
  mobileColumns?: 1 | 2 | 3;
};

const savedWardrobeSourceOptions = { includeWardrobeSource: true };

function normalizeClothingCardProps(props: ClothingCardProps) {
  return {
    item: props.item,
    isSelectable: props.isSelectable ?? false,
    isSelected: props.isSelected ?? false,
    isSelectionMode: props.isSelectionMode ?? false,
    isRegenerating: props.isRegenerating ?? false,
    onToggleSelected: props.onToggleSelected,
    onProductClick: props.onProductClick,
    onProductMenuClick: props.onProductMenuClick,
    showProductMenu: props.showProductMenu ?? true,
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

function getClothingCardBadgeLabels(t: (key: string) => string) {
  return {
    savedToWardrobeLabel: t("myWardrobe.savedBadge"),
    failedUploadLabel: t("myWardrobe.failedUploadBadge"),
    needsReviewLabel: t("myWardrobe.needsReviewBadge"),
  };
}

function buildCardClickHandler({
  item,
  isSelectable,
  isSelectionMode,
  isRegenerating,
  onToggleSelected,
  onProductClick,
}: {
  item: ClothingCardItem;
  isSelectable: boolean;
  isSelectionMode: boolean;
  isRegenerating: boolean;
  onToggleSelected?: (item: ClothingCardItem) => void;
  onProductClick?: (item: ClothingCardItem) => void;
}) {
  if (!isSelectionMode && typeof onProductClick !== "function") {
    return undefined;
  }

  return () => {
    if (isSelectionMode) {
      if (isSelectable && !isRegenerating) {
        onToggleSelected?.(item);
      }
      return;
    }

    onProductClick?.(item);
  };
}

function buildCardActionState({
  isMobile,
  isSelected,
  isRegenerating,
  showToggleButton,
  showProductMenuButton,
  mobileCardMetrics,
}: {
  isMobile: boolean;
  isSelected: boolean;
  isRegenerating: boolean;
  showToggleButton: boolean;
  showProductMenuButton: boolean;
  mobileCardMetrics: ReturnType<typeof getMobileCardMetrics>;
}) {
  return {
    isMobile,
    isSelected,
    isRegenerating,
    showToggleButton,
    showProductMenuButton,
    showMobileProductMenuButton: isMobile && showProductMenuButton,
    showActionButtons: isMobile || isSelected,
    mobileCardMetrics,
  };
}

function buildActionPropsForCard({
  showCardActions,
  isMobile,
  isSelected,
  isRegenerating,
  showToggleButton,
  showProductMenuButton,
  mobileCardMetrics,
  handlers,
  t,
}: {
  showCardActions: boolean;
  isMobile: boolean;
  isSelected: boolean;
  isRegenerating: boolean;
  showToggleButton: boolean;
  showProductMenuButton: boolean;
  mobileCardMetrics: ReturnType<typeof getMobileCardMetrics>;
  handlers: Parameters<typeof buildClothingCardActionProps>[0]["handlers"];
  t: (key: string) => string;
}) {
  return buildClothingCardActionProps({
    showCardActions,
    actionState: buildCardActionState({
      isMobile,
      isSelected,
      isRegenerating,
      showToggleButton,
      showProductMenuButton,
      mobileCardMetrics,
    }),
    handlers,
    t,
  });
}

function stopCardActionPropagation(event: MouseEvent<HTMLElement>) {
  event.preventDefault();
  event.stopPropagation();
}

function useCardImageStateForItem({
  imageUrl,
  isMobile,
  item,
  mobileColumns,
}: {
  imageUrl: string | null;
  isMobile: boolean;
  item: ClothingCardItem;
  mobileColumns: 1 | 2 | 3;
}) {
  return useResponsiveClothingCardImageState(
    item?.image_url,
    imageUrl,
    item?.source,
    isMobile,
    mobileColumns,
  );
}

function ClothingCard(props: ClothingCardProps): ReactElement {
  const {
    item,
    isSelectable,
    isSelected,
    isSelectionMode,
    isRegenerating,
    onToggleSelected,
    onProductClick,
    onProductMenuClick,
    showProductMenu,
    isMobile,
    mobileColumns,
  } = normalizeClothingCardProps(props);
  const { t } = useI18n();
  const imageUrl = getSafeHttpUrl(item?.image_url);
  const imageState = useCardImageStateForItem({
    imageUrl,
    isMobile,
    item,
    mobileColumns,
  });
  const productUrl = getSafeHttpUrl(item?.url);
  const { categoryDisplayLabel, categoryName, label } = getClothingCardLabels(
    item,
    t,
  );
  const badgeLabels = getClothingCardBadgeLabels(t);
  const mobileCardMetrics = getMobileCardMetrics(mobileColumns);
  const showToggleButton = isSelectionMode && isSelectable;
  const showProductMenuButton =
    showProductMenu && !isSelectionMode && Boolean(productUrl);
  const showCardActions = showToggleButton || showProductMenuButton;
  const handleToggleSelected = (event: MouseEvent<HTMLButtonElement>) => {
    stopCardActionPropagation(event);
    if (!isRegenerating && typeof onToggleSelected === "function") {
      onToggleSelected(item);
    }
  };
  const handleCardClick = buildCardClickHandler({
    item,
    isSelectable,
    isSelectionMode,
    isRegenerating,
    onToggleSelected,
    onProductClick,
  });
  const handleProductMenuClick = (event: MouseEvent<HTMLButtonElement>) => {
    stopCardActionPropagation(event);
    if (productUrl && typeof onProductMenuClick === "function") {
      onProductMenuClick(event, productUrl, item);
    }
  };
  const actionProps = buildActionPropsForCard({
    showCardActions,
    isMobile,
    isSelected,
    isRegenerating,
    showToggleButton,
    showProductMenuButton,
    mobileCardMetrics,
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
      label={label}
      isMobile={isMobile}
      mobileColumns={mobileColumns}
      isSelected={isSelected}
      categoryName={categoryName}
      categoryDisplayLabel={categoryDisplayLabel}
      isSavedToWardrobe={isSavedToWardrobe(item, savedWardrobeSourceOptions)}
      badgeLabels={badgeLabels}
      showCardActions={showCardActions}
      actionProps={actionProps}
      mobileCardMetrics={mobileCardMetrics}
      onCardClick={handleCardClick}
      onImageError={imageState.handleImageError}
    />
  );
}

export default ClothingCard;
