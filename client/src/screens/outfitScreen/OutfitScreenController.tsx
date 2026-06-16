import { useMemo, useState } from "react";
import { useMediaQuery } from "@mui/material";
import { resolveOutfitSetImageSrc } from "../mainScreen/MainScreenHelpers";
import type { OutfitItemSnapshot } from "../../app/appTypes";
import type { MobileCardColumns } from "../mainScreen/MainScreenTypes";
import type { NameDialogState } from "../mainScreen/MainScreenDialogsTypes";
import { useI18n } from "../../i18n/useI18n";
import {
  getHighlightedReportItemKeys,
  makeOutfitNameDialog,
} from "./OutfitScreenHelpers";
import {
  readStoredOutfitMobileCardColumns,
  writeStoredOutfitMobileCardColumns,
} from "./outfitCardLayoutStorage";
import {
  getOutfitItemKey,
  getOutfitItems,
  sortOutfitItemSnapshots,
} from "./outfitItemMappers";
import type { ItemMenuState, OutfitScreenProps } from "./OutfitScreenTypes";
import { useOutfitConfirmActions } from "./useOutfitConfirmActions";
import { useOutfitNameDialogProps } from "./useOutfitNameDialogProps";
import { useOutfitPreview } from "./useOutfitPreview";
import { useOutfitReportState } from "./useOutfitReportState";
import { OutfitScreenView } from "./OutfitScreenView";
import type { OutfitScreenViewProps } from "./OutfitScreenView";

type ReplaceItems = (nextItems: OutfitItemSnapshot[]) => void;
type PreviewActions = ReturnType<typeof useOutfitPreview>;
type ConfirmActions = ReturnType<typeof useOutfitConfirmActions>;
type OutfitScreenState = ReturnType<typeof useOutfitScreenState>;

type BuildViewPropsContext = {
  confirm: ConfirmActions;
  preview: PreviewActions;
  props: OutfitScreenProps;
  replaceItems: ReplaceItems;
  screen: OutfitScreenState;
  toggleSelected: (key: string) => void;
  updateMobileCardColumns: (value: MobileCardColumns) => void;
};

export function OutfitScreenController(props: OutfitScreenProps) {
  const viewProps = useOutfitScreenViewProps(props);

  return <OutfitScreenView {...viewProps} />;
}

function useOutfitScreenViewProps(
  props: OutfitScreenProps,
): OutfitScreenViewProps {
  const screen = useOutfitScreenState(props);
  const replaceItems = (nextItems: OutfitItemSnapshot[]) => {
    if (props.activeOutfit?.id) {
      void props.onReplaceOutfitItems(props.activeOutfit.id, nextItems);
    }
  };
  const preview = useOutfitPreview({
    items: screen.items,
    onSetItemLike: props.onSetItemLike,
    onUpdateUploadedWardrobeItem: props.onUpdateUploadedWardrobeItem,
    replaceItems,
  });
  const confirm = useOutfitConfirmActions({
    activeOutfit: props.activeOutfit,
    items: screen.items,
    onDeleteOutfit: props.onDeleteOutfit,
    onDeleteOutfitImage: props.onDeleteOutfitImage,
    onRevertOutfit: props.onRevertOutfit,
    replaceItems,
    selectedKeys: screen.selectedKeys,
    setSelectedKeys: screen.setSelectedKeys,
  });
  const updateMobileCardColumns = (value: MobileCardColumns) => {
    screen.setMobileCardColumns(value);
    writeStoredOutfitMobileCardColumns(value);
  };
  const toggleSelected = (key: string) => {
    screen.setSelectedKeys((current) =>
      current.includes(key)
        ? current.filter((selectedKey) => selectedKey !== key)
        : [...current, key],
    );
  };

  return buildOutfitScreenViewProps({
    confirm,
    preview,
    props,
    replaceItems,
    screen,
    toggleSelected,
    updateMobileCardColumns,
  });
}

