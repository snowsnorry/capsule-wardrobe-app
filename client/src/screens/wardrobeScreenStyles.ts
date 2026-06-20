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

const WARDROBE_REPORT_FLOATING_WIDTH_LG = 380;
const WARDROBE_REPORT_FLOATING_WIDTH_XL = 420;
const WARDROBE_REPORT_FLOATING_GAP = 24;
const WARDROBE_REPORT_FLOATING_INSET_LG = 16;
const WARDROBE_REPORT_FLOATING_INSET_XL = 24;

export const wardrobeReportFloatingInspectorSx = {
  position: "fixed",
  top: { lg: 16, xl: 20 },
  right: { lg: 16, xl: 24 },
  bottom: { lg: 16, xl: 20 },
  width: {
    lg: WARDROBE_REPORT_FLOATING_WIDTH_LG,
    xl: WARDROBE_REPORT_FLOATING_WIDTH_XL,
  },
  maxWidth: "calc(100% - 32px)",
  minHeight: 0,
  zIndex: 3,
} as const;

export const wardrobeWithFloatingReportSx = {
  pr: {
    lg: `${WARDROBE_REPORT_FLOATING_WIDTH_LG + WARDROBE_REPORT_FLOATING_GAP + WARDROBE_REPORT_FLOATING_INSET_LG}px`,
    xl: `${WARDROBE_REPORT_FLOATING_WIDTH_XL + WARDROBE_REPORT_FLOATING_GAP + WARDROBE_REPORT_FLOATING_INSET_XL}px`,
  },
} as const;

export const wardrobeReportCompactSectionSx = {
  pt: { xs: 0, md: 0.5 },
} as const;

export const wardrobeContentSx = {
  ...MAIN_SCREEN_CONTENT_COLUMN_SX,
  px: { xs: 2, md: 3 },
  boxSizing: "border-box",
  minWidth: 0,
  minHeight: "100%",
} as const;
