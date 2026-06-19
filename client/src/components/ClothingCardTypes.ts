import type { MouseEvent } from "react";
import type {
  MobileContextMenuOpenOptions,
  MobileContextMenuOriginRect,
  MobileContextMenuPresentation,
} from "./MobileContextMenuTypes";

type ProductMenuPresentation = MobileContextMenuPresentation;
type ProductMenuOpenOptions = MobileContextMenuOpenOptions;

type SelectionToggleIcon = "check" | "thumb-down";

type ClothingCardItem = {
  id?: string | number | null;
  name?: string | null;
  brand?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  url?: string | null;
  audience?: string | null;
  season?: unknown;
  source?: string | null;
  processingStatus?: string | null;
  isLiked?: boolean | null;
  isSavedToWardrobe?: boolean | null;
  wardrobeId?: string | number | null;
};

type MobileCardMetrics = {
  actionOffset: number;
  detailPx: number;
  detailPt: number;
  detailPb: number;
  detailMinHeight: number;
  titleFontSize: string;
  titleLineHeight: number;
};

type CardActionProps = {
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
  mobileCardMetrics: MobileCardMetrics;
  onToggleSelected: (event: MouseEvent<HTMLButtonElement>) => void;
  onProductMenuClick: (event: MouseEvent<HTMLButtonElement>) => void;
  stopPropagation: (event: MouseEvent<HTMLElement>) => void;
  t: (key: string) => string;
};

export type {
  CardActionProps,
  ClothingCardItem,
  MobileCardMetrics,
  MobileContextMenuOriginRect,
  ProductMenuOpenOptions,
  ProductMenuPresentation,
  SelectionToggleIcon,
};
