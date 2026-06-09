/* eslint-disable complexity, max-lines, max-lines-per-function */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Button, IconButton, Stack, Typography } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { fetchPersonalItems } from "../api/personalItems";
import { fetchProductDetailByUrl } from "../api/search";
import type { OutfitItemSnapshot, WardrobeItem } from "../app/appTypes";
import { sortWardrobeItems } from "../../../shared/wardrobeOrder.js";
import { AnchorImage } from "./ProfileFiltersAnchorImage";
import { AddItemsDialog } from "./AddItemsDialog";
import {
  getAnchorCategoryLabel,
  getAnchorLabel,
  toAnchorItem,
} from "./ProfileFiltersAnchorUtils";
import type {
  AnchorItemRef,
  AnchorItem,
  ProfileFiltersAnchorSectionProps,
  Translate,
} from "./ProfileFiltersAnchorTypes";
import {
  getOutfitItemKey,
  toSnapshot,
} from "../screens/outfitScreen/outfitItemMappers";

function getAnchorRefKey(ref: AnchorItemRef) {
  return `${ref.source}\u0000${ref.url}`;
}

function getSnapshotRef(snapshot: OutfitItemSnapshot): AnchorItemRef | null {
  const source = snapshot.source;
  const url = String(snapshot.url || "").trim();
  return source && url ? { source, url } : null;
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
    name:
      String(item.name || item.title || item.productName || "").trim() || null,
    imageUrl: String(item.imageUrl || item.rawImageUrl || "").trim() || null,
    category: String(item.category || "").trim() || null,
    isLiked: item.isLiked === true,
    source: snapshot.source === "uploaded" ? "uploaded" : "catalog",
  };
}

function ProfileFiltersAnchorSection({
  anchorPickerFullScreen = false,
  disabled,
  selectedRefs,
  onRefsChange,
  t,
  locale,
}: ProfileFiltersAnchorSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
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
      const response = await fetchPersonalItems({ force: true });
      const nextItems = Array.isArray(response.items)
        ? (response.items as WardrobeItem[])
        : [];
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
    if (dialogOpen || selectedAnchorRefs.length > 0) {
      void loadItems();
    }
  }, [dialogOpen, loadItems, selectedAnchorRefs.length]);

  useEffect(() => {
    let current = true;
    async function loadSelectedCatalogItems() {
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
      const catalogItems = await Promise.all(
        missingCatalogRefs.map((ref) =>
          fetchProductDetailByUrl(ref.url).catch(() => null),
        ),
      );
      const catalogSnapshots = catalogItems
        .map((response, index) => {
          const item = response?.item || response?.product || response;
          if (!item || typeof item !== "object" || Array.isArray(item)) {
            return null;
          }
          return {
            source: "from_catalog",
            url: missingCatalogRefs[index].url,
            item: item as WardrobeItem,
          } as OutfitItemSnapshot;
        })
        .filter(Boolean) as OutfitItemSnapshot[];
      const snapshotAnchorItems = snapshots
        .map(snapshotToAnchorItem)
        .filter(Boolean) as AnchorItem[];
      const catalogAnchorItems = catalogSnapshots
        .map(snapshotToAnchorItem)
        .filter(Boolean) as AnchorItem[];
      if (current) {
        setSelectedItems([
          ...wardrobeAnchorItems,
          ...snapshotAnchorItems,
          ...catalogAnchorItems,
        ]);
        setSelectedSnapshots([...snapshots, ...catalogSnapshots]);
      }
    }
    void loadSelectedCatalogItems();
    return () => {
      current = false;
    };
  }, [items, selectedAnchorRefs]);

  const itemById = useMemo(
    () => new Map(selectedItems.map((item) => [item.id, item])),
    [selectedItems],
  );
  const initialItems = useMemo(() => selectedSnapshots, [selectedSnapshots]);
  const selectedDisplayKeys = selectedAnchorRefs.map(getAnchorRefKey);
  const canEdit = !disabled && Boolean(onRefsChange);

  return (
    <Stack spacing={1.5}>
      <AnchorSectionHeader t={t} />
      {selectedDisplayKeys.length === 0 ? (
        <AnchorEmptyButton
          canEdit={canEdit}
          t={t}
          onOpen={() => setDialogOpen(true)}
        />
      ) : (
        <AnchorSelectedRows
          canEdit={canEdit}
          itemById={itemById}
          locale={locale}
          selectedIds={selectedDisplayKeys}
          t={t}
          onEdit={() => setDialogOpen(true)}
          onChange={(nextKeys) => {
            const selectedKeySet = new Set(nextKeys);
            const nextRefs = selectedAnchorRefs.filter((ref) =>
              selectedKeySet.has(getAnchorRefKey(ref)),
            );
            onRefsChange?.(nextRefs);
          }}
        />
      )}
      <AddItemsDialog
        open={dialogOpen}
        existingItems={[]}
        initialItems={initialItems}
        locale={locale}
        maxSelected={5}
        fullScreenOverride={anchorPickerFullScreen ? true : null}
        allowEmptySelection
        actionLabel={t("capsule.anchors.apply")}
        t={t}
        onAdd={(nextItems) => {
          applySnapshots(nextItems, onRefsChange);
          setDialogOpen(false);
        }}
        onClose={() => setDialogOpen(false)}
      />
    </Stack>
  );
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

