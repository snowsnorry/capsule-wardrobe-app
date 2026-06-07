import { MAIN_SCREEN_CONTENT_COLUMN_SX } from "./mainScreen/MainScreenHelpers";

export const wardrobeScreenSx = {
  height: "100%",
  minHeight: 0,
  overflowX: "hidden",
  overflowY: "auto",
  overscrollBehaviorY: "contain",
  WebkitOverflowScrolling: "touch",
  pt: { xs: 0, md: 2 },
  pb: 2,
} as const;

export const wardrobeContentSx = {
  ...MAIN_SCREEN_CONTENT_COLUMN_SX,
  px: { xs: 2, md: 3 },
  boxSizing: "border-box",
  minWidth: 0,
  minHeight: "100%",
} as const;
