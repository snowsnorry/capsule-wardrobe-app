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

export { normalizeClothingCardProps };
export type { ClothingCardProps };
