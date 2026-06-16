import type { PointerEvent as ReactPointerEvent } from "react";
import type { ClothingCardBadgeLabels } from "./ClothingCardCategoryChip";
import { ClothingCardDetails } from "./ClothingCardDetailsParts";
import {
  ClothingCardImageSection,
  type ClothingCardDisplayImageSource,
} from "./ClothingCardImageParts";
import { ClothingCardRoot } from "./ClothingCardRoot";
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

type ClothingCardViewProps = {
  item: ClothingCardItem;
  displayImageSource: ClothingCardDisplayImageSource | null;
  showImageNotFound: boolean;
  showImagePlaceholder: boolean;
  disableImageGestures: boolean;
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
};

function ClothingCardView(props: ClothingCardViewProps) {
  return (
    <ClothingCardRoot
      isMobile={props.isMobile}
      mobileColumns={props.mobileColumns}
      isSelected={props.isSelected}
      showCardActions={props.showCardActions}
      label={props.label}
      onCardClick={props.onCardClick}
      onContextMenuOpen={props.onContextMenuOpen}
      onPointerCancel={props.onPointerCancel}
      onPointerDown={props.onPointerDown}
      onPointerLeave={props.onPointerLeave}
      onPointerMove={props.onPointerMove}
      onPointerUp={props.onPointerUp}
      isPressing={props.isPressing}
    >
      <ClothingCardImageSection
        item={props.item}
        displayImageSource={props.displayImageSource}
        showImageNotFound={props.showImageNotFound}
        showImagePlaceholder={props.showImagePlaceholder}
        disableImageGestures={props.disableImageGestures}
        label={props.label}
        isSelected={props.isSelected}
        isMobile={props.isMobile}
        categoryDisplayLabel={props.categoryDisplayLabel}
        badgeLabels={props.badgeLabels}
        actionProps={props.actionProps}
        onImageError={props.onImageError}
      />
      <ClothingCardDetails
        item={props.item}
        isMobile={props.isMobile}
        mobileCardMetrics={props.mobileCardMetrics}
        showMobileCategoryPrefix={
          props.isMobile && Boolean(props.categoryDisplayLabel)
        }
        categoryName={props.categoryName}
        categoryDisplayLabel={props.categoryDisplayLabel}
        isSavedToWardrobe={props.isSavedToWardrobe}
        savedToWardrobeLabel={props.badgeLabels.savedToWardrobeLabel}
      />
    </ClothingCardRoot>
  );
}

export { ClothingCardView, getMobileCardMetrics };
export type { ClothingCardViewProps };
