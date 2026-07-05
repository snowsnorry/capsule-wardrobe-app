import { useEffect, useState } from "react";
import type { PersonalItemSource } from "../../api/personalItems";
import type {
  AnchorSourceFilter,
  AnchorTypeFilter,
} from "../../components/ProfileFiltersAnchorTypes";
import type { WardrobeItem } from "../../app/appTypes";
import { usePaginatedPersonalItems } from "../../hooks/usePaginatedPersonalItems";
import {
  useOutfitPersonalItemTypeOptions,
  useVisibleOutfitPersonalItems,
} from "./outfitItemMappers";

function useOutfitPersonalPicker(open: boolean) {
  const [sourceFilter, setSourceFilter] = useState<AnchorSourceFilter>("all");
  const [likedOnly, setLikedOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState<AnchorTypeFilter>("all");
  const source = getPersonalItemSourceFilter(sourceFilter);
  const personalItems = usePaginatedPersonalItems<WardrobeItem>({
    enabled: open,
    likedOnly,
    source,
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    setSourceFilter("all");
    setLikedOnly(false);
    setTypeFilter("all");
  }, [open]);

  return {
    hasMorePersonalItems: personalItems.hasMore,
    likedOnly,
    loadMorePersonalItems: personalItems.loadMore,
    personalLoading: personalItems.isLoading,
    personalLoadingMore: personalItems.isLoadingMore,
    setLikedOnly,
    setSourceFilter,
    setTypeFilter,
    sourceFilter,
    typeFilter,
    typeOptions: useOutfitPersonalItemTypeOptions(personalItems.knownItems),
    visiblePersonalItems: useVisibleOutfitPersonalItems({
      items: personalItems.items,
      likedOnly,
      sourceFilter,
      typeFilter,
    }),
  };
}

function getPersonalItemSourceFilter(
  sourceFilter: AnchorSourceFilter,
): PersonalItemSource | null {
  if (sourceFilter === "uploaded") return "uploaded";
  if (sourceFilter === "catalog") return "from_catalog";
  return null;
}

export { useOutfitPersonalPicker };
