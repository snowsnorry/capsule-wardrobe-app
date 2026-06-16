import type { Dispatch, SetStateAction } from "react";
import CapsuleProductDetailDialog from "../mainScreen/CapsuleProductDetailDialog";
import { NameDialog } from "../mainScreen/MainScreenActionDialogs";
import { ImageDialog } from "../mainScreen/MainScreenMediaDialogs";
import { AddItemsDialog } from "../../components/AddItemsDialog";
import { isLikedItem } from "../../utils/likedItemState";
import type { UploadedWardrobeItemUpdatePayload } from "../../api/personalItems";
import type { OutfitItemSnapshot, WardrobeItem } from "../../app/appTypes";
import type {
  MainScreenProps,
  MobileCardColumns,
} from "../mainScreen/MainScreenTypes";
import type { NameDialogState } from "../mainScreen/MainScreenDialogsTypes";
import { OutfitItemMenu, OutfitMenu } from "./OutfitMenus";
import { OutfitConfirmDialog } from "./OutfitConfirmDialog";
import type { OutfitConfirmState } from "./OutfitConfirmDialog";
import { getOutfitItem } from "./outfitItemMappers";
import type {
  ItemMenuState,
  OutfitScreenProps,
  ProductDetailMode,
} from "./OutfitScreenTypes";

type Translate = (key: string, params?: Record<string, unknown>) => string;

export type OutfitScreenOverlaysProps = {
  activeOutfit: OutfitScreenProps["activeOutfit"];
  canAnalyzeOutfit: boolean;
  confirmDialog: OutfitConfirmState;
  existingItems: OutfitItemSnapshot[];
  imageDialogOpen: boolean;
  isAddOpen: boolean;
  isContentBusy: boolean;
  isMobile: boolean;
  itemMenu: ItemMenuState;
  locale: string;
  menuAnchor: HTMLElement | null;
  mobileCardColumns: MobileCardColumns;
  nameDialog: NameDialogState;
  nameDialogProps: MainScreenProps;
  onAddItems: (items: OutfitItemSnapshot[]) => void;
  onAnalyzeOutfit: () => void;
  onApplyPreview: (
    item: WardrobeItem,
    payload: UploadedWardrobeItemUpdatePayload,
  ) => Promise<void> | void;
  onCloseAddItems: () => void;
  onClosePreview: () => void;
  onConfirm: () => void;
  onDownloadOutfitPdf: OutfitScreenProps["onDownloadOutfitPdf"];
  onDuplicateOutfit: OutfitScreenProps["onDuplicateOutfit"];
  onItemLike: OutfitScreenProps["onSetItemLike"];
  onMenuClose: () => void;
  onNameDialogChange: Dispatch<SetStateAction<NameDialogState>>;
  onPreviewLike: (item: WardrobeItem, isLiked: boolean) => Promise<void> | void;
  onReadPreviewMode: () => void;
  onRemoveEntry: (entry: OutfitItemSnapshot) => void;
  onRemoveFromPersonalItems?: OutfitScreenProps["onRemoveFromPersonalItems"];
  onRequestDelete: () => void;
  onRequestRename: () => void;
  onRequestRevert: () => void;
  onSaveOutfit: OutfitScreenProps["onSaveOutfit"];
  onSaveToPersonalItems?: OutfitScreenProps["onSaveToPersonalItems"];
  onSelectEntry: (entry: OutfitItemSnapshot) => void;
  onSetOutfitPin?: OutfitScreenProps["onSetOutfitPin"];
  onSetConfirmDialog: Dispatch<SetStateAction<OutfitConfirmState>>;
  onSetImageDialogOpen: (open: boolean) => void;
  onSetItemMenu: Dispatch<SetStateAction<ItemMenuState>>;
  onSetPreviewItem: (item: WardrobeItem | null) => void;
  onSetPreviewMode: (mode: ProductDetailMode) => void;
  onUpdateColumns: (value: MobileCardColumns) => void;
  outfitImageSrc: string;
  previewItem: WardrobeItem | null;
  previewMode: ProductDetailMode;
  showAnalyze: boolean;
  t: Translate;
};

export function OutfitScreenOverlays(props: OutfitScreenOverlaysProps) {
  return (
    <>
      <OutfitMenuOverlay {...props} />
      <OutfitNameAndItemMenus {...props} />
      <OutfitConfirmAndAddDialogs {...props} />
      <OutfitPreviewDialog {...props} />
      <OutfitImageDialog {...props} />
    </>
  );
}

