/* eslint-disable max-lines */
import type { MouseEvent, ReactElement } from "react";
import { useI18n } from "../i18n/useI18n";
import { formatProductLabel } from "../utils/productLabel";
import { getSafeHttpUrl } from "../../../shared/urlSecurity.js";
import { isSavedToWardrobe } from "../utils/savedWardrobeState";
import { useResponsiveClothingCardImageState } from "./ClothingCardImageState";
import { useMobileLongPressMenu } from "./ClothingCardLongPress";
import { ClothingCardView, getMobileCardMetrics } from "./ClothingCardParts";
import type {
  ClothingCardItem,
  ProductMenuOpenOptions,
  SelectionToggleIcon,
} from "./ClothingCardTypes";

type ClothingCardProps = {
  item: ClothingCardItem;
  isSelectable?: boolean;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  isRegenerating?: boolean;
  regenerationLockedReason?: string | null;
  onToggleSelected?: (item: ClothingCardItem) => void;
  onProductClick?: (item: ClothingCardItem) => void;
  onProductMenuOpen?: (
    anchor: HTMLElement,
    productUrl: string,
    item: ClothingCardItem,
    options: ProductMenuOpenOptions,
  ) => void;
  allowProductMenuWithoutUrl?: boolean;
  selectionToggleIcon?: SelectionToggleIcon;
  selectionToggleLabel?: string;
  showProductMenu?: boolean;
  isMobile?: boolean;
  mobileColumns?: 1 | 2 | 3;
  disableImageGestures?: boolean;
};

const savedWardrobeSourceOptions = { includeWardrobeSource: true };

function normalizeClothingCardProps(props: ClothingCardProps) {
  return {
    item: props.item,
    isSelectable: props.isSelectable ?? false,
    isSelected: props.isSelected ?? false,
    isSelectionMode: props.isSelectionMode ?? false,
    isRegenerating: props.isRegenerating ?? false,
    regenerationLockedReason: props.regenerationLockedReason ?? null,
    onToggleSelected: props.onToggleSelected,
    onProductClick: props.onProductClick,
    onProductMenuOpen: props.onProductMenuOpen,
    allowProductMenuWithoutUrl: props.allowProductMenuWithoutUrl ?? false,
    selectionToggleIcon: props.selectionToggleIcon ?? "thumb-down",
    selectionToggleLabel: props.selectionToggleLabel,
    showProductMenu: props.showProductMenu ?? true,
    isMobile: props.isMobile ?? false,
    mobileColumns: props.mobileColumns ?? 2,
    disableImageGestures: props.disableImageGestures ?? false,
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
    regenerationLockedReason?: string | null;
    selectionToggleIcon: SelectionToggleIcon;
    selectionToggleLabel: string;
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
    savedToWardrobeLabel: t("wardrobe.savedBadge"),
    failedUploadLabel: t("wardrobe.failedUploadBadge"),
    likedLabel: t("wardrobe.likedBadge"),
    needsReviewLabel: t("wardrobe.needsReviewBadge"),
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
  regenerationLockedReason,
  selectionToggleIcon,
  selectionToggleLabel,
  showToggleButton,
  showProductMenuButton,
  mobileCardMetrics,
}: {
  isMobile: boolean;
  isSelected: boolean;
  isRegenerating: boolean;
  regenerationLockedReason?: string | null;
  selectionToggleIcon: SelectionToggleIcon;
  selectionToggleLabel: string;
  showToggleButton: boolean;
  showProductMenuButton: boolean;
  mobileCardMetrics: ReturnType<typeof getMobileCardMetrics>;
}) {
  return {
    isMobile,
    isSelected,
    isRegenerating,
    regenerationLockedReason,
    selectionToggleIcon,
    selectionToggleLabel,
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
  regenerationLockedReason,
  selectionToggleIcon,
  selectionToggleLabel,
  showToggleButton,
  showVisibleProductMenuButton,
  mobileCardMetrics,
  handlers,
  t,
}: {
  showCardActions: boolean;
  isMobile: boolean;
  isSelected: boolean;
  isRegenerating: boolean;
  regenerationLockedReason?: string | null;
  selectionToggleIcon: SelectionToggleIcon;
  selectionToggleLabel: string;
  showToggleButton: boolean;
  showVisibleProductMenuButton: boolean;
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
      regenerationLockedReason,
      selectionToggleIcon,
      selectionToggleLabel,
      showToggleButton,
      showProductMenuButton: showVisibleProductMenuButton,
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
    item?.imageUrl,
    imageUrl,
    item?.source,
    isMobile,
    mobileColumns,
  );
}

