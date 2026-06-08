import type { ProfileFilterValue } from "./ProfileFiltersSidebarTypes";

export type Translate = (
  key: string,
  params?: Record<string, unknown>,
) => string;
export type AnchorSourceFilter = "all" | "uploaded" | "catalog";
export type AnchorTypeFilter = "all" | ProfileFilterValue;
export type AnchorItemRef = {
  source: "uploaded" | "from_catalog";
  url: string;
};

export type AnchorItem = {
  id: string;
  wardrobeId: number;
  url: string;
  name: string | null;
  imageUrl: string | null;
  category: string | null;
  isLiked: boolean;
  source: "uploaded" | "catalog";
};

export type ProfileFiltersAnchorSectionProps = {
  anchorPickerFullScreen?: boolean;
  disabled: boolean;
  selectedRefs: AnchorItemRef[];
  selectedIds: string[];
  onRefsChange?: (value: AnchorItemRef[]) => void;
  onLegacyIdsChange?: (value: string[]) => void;
  t: Translate;
  locale: string;
};