function useOutfitScreenState({
  activeOutfit,
  isReportPending = false,
  onDeleteOutfit,
  onDownloadOutfitPdf,
  onDuplicateOutfit,
  onRenameOutfit,
  onRevertOutfit,
  onSaveOutfit,
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
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [mobileCardColumns, setMobileCardColumns] = useState<MobileCardColumns>(
    () => readStoredOutfitMobileCardColumns(),
  );
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [nameDialog, setNameDialog] = useState<NameDialogState>({
    type: "",
    capsuleId: "",
    value: "",
  });
  const [highlightedReportItemIds, setHighlightedReportItemIds] = useState<
    string[]
  >([]);
  const items = useMemo(() => getOutfitItems(activeOutfit), [activeOutfit]);
  const visibleItems = useMemo(() => sortOutfitItemSnapshots(items), [items]);
  const reportState = useOutfitReportState({
    activeOutfit,
    isMobile,
    isReportInspectorLayout,
    visibleItems,
  });
  const highlightedReportItemKeys = useMemo(
    () => getHighlightedReportItemKeys(visibleItems, highlightedReportItemIds),
    [highlightedReportItemIds, visibleItems],
  );
  const outfitImage = activeOutfit?.effective?.image || null;
  const outfitImageSrc = resolveOutfitSetImageSrc(outfitImage);
  const nameDialogProps = useOutfitNameDialogProps({
    activeOutfit,
    onDeleteOutfit,
    onDownloadOutfitPdf,
    onDuplicateOutfit,
    onRenameOutfit,
    onRevertOutfit,
    onSaveOutfit,
  });

  return {
    ...reportState,
    highlightedReportItemKeys,
    imageDialogOpen,
    isAddOpen,
    isMobile,
    isReportPending,
    itemMenu,
    items,
    locale,
    menuAnchor,
    mobileCardColumns,
    nameDialog,
    nameDialogProps,
    outfitImageSrc,
    selectedKeys,
    setHighlightedReportItemIds,
    setImageDialogOpen,
    setIsAddOpen,
    setItemMenu,
    setMenuAnchor,
    setMobileCardColumns,
    setNameDialog,
    setSelectedKeys,
    t,
    visibleItems,
  };
}

function buildOutfitScreenViewProps(
  context: BuildViewPropsContext,
): OutfitScreenViewProps {
  return {
    floatingReportProps: buildReportProps(context, {
      showFloatingReportInspector: context.screen.showFloatingReportInspector,
      showInlineCompactReport: false,
    }),
    headerProps: buildHeaderProps(context),
    overlayProps: buildOverlayProps(context),
    scrollContentProps: {
      mainContentProps: buildMainContentProps(context),
      reportProps: buildReportProps(context, {
        showFloatingReportInspector: false,
        showInlineCompactReport: context.screen.showInlineCompactReport,
      }),
    },
  };
}

function buildHeaderProps({ confirm, props, screen }: BuildViewPropsContext) {
  return {
    activeOutfit: props.activeOutfit,
    hasReport: screen.hasReport,
    isContentBusy: props.isContentBusy,
    isMobile: screen.isMobile,
    isReportPending: screen.isReportPending,
    items: screen.visibleItems,
    onAdd: () => screen.setIsAddOpen(true),
    onAnalyze: () =>
      void props.onGenerateOutfitReport?.(props.activeOutfit?.id),
    onCancelSelection: () => screen.setSelectedKeys([]),
    onMenuOpen: screen.setMenuAnchor,
    onRemoveSelected: confirm.removeSelectedItems,
    onRenameOutfit: props.onRenameOutfit,
    selectedCount: screen.selectedKeys.length,
    t: screen.t,
  };
}

function buildReportProps(
  { props, screen }: BuildViewPropsContext,
  visibility: {
    showFloatingReportInspector: boolean;
    showInlineCompactReport: boolean;
  },
) {
  return {
    activeOutfit: props.activeOutfit,
    isContentBusy: props.isContentBusy,
    isReportPending: screen.isReportPending,
    onDeleteOutfitReport: props.onDeleteOutfitReport,
    onGenerateOutfitReport: props.onGenerateOutfitReport,
    onHighlightItemIds: screen.setHighlightedReportItemIds,
    report: screen.report,
    reportIsStale: screen.reportIsStale,
    showFloatingReportInspector: visibility.showFloatingReportInspector,
    showInlineCompactReport: visibility.showInlineCompactReport,
    t: screen.t,
  };
}

function buildMainContentProps({
  confirm,
  preview,
  props,
  screen,
  toggleSelected,
}: BuildViewPropsContext) {
  return {
    activeOutfit: props.activeOutfit,
    highlightedReportItemKeys: screen.highlightedReportItemKeys,
    isContentBusy: props.isContentBusy,
    isImagePending: Boolean(props.isImagePending),
    isMobile: screen.isMobile,
    isSelectionMode: screen.selectedKeys.length > 0,
    mobileCardColumns: screen.mobileCardColumns,
    onGenerateOutfitImage: props.onGenerateOutfitImage,
    onOpenImageDialog: () => screen.setImageDialogOpen(true),
    onOpenItemMenu: screen.setItemMenu,
    onPreviewItem: preview.setPreviewItem,
    onRequestDeleteImage: () =>
      confirm.setConfirmDialog({ action: "delete-image", entry: null }),
    onToggleSelected: toggleSelected,
    outfitImageSrc: screen.outfitImageSrc,
    selectedKeys: screen.selectedKeys,
    showInlineCompactReport: screen.showInlineCompactReport,
    showOutfitImageActions: screen.showOutfitImageActions,
    t: screen.t,
    visibleItems: screen.visibleItems,
  };
}

function buildOverlayProps({
  confirm,
  preview,
  props,
  replaceItems,
  screen,
  updateMobileCardColumns,
}: BuildViewPropsContext) {
  return {
    activeOutfit: props.activeOutfit,
    canAnalyzeOutfit: screen.hasOutfitItems,
    confirmDialog: confirm.confirmDialog,
    existingItems: screen.items,
    imageDialogOpen: screen.imageDialogOpen,
    isAddOpen: screen.isAddOpen,
    isContentBusy: props.isContentBusy,
    isMobile: screen.isMobile,
    itemMenu: screen.itemMenu,
    locale: screen.locale,
    menuAnchor: screen.menuAnchor,
    mobileCardColumns: screen.mobileCardColumns,
    nameDialog: screen.nameDialog,
    nameDialogProps: screen.nameDialogProps,
    onAddItems: (nextItems: OutfitItemSnapshot[]) => {
      replaceItems([...screen.items, ...nextItems]);
      screen.setIsAddOpen(false);
    },
    onAnalyzeOutfit: () => {
      screen.setMenuAnchor(null);
      void props.onGenerateOutfitReport?.(props.activeOutfit?.id);
    },
    onApplyPreview: preview.applyUploadedProductDetail,
    onCloseAddItems: () => screen.setIsAddOpen(false),
    onClosePreview: preview.closePreview,
    onConfirm: confirm.confirmOutfitAction,
    onDownloadOutfitPdf: props.onDownloadOutfitPdf,
    onDuplicateOutfit: props.onDuplicateOutfit,
    onItemLike: props.onSetItemLike,
    onMenuClose: () => screen.setMenuAnchor(null),
    onNameDialogChange: screen.setNameDialog,
    onPreviewLike: preview.setPreviewItemLike,
    onReadPreviewMode: () => preview.setPreviewMode("read"),
    onRemoveEntry: confirm.removeEntry,
    onRemoveFromPersonalItems: props.onRemoveFromPersonalItems,
    onRequestDelete: () => {
      screen.setMenuAnchor(null);
      confirm.setConfirmDialog({ action: "delete", entry: null });
    },
    onRequestRename: () => {
      screen.setMenuAnchor(null);
      screen.setNameDialog(makeOutfitNameDialog("rename", props.activeOutfit));
    },
    onRequestRevert: () => {
      screen.setMenuAnchor(null);
      confirm.setConfirmDialog({ action: "revert", entry: null });
    },
    onSaveOutfit: props.onSaveOutfit,
    onSaveToPersonalItems: props.onSaveToPersonalItems,
    onSelectEntry: (entry: OutfitItemSnapshot) =>
      screen.setSelectedKeys((current) => [
        ...new Set([...current, getOutfitItemKey(entry)]),
      ]),
    onSetConfirmDialog: confirm.setConfirmDialog,
    onSetOutfitPin: props.onSetOutfitPin,
    onSetImageDialogOpen: screen.setImageDialogOpen,
    onSetItemMenu: screen.setItemMenu,
    onSetPreviewItem: preview.setPreviewItem,
    onSetPreviewMode: preview.setPreviewMode,
    onUpdateColumns: updateMobileCardColumns,
    outfitImageSrc: screen.outfitImageSrc,
    previewItem: preview.previewItem,
    previewMode: preview.previewMode,
    showAnalyze: screen.isMobile && !screen.hasReport,
    t: screen.t,
  };
}
