/* eslint-disable max-lines, max-lines-per-function, complexity */
import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Divider, Stack, useMediaQuery } from "@mui/material";
import type { UploadedWardrobeItemUpdatePayload } from "../../api/personalItems";
import OutfitGeneratedImageBlock from "../../components/OutfitGeneratedImageBlock";
import CapsuleProductDetailDialog from "../mainScreen/CapsuleProductDetailDialog";
import { ImageDialog } from "../mainScreen/MainScreenMediaDialogs";
import { resolveOutfitSetImageSrc } from "../mainScreen/MainScreenHelpers";
import {
  getCanonicalItemUrl,
  isLikedItem,
  patchLikedStateByUrl,
} from "../../utils/likedItemState";
import { isUploadedWardrobeItemNeedsReview } from "../../utils/uploadedWardrobeItemStatus";
import type { OutfitItemSnapshot, WardrobeItem } from "../../app/appTypes";
import type { MobileCardColumns } from "../mainScreen/MainScreenTypes";
import { useI18n } from "../../i18n/useI18n";
import { AddItemsDialog } from "../../components/AddItemsDialog";
import { OutfitGrid } from "./OutfitGrid";
import { OutfitHeader } from "./OutfitHeader";
import { OutfitItemMenu, OutfitMenu } from "./OutfitMenus";
import OutfitReportPanel from "./OutfitReportPanel";
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
  outfitReportFloatingInspectorSx,
  outfitReportCompactSectionSx,
  outfitScreenSx,
} from "./OutfitScreenStyles";
import {
  OutfitConfirmDialog,
  type OutfitConfirmState,
} from "./OutfitConfirmDialog";
import type {
  ItemMenuState,
  OutfitScreenProps,
  ProductDetailMode,
} from "./OutfitScreenTypes";

function getPreviewComparableKey(item: WardrobeItem) {
  return getCanonicalItemUrl(item) || getPreviewItemKey(item);
}

function getReportItemCandidateIds(entry: OutfitItemSnapshot) {
  const item = getOutfitItem(entry);
  return [entry.url, item?.id, item?.wardrobeId, item?.url]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
}

function getHighlightedReportItemKeys(
  entries: OutfitItemSnapshot[],
  reportItemIds: string[],
) {
  const targetIds = new Set(
    reportItemIds.map((value) => String(value || "").trim()).filter(Boolean),
  );
  if (!targetIds.size) return [];

  return entries
    .filter((entry) =>
      getReportItemCandidateIds(entry).some((candidate) =>
        targetIds.has(candidate),
      ),
    )
    .map(getOutfitItemKey)
    .filter(Boolean);
}

