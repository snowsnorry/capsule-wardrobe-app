import { useEffect, useState } from "react";
import { fetchPersonalItems } from "../../api/personalItems";
import type {
  AnchorSourceFilter,
  AnchorTypeFilter,
} from "../../components/ProfileFiltersAnchorTypes";
import type { WardrobeItem } from "../../app/appTypes";
import {
  useOutfitPersonalItemTypeOptions,
  useVisibleOutfitPersonalItems,
} from "./outfitItemMappers";

function useOutfitPersonalPicker(open: boolean) {
  const [personalItems, setPersonalItems] = useState<WardrobeItem[]>([]);
  const [personalLoading, setPersonalLoading] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<AnchorSourceFilter>("all");
  const [likedOnly, setLikedOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState<AnchorTypeFilter>("all");

  useEffect(() => {
    if (!open) {
      return;
    }

    setSourceFilter("all");
    setLikedOnly(false);
    setTypeFilter("all");
    setPersonalLoading(true);
    void fetchPersonalItems({ force: true })
      .then((result) => {
        setPersonalItems(Array.isArray(result.items) ? result.items : []);
      })
      .catch(() => {
        setPersonalItems([]);
      })
      .finally(() => setPersonalLoading(false));
  }, [open]);

  return {
    likedOnly,
    personalLoading,
    setLikedOnly,
    setSourceFilter,
    setTypeFilter,
    sourceFilter,
    typeFilter,
    typeOptions: useOutfitPersonalItemTypeOptions(personalItems),
    visiblePersonalItems: useVisibleOutfitPersonalItems({
      items: personalItems,
      likedOnly,
      sourceFilter,
      typeFilter,
    }),
  };
}

export { useOutfitPersonalPicker };
