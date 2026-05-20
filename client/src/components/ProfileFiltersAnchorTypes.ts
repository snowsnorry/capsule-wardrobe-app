import type { ProfileFilterValue } from "./ProfileFiltersSidebarTypes";

export type Translate = (
  key: string,
  params?: Record<string, unknown>,
) => string;
export type AnchorSourceFilter = "all" | "uploaded" | "catalog";
export type AnchorTypeFilter = "all" | ProfileFilterValue;

export type AnchorItem = {
  id: string;
  wardrobeId: number;
  url: string;
  name: string | null;
  imageUrl: string | null;
  category: string | null;
  source: "uploaded" | "catalog";
};

export type ProfileFiltersAnchorSectionProps = {
  anchorPickerFullScreen?: boolean;
  disabled: boolean;
  selectedIds: string[];
  onChange?: (value: string[]) => void;
  t: Translate;
  locale: string;
};

export const MAX_ANCHOR_ITEMS = 5;
