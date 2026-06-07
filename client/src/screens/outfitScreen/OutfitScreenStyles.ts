import { pickerGridSx } from "../../components/ProfileFiltersAnchorStyles";
import { MAIN_SCREEN_CONTENT_COLUMN_SX } from "../mainScreen/MainScreenHelpers";
import type { MobileCardColumns } from "../mainScreen/MainScreenTypes";

export const outfitScreenSx = {
  backgroundColor: "background.default",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  height: "100%",
  minHeight: 0,
  minWidth: 0,
  overflow: "hidden",
} as const;

export const outfitCardsScrollSx = {
  flex: 1,
  minHeight: 0,
  minWidth: 0,
  overflowX: "hidden",
  overflowY: "auto",
  overscrollBehaviorY: "contain",
  WebkitOverflowScrolling: "touch",
} as const;

export const outfitContentSx = {
  ...MAIN_SCREEN_CONTENT_COLUMN_SX,
  minWidth: 0,
} as const;

export const outfitHeaderSectionSx = {
  px: { xs: 2, md: 3 },
  pt: { xs: 1, md: 2.5 },
  pb: 0,
} as const;

export function buildOutfitGridSectionSx(mobileCardColumns: MobileCardColumns) {
  return {
    px:
      mobileCardColumns === 1
        ? { xs: 1.25, sm: 2, md: 3 }
        : { xs: 0, sm: 2, md: 3 },
    pt: { xs: 1.25, md: 2 },
    pb: 2,
  } as const;
}

export const catalogTabLayoutSx = {
  display: "grid",
  gridTemplateColumns: { xs: "1fr", md: "280px auto minmax(0, 1fr)" },
  gap: { xs: 2, md: 2 },
  alignItems: "stretch",
  flex: 1,
  minHeight: 0,
  overflow: "hidden",
} as const;

export const catalogDesktopFiltersSx = {
  display: { xs: "none", md: "block" },
  height: "100%",
  minHeight: 0,
  pr: 1,
  overflowY: "auto",
} as const;

export const catalogDesktopDividerSx = {
  display: { xs: "none", md: "block" },
  height: "100%",
} as const;

export const catalogResultsPaneSx = {
  minWidth: 0,
  minHeight: 0,
  height: "100%",
  overflow: "hidden",
} as const;

export const catalogResultsScrollSx = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  pr: 0.5,
} as const;

export const catalogPickerGridSx = {
  ...pickerGridSx,
  gridTemplateColumns: {
    xs: "1fr",
    sm: "1fr",
    md: "repeat(2, minmax(0, 1fr))",
  },
} as const;

export const catalogPaginationSx = {
  alignSelf: "center",
  maxWidth: "100%",
  flexShrink: 0,
  "& .MuiPagination-ul": {
    flexWrap: "nowrap",
    justifyContent: "center",
  },
} as const;

export const catalogMobileFiltersTitleSx = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 2,
  flexShrink: 0,
} as const;

export const catalogMobileFiltersContentSx = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
} as const;