export default function OutfitScreen({
  activeOutfit,
  isContentBusy,
  isImagePending,
  isReportPending = false,
  onDeleteOutfit,
  onDeleteOutfitImage,
  onDeleteOutfitReport,
  onDownloadOutfitPdf,
  onDuplicateOutfit,
  onGenerateOutfitImage,
  onGenerateOutfitReport,
  onRenameOutfit,
  onReplaceOutfitItems,
  onRemoveFromPersonalItems,
  onRevertOutfit,
  onSaveToPersonalItems,
  onSaveOutfit,
  onSetItemLike,
  onUpdateUploadedWardrobeItem,
}: OutfitScreenProps) {
  const { locale, t } = useI18n();
  const isMobile = useMediaQuery("(max-width:899px)");
  const isReportInspectorLayout = useMediaQuery("(min-width:1200px)");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [itemMenu, setItemMenu] = useState<ItemMenuState>({
    anchor: null,
    entry: null,
  });
  const [previewItem, setPreviewItem] = useState<WardrobeItem | null>(null);
  const [previewMode, setPreviewMode] = useState<ProductDetailMode>("read");
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const previewItemKeyRef = useRef("");
  const [mobileCardColumns, setMobileCardColumns] = useState<MobileCardColumns>(
    () => readStoredOutfitMobileCardColumns(),
  );
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<OutfitConfirmState>({
    action: "",
    entry: null,
  });
  const [highlightedReportItemIds, setHighlightedReportItemIds] = useState<
    string[]
  >([]);
  const items = useMemo(() => getOutfitItems(activeOutfit), [activeOutfit]);
  const visibleItems = useMemo(() => sortOutfitItemSnapshots(items), [items]);
  const report = activeOutfit?.effective?.report || null;
  const reportIsStale = Boolean(activeOutfit?.effective?.reportMeta?.stale);
  const hasReport = Boolean(report);
  const showFloatingReportInspector = Boolean(
    report && isReportInspectorLayout && !isMobile,
  );
  const highlightedReportItemKeys = useMemo(
    () => getHighlightedReportItemKeys(visibleItems, highlightedReportItemIds),
    [highlightedReportItemIds, visibleItems],
  );
  const outfitImage = activeOutfit?.effective?.image || null;
  const outfitImageSrc = resolveOutfitSetImageSrc(outfitImage);
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
    setConfirmDialog({ action: "remove-item", entry });
  };

  const removeSelectedItems = () => {
    setConfirmDialog({ action: "remove-selected", entry: null });
  };

  const confirmOutfitAction = () => {
    if (confirmDialog.action === "remove-item") {
      const key = getOutfitItemKey(confirmDialog.entry);
      replaceItems(items.filter((item) => getOutfitItemKey(item) !== key));
    } else if (confirmDialog.action === "remove-selected") {
      replaceItems(
        items.filter((item) => !selectedKeys.includes(getOutfitItemKey(item))),
      );
      setSelectedKeys([]);
    } else if (confirmDialog.action === "delete") {
      void onDeleteOutfit(activeOutfit?.id);
    } else if (confirmDialog.action === "delete-image") {
      void onDeleteOutfitImage?.(activeOutfit?.id);
    } else if (confirmDialog.action === "revert") {
      void onRevertOutfit(activeOutfit?.id);
    }
    setConfirmDialog({ action: "", entry: null });
  };

  const toggleSelected = (key: string) => {
    setSelectedKeys((current) =>
      current.includes(key)
        ? current.filter((selectedKey) => selectedKey !== key)
        : [...current, key],
    );
  };

  const renderOutfitMainContent = () => (
    <>
      <OutfitGrid
        disabled={isContentBusy}
        highlightedKeys={highlightedReportItemKeys}
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
      {activeOutfit ? (
        <>
          <Divider data-testid="outfit-set-image-divider" flexItem />
          <OutfitGeneratedImageBlock
            disabled={isContentBusy}
            imageObsolete={Boolean(activeOutfit.effective?.imageObsolete)}
            imageSrc={outfitImageSrc}
            isPending={isImagePending}
            label={1}
            onDelete={() =>
              setConfirmDialog({ action: "delete-image", entry: null })
            }
            onGenerate={() => void onGenerateOutfitImage?.(activeOutfit.id)}
            onImageClick={() => setImageDialogOpen(true)}
          />
        </>
      ) : null}
    </>
  );

  return (
    <Box data-testid="outfit-screen" sx={outfitScreenSx}>
      <Box data-testid="outfit-content" sx={outfitContentSx}>
        <Box sx={outfitHeaderSectionSx}>
          <OutfitHeader
            activeOutfit={activeOutfit}
            hasReport={hasReport}
            isContentBusy={isContentBusy}
            isReportPending={isReportPending}
            isMobile={isMobile}
            items={visibleItems}
            onAdd={() => setIsAddOpen(true)}
            onAnalyze={() => void onGenerateOutfitReport?.(activeOutfit?.id)}
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
        <Stack
          data-testid="outfit-cards-content"
          spacing={3}
          sx={outfitContentSx}
        >
          {report && !showFloatingReportInspector ? (
            <Box sx={outfitReportCompactSectionSx}>
              <OutfitReportPanel
                disabled={isContentBusy}
                isCompact
                isPending={isReportPending}
                isStale={reportIsStale}
                report={report}
                t={t}
                onDelete={() => void onDeleteOutfitReport?.(activeOutfit?.id)}
                onHighlightItemIds={setHighlightedReportItemIds}
                onRegenerate={() =>
                  void onGenerateOutfitReport?.(activeOutfit?.id)
                }
              />
            </Box>
          ) : null}
          {renderOutfitMainContent()}
        </Stack>
      </Box>
      {showFloatingReportInspector ? (
        <Box
          data-testid="outfit-report-floating-inspector"
          sx={outfitReportFloatingInspectorSx}
        >
          <OutfitReportPanel
            disabled={isContentBusy}
            isPending={isReportPending}
            isStale={reportIsStale}
            report={report!}
            t={t}
            onDelete={() => void onDeleteOutfitReport?.(activeOutfit?.id)}
            onHighlightItemIds={setHighlightedReportItemIds}
            onRegenerate={() => void onGenerateOutfitReport?.(activeOutfit?.id)}
          />
        </Box>
      ) : null}
      <OutfitMenu
        anchor={menuAnchor}
        disabled={isContentBusy}
        mobileCardColumns={mobileCardColumns}
        outfit={activeOutfit}
        onClose={() => setMenuAnchor(null)}
        onAnalyze={() => {
          setMenuAnchor(null);
          void onGenerateOutfitReport?.(activeOutfit?.id);
        }}
        onDelete={() => {
          setMenuAnchor(null);
          setConfirmDialog({ action: "delete", entry: null });
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
          setConfirmDialog({ action: "revert", entry: null });
        }}
        onSave={() => {
          setMenuAnchor(null);
          void onSaveOutfit(activeOutfit?.id);
        }}
        showCardLayout={isMobile}
        showAnalyze={isMobile && !hasReport}
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
      {confirmDialog.action ? (
        <OutfitConfirmDialog
          disabled={isContentBusy}
          isOverlay={isMobile}
          state={confirmDialog}
          t={t}
          onClose={() => setConfirmDialog({ action: "", entry: null })}
          onConfirm={confirmOutfitAction}
        />
      ) : null}
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
          onRemoveFromPersonalItems={onRemoveFromPersonalItems}
          onSaveToPersonalItems={onSaveToPersonalItems}
          onSetItemLike={setPreviewItemLike}
        />
      ) : null}
      <ImageDialog
        src={outfitImageSrc}
        label={1}
        disabled={isContentBusy}
        open={imageDialogOpen}
        setOpen={setImageDialogOpen}
      />
    </Box>
  );
}
