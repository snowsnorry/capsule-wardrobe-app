import { isMobileCardColumns } from "./mainScreen/MainScreenHelpers";
import type { MobileCardColumns } from "./mainScreen/MainScreenTypes";
import type { WardrobeFilter } from "./WardrobeToolbar";

const WARDROBE_MOBILE_CARD_COLUMNS_STORAGE_KEY = "wardrobe.mobileCardColumns";
const WARDROBE_FILTERS_STORAGE_KEY = "wardrobe.filters";

type StoredWardrobeFilters = {
  filter: WardrobeFilter;
  likedOnly: boolean;
};

const DEFAULT_WARDROBE_FILTERS: StoredWardrobeFilters = {
  filter: "all",
  likedOnly: false,
};

function readStoredWardrobeMobileCardColumns(): MobileCardColumns {
  if (typeof window === "undefined") {
    return 2;
  }

  const parsed = Number(
    window.localStorage?.getItem(WARDROBE_MOBILE_CARD_COLUMNS_STORAGE_KEY),
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

function readStoredWardrobeFilters(): StoredWardrobeFilters {
  if (typeof window === "undefined") {
    return DEFAULT_WARDROBE_FILTERS;
  }

  try {
    const parsed = JSON.parse(
      window.localStorage?.getItem(WARDROBE_FILTERS_STORAGE_KEY) || "{}",
    ) as Partial<StoredWardrobeFilters>;
    return {
      filter: isWardrobeFilter(parsed.filter)
        ? parsed.filter
        : DEFAULT_WARDROBE_FILTERS.filter,
      likedOnly:
        typeof parsed.likedOnly === "boolean"
          ? parsed.likedOnly
          : DEFAULT_WARDROBE_FILTERS.likedOnly,
    };
  } catch {
    return DEFAULT_WARDROBE_FILTERS;
  }
}

function writeStoredWardrobeFilters(value: StoredWardrobeFilters) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage?.setItem(
    WARDROBE_FILTERS_STORAGE_KEY,
    JSON.stringify(value),
  );
}

function isWardrobeFilter(value: unknown): value is WardrobeFilter {
  return value === "all" || value === "uploaded" || value === "from_catalog";
}

export {
  WARDROBE_FILTERS_STORAGE_KEY,
  readStoredWardrobeFilters,
  readStoredWardrobeMobileCardColumns,
  writeStoredWardrobeFilters,
  writeStoredWardrobeMobileCardColumns,
};
