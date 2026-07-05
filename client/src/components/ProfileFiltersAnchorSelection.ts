import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchProductDetailByUrl } from "../api/search";
import type { OutfitItemSnapshot, WardrobeItem } from "../app/appTypes";
import { sortWardrobeItems } from "../../../shared/wardrobeOrder.js";
import { fetchAllPersonalItemsPages } from "../hooks/usePaginatedPersonalItems";
import {
  getOutfitItemKey,
  toSnapshot,
} from "../screens/outfitScreen/outfitItemMappers";
import { toAnchorItem } from "./ProfileFiltersAnchorUtils";
import type { AnchorItemRef, AnchorItem } from "./ProfileFiltersAnchorTypes";

function getAnchorRefKey(ref: AnchorItemRef) {
  return `${ref.source}\u0000${ref.url}`;
}

function getSnapshotRef(snapshot: OutfitItemSnapshot): AnchorItemRef | null {
  const source = snapshot.source;
  const url = String(snapshot.url || "").trim();
  return source && url ? { source, url } : null;
}

function getSnapshotItemName(item: WardrobeItem) {
  return String(item.name || item.title || item.productName || "").trim();
}

function getSnapshotItemImageUrl(item: WardrobeItem) {
  return String(item.imageUrl || item.rawImageUrl || "").trim();
}

function getSnapshotAnchorSource(snapshot: OutfitItemSnapshot) {
  return snapshot.source === "uploaded" ? "uploaded" : "catalog";
}

function normalizeAnchorRefs(refs: AnchorItemRef[] = []) {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = getAnchorRefKey(ref);
    if (!ref.url || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function snapshotToAnchorItem(snapshot: OutfitItemSnapshot): AnchorItem | null {
  const item = snapshot.item;
  if (!item) return null;
  return {
    id: getOutfitItemKey(snapshot),
    wardrobeId: Number(item.id || item.wardrobeId) || 0,
    url: snapshot.url,
    name: getSnapshotItemName(item) || null,
    imageUrl: getSnapshotItemImageUrl(item) || null,
    category: String(item.category || "").trim() || null,
    isLiked: item.isLiked === true,
    source: getSnapshotAnchorSource(snapshot),
  };
}

function buildInitialSnapshots({
  items,
  selectedRefs,
}: {
  items: WardrobeItem[];
  selectedRefs: AnchorItemRef[];
}) {
  const snapshotsByKey = new Map<string, OutfitItemSnapshot>();
  items.forEach((item) => {
    const personalSnapshot = toSnapshot(item, "personal");
    if (personalSnapshot) {
      snapshotsByKey.set(getOutfitItemKey(personalSnapshot), personalSnapshot);
    }
  });
  return selectedRefs
    .map((ref) => snapshotsByKey.get(getAnchorRefKey(ref)))
    .filter(Boolean) as OutfitItemSnapshot[];
}

async function fetchCatalogSnapshots(refs: AnchorItemRef[]) {
  const catalogItems = await Promise.all(
    refs.map((ref) => fetchProductDetailByUrl(ref.url).catch(() => null)),
  );
  return catalogItems
    .map((response, index) => {
      const item = response?.item || response?.product || response;
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }
      return {
        source: "from_catalog",
        url: refs[index].url,
        item: item as WardrobeItem,
      } as OutfitItemSnapshot;
    })
    .filter(Boolean) as OutfitItemSnapshot[];
}

export function refsForSelectedKeys(
  selectedRefs: AnchorItemRef[],
  selectedKeys: string[],
) {
  const selectedKeySet = new Set(selectedKeys);
  return selectedRefs.filter((ref) => selectedKeySet.has(getAnchorRefKey(ref)));
}

export function refsFromSnapshots(snapshots: OutfitItemSnapshot[]) {
  return snapshots.map(getSnapshotRef).filter(Boolean) as AnchorItemRef[];
}

export function useProfileFiltersAnchorSelection({
  selectedRefs,
}: {
  selectedRefs: AnchorItemRef[];
}) {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<AnchorItem[]>([]);
  const [selectedSnapshots, setSelectedSnapshots] = useState<
    OutfitItemSnapshot[]
  >([]);
  const selectedAnchorRefs = useMemo(
    () => normalizeAnchorRefs(selectedRefs),
    [selectedRefs],
  );
  const loadItems = useCallback(async () => {
    try {
      const nextItems = await fetchAllPersonalItemsPages<WardrobeItem>();
      setItems(
        sortWardrobeItems(
          nextItems as Parameters<typeof sortWardrobeItems>[0],
        ) as WardrobeItem[],
      );
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    if (selectedAnchorRefs.length > 0) {
      void loadItems();
    }
  }, [loadItems, selectedAnchorRefs.length]);

  useEffect(() => {
    let current = true;
    async function loadSelectedItems() {
      const wardrobeAnchorItems = items.map(toAnchorItem).filter(Boolean);
      const snapshots = buildInitialSnapshots({
        items,
        selectedRefs: selectedAnchorRefs,
      });
      const knownKeys = new Set(snapshots.map(getOutfitItemKey));
      const missingCatalogRefs = selectedAnchorRefs.filter(
        (ref) =>
          ref.source === "from_catalog" && !knownKeys.has(getAnchorRefKey(ref)),
      );
      const catalogSnapshots = await fetchCatalogSnapshots(missingCatalogRefs);
      const snapshotAnchorItems = snapshots.map(snapshotToAnchorItem);
      const catalogAnchorItems = catalogSnapshots.map(snapshotToAnchorItem);
      if (current) {
        setSelectedItems(
          [
            ...wardrobeAnchorItems,
            ...snapshotAnchorItems,
            ...catalogAnchorItems,
          ].filter(Boolean) as AnchorItem[],
        );
        setSelectedSnapshots([...snapshots, ...catalogSnapshots]);
      }
    }
    void loadSelectedItems();
    return () => {
      current = false;
    };
  }, [items, selectedAnchorRefs]);

  return {
    initialItems: selectedSnapshots,
    itemById: new Map(selectedItems.map((item) => [item.id, item])),
    loadItems,
    selectedAnchorRefs,
    selectedDisplayKeys: selectedAnchorRefs.map(getAnchorRefKey),
  };
}
