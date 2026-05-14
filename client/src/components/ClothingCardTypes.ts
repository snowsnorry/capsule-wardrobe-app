import type { MouseEvent } from "react";

type ClothingCardItem = {
  id?: string | number | null;
  name?: string | null;
  category?: string | null;
  image_url?: string | null;
  url?: string | null;
  audience?: string | null;
  source?: string | null;
  isSavedToWardrobe?: boolean | null;
  is_saved_to_wardrobe?: boolean | null;
  savedToMyWardrobe?: boolean | null;
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

export type { CardActionProps, ClothingCardItem, MobileCardMetrics };
