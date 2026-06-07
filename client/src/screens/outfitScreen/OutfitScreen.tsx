/* eslint-disable max-lines-per-function */
import { useEffect, useMemo, useRef, useState } from "react";
import { Box, useMediaQuery } from "@mui/material";
import type { UploadedWardrobeItemUpdatePayload } from "../../api/myWardrobe";
import CapsuleProductDetailDialog from "../mainScreen/CapsuleProductDetailDialog";
import {
  getCanonicalItemUrl,
  isLikedItem,
  patchLikedStateByUrl,
} from "../../utils/likedItemState";
import { isUploadedWardrobeItemNeedsReview } from "../../utils/uploadedWardrobeItemStatus";
import type { OutfitItemSnapshot, WardrobeItem } from "../../app/appTypes";
import type { MobileCardColumns } from "../mainScreen/MainScreenTypes";
import { useI18n } from "../../i18n/useI18n";
import { AddItemsDialog } from "./OutfitAddItemsDialog";
import { OutfitGrid } from "./OutfitGrid";
import { OutfitHeader } from "./OutfitHeader";
import { OutfitItemMenu, OutfitMenu } from "./OutfitMenus";
import {
  readStoredOutfitMobileCardColumns,
  writeStoredOutfitMobileCardColumns,
} from "./outfitCardLayoutStorage";
import {
  getOutfitItem,
  getOutfitItemKey,
  getOutfitItems,
  getPreviewItemKey,
  sortOutfitItemSnapshots,
} from "./outfitItemMappers";
import {
  outfitCardsScrollSx,
  outfitContentSx,
  outfitHeaderSectionSx,
  outfitScreenSx,
} from "./OutfitScreenStyles";
import type {
  ItemMenuState,
  OutfitScreenProps,
  ProductDetailMode,
} from "./OutfitScreenTypes";

function getPreviewComparableKey(item: WardrobeItem) {
  return getCanonicalItemUrl(item) || getPreviewItemKey(item);
}

