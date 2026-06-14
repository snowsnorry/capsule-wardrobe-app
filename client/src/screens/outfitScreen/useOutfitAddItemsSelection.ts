import { useEffect, useRef, useState } from "react";
import type { OutfitItemSnapshot } from "../../app/appTypes";
import { getOutfitItemKey } from "./outfitItemMappers";

function mergeSelectedSnapshots(
  current: OutfitItemSnapshot[],
  next: OutfitItemSnapshot[],
) {
  const byKey = new Map<string, OutfitItemSnapshot>();
  [...next, ...current].forEach((item) => {
    const key = getOutfitItemKey(item);
    if (key && !byKey.has(key)) {
      byKey.set(key, item);
    }
  });
  return [...byKey.values()];
}

function useOutfitAddItemsSelection({
  existingItems,
  initialItems,
  maxSelected,
  open,
}: {
  existingItems: OutfitItemSnapshot[];
  initialItems: OutfitItemSnapshot[];
  maxSelected: number | null;
  open: boolean;
}) {
  const [selected, setSelected] = useState<OutfitItemSnapshot[]>([]);
  const wasOpenRef = useRef(false);
  const selectionTouchedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      selectionTouchedRef.current = false;
      return;
    }
    if (wasOpenRef.current) {
      setSelected((current) =>
        selectionTouchedRef.current
          ? mergeSelectedSnapshots(current, initialItems)
          : initialItems,
      );
      return;
    }
    wasOpenRef.current = true;
    selectionTouchedRef.current = false;
    setSelected(initialItems);
  }, [initialItems, open]);

  const selectedKeys = new Set(selected.map(getOutfitItemKey));
  const existingKeys = new Set(existingItems.map(getOutfitItemKey));
  const maxSelectedReached =
    typeof maxSelected === "number" && selected.length >= maxSelected;
  const personalCount = selected.filter(
    (item) => item.source === "uploaded",
  ).length;
  const catalogCount = selected.filter(
    (item) => item.source === "from_catalog",
  ).length;

  const toggle = (snapshot: OutfitItemSnapshot | null) => {
    const key = getOutfitItemKey(snapshot);
    if (!snapshot || !key || existingKeys.has(key)) return;
    selectionTouchedRef.current = true;
    setSelected((current) =>
      current.some((item) => getOutfitItemKey(item) === key)
        ? current.filter((item) => getOutfitItemKey(item) !== key)
        : typeof maxSelected === "number" && current.length >= maxSelected
          ? current
          : [...current, snapshot],
    );
  };

  return {
    catalogCount,
    existingKeys,
    maxSelectedReached,
    personalCount,
    selected,
    selectedKeys,
    toggle,
  };
}

export { mergeSelectedSnapshots, useOutfitAddItemsSelection };