function OutfitMenuOverlay({
  activeOutfit,
  canAnalyzeOutfit,
  isContentBusy,
  isMobile,
  menuAnchor,
  mobileCardColumns,
  onAnalyzeOutfit,
  onDownloadOutfitPdf,
  onDuplicateOutfit,
  onMenuClose,
  onRequestDelete,
  onRequestRename,
  onRequestRevert,
  onSaveOutfit,
  onSetOutfitPin,
  onUpdateColumns,
  showAnalyze,
  t,
}: OutfitScreenOverlaysProps) {
  return (
    <OutfitMenu
      anchor={menuAnchor}
      canAnalyzeOutfit={canAnalyzeOutfit}
      disabled={isContentBusy}
      mobileCardColumns={mobileCardColumns}
      outfit={activeOutfit}
      onClose={onMenuClose}
      onAnalyze={onAnalyzeOutfit}
      onDelete={onRequestDelete}
      onDownload={() => {
        onMenuClose();
        void onDownloadOutfitPdf(activeOutfit?.id);
      }}
      onDuplicate={() => {
        onMenuClose();
        void onDuplicateOutfit(activeOutfit?.name || "", activeOutfit?.id);
      }}
      onMobileCardColumnsChange={onUpdateColumns}
      onRename={onRequestRename}
      onRevert={onRequestRevert}
      onSave={() => {
        onMenuClose();
        void onSaveOutfit(activeOutfit?.id);
      }}
      onSetPin={(pin) => {
        onMenuClose();
        void onSetOutfitPin?.(activeOutfit?.id, pin);
      }}
      showCardLayout={isMobile}
      showAnalyze={showAnalyze}
      t={t}
    />
  );
}

function OutfitNameAndItemMenus({
  isContentBusy,
  isMobile,
  itemMenu,
  nameDialog,
  nameDialogProps,
  onItemLike,
  onNameDialogChange,
  onRemoveEntry,
  onSelectEntry,
  onSetItemMenu,
  t,
}: OutfitScreenOverlaysProps) {
  return (
    <>
      <NameDialog
        state={nameDialog}
        copyPrefix="outfit"
        disabled={isContentBusy}
        isOverlay={isMobile}
        props={nameDialogProps}
        setState={onNameDialogChange}
      />
      <OutfitItemMenu
        menu={itemMenu}
        onClose={() => onSetItemMenu({ anchor: null, entry: null })}
        onLike={(entry) => {
          const item = getOutfitItem(entry);
          if (item) void onItemLike(item, !isLikedItem(item));
        }}
        onRemove={onRemoveEntry}
        onSelect={onSelectEntry}
        t={t}
      />
    </>
  );
}

function OutfitConfirmAndAddDialogs({
  confirmDialog,
  existingItems,
  isAddOpen,
  isContentBusy,
  isMobile,
  locale,
  onAddItems,
  onCloseAddItems,
  onConfirm,
  onSetConfirmDialog,
  t,
}: OutfitScreenOverlaysProps) {
  return (
    <>
      {confirmDialog.action ? (
        <OutfitConfirmDialog
          disabled={isContentBusy}
          isOverlay={isMobile}
          state={confirmDialog}
          t={t}
          onClose={() => onSetConfirmDialog({ action: "", entry: null })}
          onConfirm={onConfirm}
        />
      ) : null}
      <AddItemsDialog
        existingItems={existingItems}
        locale={locale}
        open={isAddOpen}
        onClose={onCloseAddItems}
        onAdd={onAddItems}
        t={t}
      />
    </>
  );
}

function OutfitPreviewDialog({
  isMobile,
  locale,
  onApplyPreview,
  onClosePreview,
  onPreviewLike,
  onReadPreviewMode,
  onRemoveFromPersonalItems,
  onSaveToPersonalItems,
  onSetPreviewItem,
  onSetPreviewMode,
  previewItem,
  previewMode,
  t,
}: OutfitScreenOverlaysProps) {
  return previewItem ? (
    <CapsuleProductDetailDialog
      item={previewItem}
      open={Boolean(previewItem)}
      mode={previewMode}
      isMobile={isMobile}
      locale={locale}
      t={t}
      onApply={onApplyPreview}
      onClose={onClosePreview}
      onEdit={(item) => {
        onSetPreviewItem(item);
        onSetPreviewMode("edit");
      }}
      onReadMode={onReadPreviewMode}
      onRemoveFromPersonalItems={onRemoveFromPersonalItems}
      onSaveToPersonalItems={onSaveToPersonalItems}
      onSetItemLike={onPreviewLike}
    />
  ) : null;
}

function OutfitImageDialog({
  imageDialogOpen,
  isContentBusy,
  onSetImageDialogOpen,
  outfitImageSrc,
}: OutfitScreenOverlaysProps) {
  return (
    <ImageDialog
      src={outfitImageSrc}
      label={1}
      disabled={isContentBusy}
      open={imageDialogOpen}
      setOpen={onSetImageDialogOpen}
    />
  );
}