export default function OutfitScreen({
  activeOutfit,
  isContentBusy,
  onDeleteOutfit,
  onDownloadOutfitPdf,
  onDuplicateOutfit,
  onRenameOutfit,
  onReplaceOutfitItems,
  onRemoveFromMyWardrobe,
  onRevertOutfit,
  onSaveToMyWardrobe,
  onSaveOutfit,
  onSetItemLike,
  onUpdateUploadedWardrobeItem,
}: OutfitScreenProps) {
  const { locale, t } = useI18n();
  const isMobile = useMediaQuery("(max-width:899px)");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [itemMenu, setItemMenu] = useState<ItemMenuState>({
    anchor: null,
    entry: null,
  });
  const [previewItem, setPreviewItem] = useState<WardrobeItem | null>(null);
  const [previewMode, setPreviewMode] = useState<ProductDetailMode>("read");
  const previewItemKeyRef = useRef("");
  const [mobileCardColumns, setMobileCardColumns] = useState<MobileCardColumns>(
    () => readStoredOutfitMobileCardColumns(),
  );
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const items = useMemo(() => getOutfitItems(activeOutfit), [activeOutfit]);
  const visibleItems = useMemo(() => sortOutfitItemSnapshots(items), [items]);
  const isSelectionMode = selectedKeys.length > 0;
  const previewItemKey = getPreviewItemKey(previewItem);

  useEffect(() => {
    if (!previewItemKey) {
      previewItemKeyRef.current = "";
      setPreviewMode("read");
      return;
    }

    if (previewItemKeyRef.current !== previewItemKey) {
      previewItemKeyRef.current = previewItemKey;
      setPreviewMode(
        isUploadedWardrobeItemNeedsReview(previewItem) ? "edit" : "read",
      );
    }
  }, [previewItemKey, previewItem]);

  const replaceItems = (nextItems: OutfitItemSnapshot[]) => {
    if (activeOutfit?.id) {
      void onReplaceOutfitItems(activeOutfit.id, nextItems);
    }
  };

  const updateMobileCardColumns = (value: MobileCardColumns) => {
    setMobileCardColumns(value);
    writeStoredOutfitMobileCardColumns(value);
  };

  const closePreview = () => {
    setPreviewItem(null);
    setPreviewMode("read");
  };

  const applyUploadedProductDetail = async (
    item: WardrobeItem,
    payload: UploadedWardrobeItemUpdatePayload,
  ) => {
    const updated = await onUpdateUploadedWardrobeItem?.(item, payload);
    const nextItem = updated || { ...item, ...payload };
    const comparableKey = getPreviewComparableKey(item);
    setPreviewItem(nextItem);
    setPreviewMode("read");
    replaceItems(
      items.map((entry) => {
        const item = getOutfitItem(entry);
        return item && getPreviewComparableKey(item) === comparableKey
          ? { ...entry, item: nextItem }
          : entry;
      }),
    );
  };

  const setPreviewItemLike = async (item: WardrobeItem, isLiked: boolean) => {
    const itemUrl = getCanonicalItemUrl(item);
    if (!itemUrl) return;

    const previousItem = previewItem;
    setPreviewItem(patchLikedStateByUrl(previewItem, itemUrl, isLiked));
    try {
      await onSetItemLike(item, isLiked);
    } catch (error) {
      setPreviewItem(previousItem);
      throw error;
    }
  };

  const removeEntry = (entry: OutfitItemSnapshot) => {
    if (window.confirm(t("outfit.confirmRemoveItem"))) {
      const key = getOutfitItemKey(entry);
      replaceItems(items.filter((item) => getOutfitItemKey(item) !== key));
    }
  };

  const removeSelectedItems = () => {
    if (window.confirm(t("outfit.confirmRemoveSelected"))) {
      replaceItems(
        items.filter((item) => !selectedKeys.includes(getOutfitItemKey(item))),
      );
      setSelectedKeys([]);
    }
  };

  const toggleSelected = (key: string) => {
    setSelectedKeys((current) =>
      current.includes(key)
        ? current.filter((selectedKey) => selectedKey !== key)
        : [...current, key],
    );
  };

  return (
    <Box data-testid="outfit-screen" sx={outfitScreenSx}>
      <Box data-testid="outfit-content" sx={outfitContentSx}>
        <Box sx={outfitHeaderSectionSx}>
          <OutfitHeader
            activeOutfit={activeOutfit}
            isContentBusy={isContentBusy}
            isMobile={isMobile}
            items={visibleItems}
            onAdd={() => setIsAddOpen(true)}
            onCancelSelection={() => setSelectedKeys([])}
            onMenuOpen={setMenuAnchor}
            onRenameOutfit={onRenameOutfit}
            onRemoveSelected={removeSelectedItems}
            selectedCount={selectedKeys.length}
            t={t}
          />
        </Box>
      </Box>
      <Box
        data-app-primary-scroll-target="true"
        data-testid="outfit-cards-scroll"
        sx={outfitCardsScrollSx}
      >
        <Box data-testid="outfit-cards-content" sx={outfitContentSx}>
          <OutfitGrid
            isMobile={isMobile}
            isSelectionMode={isSelectionMode}
            mobileCardColumns={mobileCardColumns}
            selectedKeys={selectedKeys}
            visibleItems={visibleItems}
            t={t}
            onItemMenuOpen={(anchor, entry, options) =>
              setItemMenu({
                anchor,
                entry,
                originRect: options.originRect,
                presentation: options.presentation,
              })
            }
            onPreviewItem={(entry) => setPreviewItem(getOutfitItem(entry))}
            onToggleSelected={toggleSelected}
          />
        </Box>
      </Box>
      <OutfitMenu
        anchor={menuAnchor}
        disabled={isContentBusy}
        mobileCardColumns={mobileCardColumns}
        outfit={activeOutfit}
        onClose={() => setMenuAnchor(null)}
        onDelete={() => {
          setMenuAnchor(null);
          if (window.confirm(t("outfit.confirmDelete")))
            void onDeleteOutfit(activeOutfit?.id);
        }}
        onDownload={() => {
          setMenuAnchor(null);
          void onDownloadOutfitPdf(activeOutfit?.id);
        }}
        onDuplicate={() => {
          setMenuAnchor(null);
          void onDuplicateOutfit(activeOutfit?.name || "", activeOutfit?.id);
        }}
        onMobileCardColumnsChange={updateMobileCardColumns}
        onRevert={() => {
          setMenuAnchor(null);
          if (window.confirm(t("outfit.confirmRevert")))
            void onRevertOutfit(activeOutfit?.id);
        }}
        onSave={() => {
          setMenuAnchor(null);
          void onSaveOutfit(activeOutfit?.id);
        }}
        showCardLayout={isMobile}
        t={t}
      />
      <OutfitItemMenu
        menu={itemMenu}
        onClose={() => setItemMenu({ anchor: null, entry: null })}
        onLike={(entry) => {
          const item = getOutfitItem(entry);
          if (item) void onSetItemLike(item, !isLikedItem(item));
        }}
        onRemove={removeEntry}
        onSelect={(entry) =>
          setSelectedKeys((current) => [
            ...new Set([...current, getOutfitItemKey(entry)]),
          ])
        }
        t={t}
      />
      <AddItemsDialog
        existingItems={items}
        locale={locale}
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onAdd={(nextItems) => {
          replaceItems([...items, ...nextItems]);
          setIsAddOpen(false);
        }}
        t={t}
      />
      {previewItem ? (
        <CapsuleProductDetailDialog
          item={previewItem}
          open={Boolean(previewItem)}
          mode={previewMode}
          isMobile={isMobile}
          locale={locale}
          t={t}
          onApply={applyUploadedProductDetail}
          onClose={closePreview}
          onEdit={(item) => {
            setPreviewItem(item);
            setPreviewMode("edit");
          }}
          onReadMode={() => setPreviewMode("read")}
          onRemoveFromMyWardrobe={onRemoveFromMyWardrobe}
          onSaveToMyWardrobe={onSaveToMyWardrobe}
          onSetItemLike={setPreviewItemLike}
        />
      ) : null}
    </Box>
  );
}
