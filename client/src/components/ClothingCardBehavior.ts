import type { MouseEvent } from "react";
import { getSafeHttpUrl } from "../../../shared/urlSecurity.js";
import { formatProductLabel } from "../utils/productLabel";
import { isSavedToWardrobe } from "../utils/savedWardrobeState";
import { useResponsiveClothingCardImageState } from "./ClothingCardImageState";
import { useMobileLongPressMenu } from "./ClothingCardLongPress";
import { getMobileCardMetrics } from "./ClothingCardParts";
import { normalizeClothingCardProps } from "./ClothingCardProps";
import type { ClothingCardProps } from "./ClothingCardProps";
import type { ClothingCardViewProps } from "./ClothingCardParts";
import type {
  ClothingCardItem,
  SelectionToggleIcon,
} from "./ClothingCardTypes";

type TranslationGetter = (key: string) => string;

type NormalizedClothingCardProps = ReturnType<
  typeof normalizeClothingCardProps
>;

const savedWardrobeSourceOptions = { includeWardrobeSource: true };

function getClothingCardLabels(item: ClothingCardItem, t: TranslationGetter) {
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

function getClothingCardBadgeLabels(t: TranslationGetter) {
  return {
    savedToWardrobeLabel: t("wardrobe.savedBadge"),
    failedUploadLabel: t("wardrobe.failedUploadBadge"),
    likedLabel: t("wardrobe.likedBadge"),
    needsReviewLabel: t("wardrobe.needsReviewBadge"),
  };
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

function stopCardActionPropagation(event: MouseEvent<HTMLElement>) {
  event.preventDefault();
  event.stopPropagation();
}

function useCardDisplayState(
  props: Pick<
    NormalizedClothingCardProps,
    "item" | "isMobile" | "mobileColumns"
  >,
  t: TranslationGetter,
) {
  const imageUrl = getSafeHttpUrl(props.item?.imageUrl);
  const imageState = useResponsiveClothingCardImageState(
    props.item?.imageUrl,
    imageUrl,
    props.item?.source,
    props.isMobile,
    props.mobileColumns,
  );

  return {
    ...getClothingCardLabels(props.item, t),
    badgeLabels: getClothingCardBadgeLabels(t),
    imageState,
    mobileCardMetrics: getMobileCardMetrics(props.mobileColumns),
    savedToWardrobe: isSavedToWardrobe(props.item, savedWardrobeSourceOptions),
  };
}

function getCardActionVisibility({
  isMobile,
  isSelectable,
  isSelectionMode,
  productMenuKey,
  regenerationLockedReason,
  showProductMenu,
}: Pick<
  NormalizedClothingCardProps,
  | "isMobile"
  | "isSelectable"
  | "isSelectionMode"
  | "regenerationLockedReason"
  | "showProductMenu"
> & {
  productMenuKey: string;
}) {
  const showToggleButton =
    isSelectionMode && (isSelectable || Boolean(regenerationLockedReason));
  const showProductMenuButton =
    showProductMenu && !isSelectionMode && Boolean(productMenuKey);
  const showVisibleProductMenuButton = showProductMenuButton && !isMobile;

  return {
    showCardActions: showToggleButton || showVisibleProductMenuButton,
    showProductMenuButton,
    showToggleButton,
    showVisibleProductMenuButton,
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

function buildActionProps({
  handlers,
  mobileCardMetrics,
  props,
  showCardActions,
  showToggleButton,
  showVisibleProductMenuButton,
  t,
}: {
  handlers: {
    onToggleSelected: (event: MouseEvent<HTMLButtonElement>) => void;
    onProductMenuClick: (event: MouseEvent<HTMLButtonElement>) => void;
    stopPropagation: (event: MouseEvent<HTMLElement>) => void;
  };
  mobileCardMetrics: ReturnType<typeof getMobileCardMetrics>;
  props: NormalizedClothingCardProps;
  showCardActions: boolean;
  showToggleButton: boolean;
  showVisibleProductMenuButton: boolean;
  t: TranslationGetter;
}) {
  if (!showCardActions) {
    return null;
  }

  const selectionToggleLabel =
    props.selectionToggleLabel || t("main.partialRegenerateToggle");

  return {
    ...buildCardActionState({
      isMobile: props.isMobile,
      isSelected: props.isSelected,
      isRegenerating: props.isRegenerating,
      regenerationLockedReason: props.regenerationLockedReason,
      selectionToggleIcon: props.selectionToggleIcon,
      selectionToggleLabel,
      showToggleButton,
      showProductMenuButton: showVisibleProductMenuButton,
      mobileCardMetrics,
    }),
    ...handlers,
    t,
  };
}

function useCardInteractionState({
  mobileCardMetrics,
  productMenuKey,
  props,
  t,
}: {
  mobileCardMetrics: ReturnType<typeof getMobileCardMetrics>;
  productMenuKey: string;
  props: NormalizedClothingCardProps;
  t: TranslationGetter;
}) {
  const actionVisibility = getCardActionVisibility({
    ...props,
    productMenuKey,
  });
  const mobileLongPress = useMobileLongPressMenu({
    enabled: props.isMobile && actionVisibility.showProductMenuButton,
    item: props.item,
    onOpen: props.onProductMenuOpen,
    productMenuKey,
  });
  const handleCardClick = buildCardClickHandler(props);
  const handleProductMenuClick = (event: MouseEvent<HTMLButtonElement>) => {
    stopCardActionPropagation(event);
    if (productMenuKey && typeof props.onProductMenuOpen === "function") {
      props.onProductMenuOpen(event.currentTarget, productMenuKey, props.item, {
        presentation: "anchored",
      });
    }
  };
  const handleToggleSelected = (event: MouseEvent<HTMLButtonElement>) => {
    stopCardActionPropagation(event);
    if (
      !props.isRegenerating &&
      !props.regenerationLockedReason &&
      typeof props.onToggleSelected === "function"
    ) {
      props.onToggleSelected(props.item);
    }
  };

  return {
    actionProps: buildActionProps({
      handlers: {
        onToggleSelected: handleToggleSelected,
        onProductMenuClick: handleProductMenuClick,
        stopPropagation: stopCardActionPropagation,
      },
      mobileCardMetrics,
      props,
      t,
      ...actionVisibility,
    }),
    isPressing: mobileLongPress.isPressing,
    onCardClick: buildLongPressGuardedClick(
      handleCardClick,
      mobileLongPress.shouldSuppressClick,
    ),
    onContextMenuOpen:
      props.isMobile && actionVisibility.showProductMenuButton
        ? mobileLongPress.openMobileMenu
        : undefined,
    pointerHandlers: mobileLongPress.pointerHandlers,
    showCardActions: actionVisibility.showCardActions,
  };
}

function buildLongPressGuardedClick(
  onCardClick: (() => void) | undefined,
  shouldSuppressClick: () => boolean,
) {
  if (!onCardClick) {
    return undefined;
  }

  return () => {
    if (!shouldSuppressClick()) {
      onCardClick();
    }
  };
}

function useClothingCardViewProps(
  props: ClothingCardProps,
  t: TranslationGetter,
): ClothingCardViewProps {
  const normalizedProps = normalizeClothingCardProps(props);
  const productMenuKey = getProductMenuKey({
    allowProductMenuWithoutUrl: normalizedProps.allowProductMenuWithoutUrl,
    item: normalizedProps.item,
    productUrl: getSafeHttpUrl(normalizedProps.item?.url),
  });
  const displayState = useCardDisplayState(normalizedProps, t);
  const interactionState = useCardInteractionState({
    mobileCardMetrics: displayState.mobileCardMetrics,
    productMenuKey,
    props: normalizedProps,
    t,
  });

  return {
    item: normalizedProps.item,
    displayImageSource: displayState.imageState.displayImageSource,
    showImageNotFound: displayState.imageState.imageMode === "missing",
    showImagePlaceholder: displayState.imageState.imageMode !== "loading",
    disableImageGestures: normalizedProps.disableImageGestures,
    label: displayState.label,
    isMobile: normalizedProps.isMobile,
    mobileColumns: normalizedProps.mobileColumns,
    isSelected: normalizedProps.isSelected,
    categoryName: displayState.categoryName,
    categoryDisplayLabel: displayState.categoryDisplayLabel,
    isSavedToWardrobe: displayState.savedToWardrobe,
    badgeLabels: displayState.badgeLabels,
    mobileCardMetrics: displayState.mobileCardMetrics,
    onImageError: displayState.imageState.handleImageError,
    ...interactionState,
    ...interactionState.pointerHandlers,
  };
}

export { useClothingCardViewProps };
