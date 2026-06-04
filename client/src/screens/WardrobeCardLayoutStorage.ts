import { isMobileCardColumns } from "./mainScreen/MainScreenHelpers";
import type { MobileCardColumns } from "./mainScreen/MainScreenTypes";

const WARDROBE_MOBILE_CARD_COLUMNS_STORAGE_KEY = "wardrobe.mobileCardColumns";
const LEGACY_WARDROBE_MOBILE_CARD_COLUMNS_STORAGE_KEY =
  "myWardrobe.mobileCardColumns";

function readStoredWardrobeMobileCardColumns(): MobileCardColumns {
  if (typeof window === "undefined") {
    return 2;
  }

  const parsed = Number(
    window.localStorage?.getItem(WARDROBE_MOBILE_CARD_COLUMNS_STORAGE_KEY) ??
      window.localStorage?.getItem(
        LEGACY_WARDROBE_MOBILE_CARD_COLUMNS_STORAGE_KEY,
      ),
  );
  return isMobileCardColumns(parsed) ? parsed : 2;
}

function writeStoredWardrobeMobileCardColumns(value: MobileCardColumns) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage?.setItem(
    WARDROBE_MOBILE_CARD_COLUMNS_STORAGE_KEY,
    String(value),
  );
}

export {
  readStoredWardrobeMobileCardColumns,
  writeStoredWardrobeMobileCardColumns,
};