function getProductMenuKey({
  allowProductMenuWithoutUrl,
  item,
  productUrl,
}: {
  allowProductMenuWithoutUrl: boolean;
  item: ClothingCardItem;
  productUrl: string | null;
}) {
  if (productUrl) {
    return productUrl;
  }

  if (!allowProductMenuWithoutUrl || item?.source !== "uploaded" || !item?.id) {
    return "";
  }

  return String(item.id);
}

// The card keeps render wiring local so image, click, and action state stay in sync.
// eslint-disable-next-line complexity, max-lines-per-function
function ClothingCard(props: ClothingCardProps): ReactElement {
  const {
    item,
    isSelectable,
    isSelected,
    isSelectionMode,
    isRegenerating,
    regenerationLockedReason,
    onToggleSelected,
    onProductClick,
    onProductMenuOpen,
    allowProductMenuWithoutUrl,
    selectionToggleIcon,
    selectionToggleLabel,
    showProductMenu,
    isMobile,
    mobileColumns,
    disableImageGestures,
  } = normalizeClothingCardProps(props);
  const { t } = useI18n();
  const imageUrl = getSafeHttpUrl(item?.imageUrl);
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
  const productMenuKey = getProductMenuKey({
    allowProductMenuWithoutUrl,
    item,
    productUrl,
  });
  const showToggleButton =
    isSelectionMode && (isSelectable || Boolean(regenerationLockedReason));
  const showProductMenuButton =
    showProductMenu && !isSelectionMode && Boolean(productMenuKey);
  const showVisibleProductMenuButton = showProductMenuButton && !isMobile;
  const showCardActions = showToggleButton || showVisibleProductMenuButton;
  const resolvedSelectionToggleLabel =
    selectionToggleLabel || t("main.partialRegenerateToggle");
  const mobileLongPress = useMobileLongPressMenu({
    enabled: isMobile && showProductMenuButton,
    item,
    onOpen: onProductMenuOpen,
    productMenuKey,
  });
  const handleToggleSelected = (event: MouseEvent<HTMLButtonElement>) => {
    stopCardActionPropagation(event);
    if (
      !isRegenerating &&
      !regenerationLockedReason &&
      typeof onToggleSelected === "function"
    ) {
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
  const handleCardClickWithLongPressGuard = handleCardClick
    ? () => {
        if (mobileLongPress.shouldSuppressClick()) {
          return;
        }

        handleCardClick();
      }
    : undefined;
  const handleProductMenuClick = (event: MouseEvent<HTMLButtonElement>) => {
    stopCardActionPropagation(event);
    if (productMenuKey && typeof onProductMenuOpen === "function") {
      onProductMenuOpen(event.currentTarget, productMenuKey, item, {
        presentation: "anchored",
      });
    }
  };
  const actionProps = buildActionPropsForCard({
    showCardActions,
    isMobile,
    isSelected,
    isRegenerating,
    regenerationLockedReason,
    selectionToggleIcon,
    selectionToggleLabel: resolvedSelectionToggleLabel,
    showToggleButton,
    showVisibleProductMenuButton,
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
      disableImageGestures={disableImageGestures}
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
      onCardClick={handleCardClickWithLongPressGuard}
      onContextMenuOpen={
        isMobile && showProductMenuButton
          ? mobileLongPress.openMobileMenu
          : undefined
      }
      onImageError={imageState.handleImageError}
      isPressing={mobileLongPress.isPressing}
      {...mobileLongPress.pointerHandlers}
    />
  );
}

export default ClothingCard;
