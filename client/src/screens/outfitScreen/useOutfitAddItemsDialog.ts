import { useEffect, useState } from "react";
import type { OutfitItemSnapshot } from "../../app/appTypes";
import type { Translate } from "../../components/ProfileFiltersAnchorTypes";
import {
  CATALOG_PICKER_PAGE_SIZE,
  getAppliedCatalogSearchState,
  getCatalogMobileFiltersDraft,
  getResetCatalogSearchState,
  useOutfitCatalogPicker,
} from "./useOutfitCatalogPicker";
import {
  mergeSelectedSnapshots,
  useOutfitAddItemsSelection,
} from "./useOutfitAddItemsSelection";
import { useOutfitPersonalPicker } from "./useOutfitPersonalPicker";

const EMPTY_INITIAL_ITEMS: OutfitItemSnapshot[] = [];
type OutfitAddItemsDialogModel = ReturnType<typeof useOutfitAddItemsDialog>;

export function useOutfitAddItemsDialog({
  existingItems,
  initialItems,
  locale,
  maxSelected,
  open,
  t,
}: {
  existingItems: OutfitItemSnapshot[];
  initialItems: OutfitItemSnapshot[];
  locale: string;
  maxSelected: number | null;
  open: boolean;
  t: Translate;
}) {
  const [tab, setTab] = useState(0);
  const personalPicker = useOutfitPersonalPicker(open);
  const catalogPicker = useOutfitCatalogPicker({ locale, open, t, tab });
  const selection = useOutfitAddItemsSelection({
    existingItems,
    initialItems,
    maxSelected,
    open,
  });

  useEffect(() => {
    setTab(0);
  }, [open]);

  return {
    setTab,
    tab,
    ...catalogPicker,
    ...personalPicker,
    ...selection,
  };
}

export {
  CATALOG_PICKER_PAGE_SIZE,
  EMPTY_INITIAL_ITEMS,
  getAppliedCatalogSearchState,
  getCatalogMobileFiltersDraft,
  getResetCatalogSearchState,
  mergeSelectedSnapshots,
};
export type { OutfitAddItemsDialogModel };
