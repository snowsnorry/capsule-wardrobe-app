import type { MobileCardColumns } from "../mainScreen/MainScreenTypes";

const OUTFIT_MOBILE_CARD_COLUMNS_STORAGE_KEY = "outfit.mobileCardColumns";

function isMobileCardColumns(value: unknown): value is MobileCardColumns {
  return value === 1 || value === 2 || value === 3;
}

export function readStoredOutfitMobileCardColumns(): MobileCardColumns {
  if (typeof window === "undefined") {
    return 2;
  }

  const parsed = Number(
    window.localStorage?.getItem(OUTFIT_MOBILE_CARD_COLUMNS_STORAGE_KEY),
  );
  return isMobileCardColumns(parsed) ? parsed : 2;
}

export function writeStoredOutfitMobileCardColumns(value: MobileCardColumns) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage?.setItem(
    OUTFIT_MOBILE_CARD_COLUMNS_STORAGE_KEY,
    String(value),
  );
}
