import { isMobileCardColumns } from "./mainScreen/MainScreenHelpers";
import type { MobileCardColumns } from "./mainScreen/MainScreenTypes";

const MY_WARDROBE_MOBILE_CARD_COLUMNS_STORAGE_KEY =
  "myWardrobe.mobileCardColumns";

function readStoredMyWardrobeMobileCardColumns(): MobileCardColumns {
  if (typeof window === "undefined") {
    return 2;
  }

  const parsed = Number(
    window.localStorage?.getItem(MY_WARDROBE_MOBILE_CARD_COLUMNS_STORAGE_KEY),
  );
  return isMobileCardColumns(parsed) ? parsed : 2;
}

function writeStoredMyWardrobeMobileCardColumns(value: MobileCardColumns) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage?.setItem(
    MY_WARDROBE_MOBILE_CARD_COLUMNS_STORAGE_KEY,
    String(value),
  );
}

export {
  readStoredMyWardrobeMobileCardColumns,
  writeStoredMyWardrobeMobileCardColumns,
};