function applySnapshots(
  snapshots: OutfitItemSnapshot[],
  onRefsChange?: (value: AnchorItemRef[]) => void,
) {
  const refs = snapshots.map(getSnapshotRef).filter(Boolean) as AnchorItemRef[];
  onRefsChange?.(refs);
}

function AnchorSectionHeader({ t }: { t: Translate }) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        {t("capsule.anchors.title")}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t("capsule.anchors.hint")}
      </Typography>
    </Stack>
  );
}

function AnchorEmptyButton({
  canEdit,
  onOpen,
  t,
}: {
  canEdit: boolean;
  onOpen: () => void;
  t: Translate;
}) {
  return (
    <Button
      variant="outlined"
      color="inherit"
      startIcon={<AddRoundedIcon />}
      disabled={!canEdit}
      onClick={onOpen}
      sx={{ justifyContent: "center" }}
    >
      {t("capsule.anchors.add")}
    </Button>
  );
}

function AnchorSelectedRows({
  canEdit,
  itemById,
  locale,
  onChange,
  onEdit,
  selectedIds,
  t,
}: {
  canEdit: boolean;
  itemById: Map<string, AnchorItem>;
  locale: string;
  onChange?: (value: string[]) => void;
  onEdit: () => void;
  selectedIds: string[];
  t: Translate;
}) {
  return (
    <Stack spacing={1}>
      {selectedIds.map((id) => (
        <AnchorSelectedRow
          key={id}
          id={id}
          item={itemById.get(id) || null}
          disabled={!canEdit}
          locale={locale}
          t={t}
          onRemove={() =>
            onChange?.(selectedIds.filter((itemId) => itemId !== id))
          }
        />
      ))}
      <Button
        variant="outlined"
        color="inherit"
        startIcon={<AddRoundedIcon />}
        disabled={!canEdit}
        onClick={onEdit}
        sx={{ alignSelf: "flex-start" }}
      >
        {t("capsule.anchors.edit")}
      </Button>
    </Stack>
  );
}

function AnchorSelectedRow({
  disabled,
  id,
  item,
  locale,
  onRemove,
  t,
}: {
  disabled: boolean;
  id: string;
  item: AnchorItem | null;
  locale: string;
  onRemove: () => void;
  t: Translate;
}) {
  const label = getAnchorLabel(item, id, t);

  return (
    <Box sx={selectedRowSx}>
      <AnchorImage item={item} label={label} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
          {label}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {getAnchorCategoryLabel(item?.category || null, locale) || id}
        </Typography>
      </Box>
      <IconButton
        size="small"
        aria-label={t("capsule.anchors.remove", { name: label })}
        disabled={disabled}
        onClick={onRemove}
      >
        <CloseRoundedIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

const selectedRowSx = {
  display: "flex",
  alignItems: "center",
  gap: 1.25,
  minWidth: 0,
  p: 0.75,
  border: "1px solid",
  borderColor: "divider",
  borderRadius: "var(--cw-radius-card)",
  bgcolor: "background.paper",
} as const;

export default ProfileFiltersAnchorSection;
