import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  Link,
  LinearProgress,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import DriveFileRenameOutlineRoundedIcon from "@mui/icons-material/DriveFileRenameOutlineRounded";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import FiberManualRecordRoundedIcon from "@mui/icons-material/FiberManualRecordRounded";
import useMediaQuery from "@mui/material/useMediaQuery";
import ProfileFiltersSidebar from "../components/ProfileFiltersSidebar";
import { useI18n } from "../i18n/useI18n";
import ClothingGridPlaceholder from "../components/ClothingGridPlaceholder";
import { ClothingPlaceholderCard } from "../components/ClothingGridPlaceholder";
import ClothingCard from "../components/ClothingCard";
import { sortWardrobeItems } from "../../../shared/wardrobeOrder.js";
import type { DialogProps } from "@mui/material/Dialog";

type CapsuleMenuAnchor = HTMLElement | null;
type AppNavigationOptions = {
  query?: string;
};
type CapsuleLike = {
  id?: string;
  name?: string;
  status?: string;
  draft?: unknown;
  saved?: unknown;
  updatedAt?: string;
};

type OutfitSetLike = {
  itemIds?: string[];
  image?: string | null;
  imageObsolete?: boolean;
};

type MainScreenItem = {
  id?: string | number;
  url?: string;
  name?: string;
  [key: string]: unknown;
};

type ScreenStatus = {
  loading: boolean;
  error: string;
  infoKey: string;
  infoParams: Record<string, unknown> | null;
};

type StyleOptions = {
  core: string[];
  aesthetics: string[];
};

type ResolvedOutfitSet = {
  id: string;
  index: number;
  label: number;
  items: MainScreenItem[];
  image: string | null;
  imageObsolete: boolean;
};

type MainScreenProps = {
  activeCapsule?: CapsuleLike | null;
  capsuleList?: CapsuleLike[];
  userEmail?: string;
  userName?: string;
  settingsProfile?: unknown;
  onSignOut?: () => void;
  onSaveSettings?: (settings: unknown) => Promise<void> | void;
  isSigningOut: boolean;
  onRefreshItems: () => Promise<void> | void;
  onDownloadPdf: (capsuleId?: string) => Promise<void> | void;
  onCreateCapsule?: () => Promise<void> | void;
  onOpenCapsule?: (capsuleId: string) => Promise<void> | void;
  onSaveCapsule?: (capsuleId?: string) => Promise<void> | void;
  onRevertCapsule?: (capsuleId?: string) => Promise<void> | void;
  onRenameCapsule?: (name: string, capsuleId?: string) => Promise<void> | void;
  onDuplicateCapsule?: (name: string, capsuleId?: string) => Promise<void> | void;
  onDeleteCapsule?: (capsuleId?: string) => Promise<void> | void;
  onShareCapsule?: (capsuleId?: string) => Promise<{ url?: string; expiresAt?: string | Date } | void> | { url?: string; expiresAt?: string | Date } | void;
  onSearchCapsules?: (query: string) => Promise<CapsuleLike[]> | CapsuleLike[];
  items: MainScreenItem[];
  outfitSets?: OutfitSetLike[];
  isLoadingItems: boolean;
  isContentBusy?: boolean;
  isDownloadingPdf: boolean;
  showAdditionalItemPlaceholder: boolean;
  styleOptions: StyleOptions;
  occasionOptions: string[];
  seasonOptions: string[];
  audienceOptions: string[];
  accentColorOptions: string[];
  patternOptions: string[];
  selectedStyleCore: string;
  selectedStyleAesthetic: string | null;
  selectedOccasions: string[];
  selectedSeasons: string[];
  selectedAudience: string;
  selectedAccentColor: string | null;
  selectedPattern: string | null;
  selectedText: string;
  hasFilterChanges: boolean;
  status: ScreenStatus;
  onSelectStyleCore: (value: string) => void;
  onSelectStyleAesthetic: (value: string | null) => void;
  onToggleOccasion: (value: string) => void;
  onToggleSeason: (value: string) => void;
  onSelectAudience: (value: string) => void;
  onSelectAccentColor: (value: string | null) => void;
  onSelectPattern: (value: string) => void;
  onTextChange: (value: string) => void;
  onApplyFilters: () => Promise<void> | void;
  onResetFilters: () => Promise<void> | void;
  onNavigateApp: (nextApp: "capsule" | "explore" | "statistics", options?: AppNavigationOptions) => void;
  selectedRegenerationUrls: string[];
  partialRegenerationPendingUrls: string[];
  pendingImageSetIndexes?: number[];
  onToggleRegenerationSelection: (item: MainScreenItem) => void;
  onCancelRegenerationSelection: () => void;
  onRegenerateSelectedItems: () => Promise<void> | void;
  onDeleteOutfitSetImage?: (setIndex: number) => Promise<void> | void;
  onGenerateOutfitSetImage?: (setIndex: number) => Promise<void> | void;
  isPartialRegenerationLoading: boolean;
  registerCapsuleSidebarActions?: (actions: {
    openSearchDialog: () => void;
    openCapsuleActions: (event: MouseEvent<HTMLElement>, capsule: CapsuleLike) => void;
  } | null) => void;
};

function highlightMatch(name: string | undefined, query: string | undefined): ReactNode {
  const label = String(name || "");
  const normalizedQuery = String(query || "").trim();
  if (!normalizedQuery) {
    return label;
  }

  const lower = label.toLowerCase();
  const index = lower.indexOf(normalizedQuery.toLowerCase());
  if (index === -1) {
    return label;
  }

  return (
    <>
      {label.slice(0, index)}
      <strong>{label.slice(index, index + normalizedQuery.length)}</strong>
      {label.slice(index + normalizedQuery.length)}
    </>
  );
}

function getCapsuleSectionLabel(updatedAt: string | undefined) {
  if (!updatedAt) {
    return "searchEarlier";
  }
  const diffMs = Date.now() - new Date(updatedAt).getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays < 7) {
    return "searchPrevious7Days";
  }
  if (diffDays < 30) {
    return "searchPrevious30Days";
  }
  return "searchEarlier";
}

function groupCapsules(items: CapsuleLike[] = []) {
  return items.reduce<Record<string, CapsuleLike[]>>((acc, item) => {
    const key = getCapsuleSectionLabel(item.updatedAt);
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});
}

function capsuleHasUnsavedChanges(capsule: CapsuleLike | null | undefined) {
  return capsule?.status === "new" || capsule?.status === "modified";
}

function capsuleHasShareableContent(capsule: CapsuleLike | null | undefined) {
  const snapshot = (capsule?.draft || capsule?.saved) as { data?: { wardrobe?: { items?: unknown[]; regeneration?: unknown } | null; regeneration?: unknown } } | null;
  const items = snapshot?.data?.wardrobe?.items;
  const regeneration = snapshot?.data?.regeneration;
  return Array.isArray(items) && items.length > 0 && !regeneration;
}

function capsuleCanRequestShare(capsule: CapsuleLike | null | undefined, { allowUnknownContent = false } = {}) {
  if (!capsule?.id) {
    return false;
  }

  if (capsule.draft || capsule.saved) {
    return capsuleHasShareableContent(capsule);
  }

  return allowUnknownContent;
}

function normalizeCapsuleName(name: string | undefined) {
  return String(name || "").trim();
}

function resolveOutfitSets(items: MainScreenItem[] = [], outfitSets: OutfitSetLike[] = []): ResolvedOutfitSet[] {
  const itemsById = new Map<string, MainScreenItem>(
    (Array.isArray(items) ? items : [])
      .map((item): [string, MainScreenItem] | null => {
        const id = String(item?.id || "").trim();
        return id ? [id, item] : null;
      })
      .filter((entry): entry is [string, MainScreenItem] => Boolean(entry))
  );

  return (Array.isArray(outfitSets) ? outfitSets : [])
    .map((set, index) => {
      const resolvedItems = sortWardrobeItems((Array.isArray(set?.itemIds) ? set.itemIds : [])
        .map((id) => itemsById.get(String(id || "").trim()))
        .filter((item): item is MainScreenItem => Boolean(item)));
      return resolvedItems.length >= 3
        ? {
          id: `set-${index + 1}`,
          index,
          label: index + 1,
          items: resolvedItems,
          image: typeof set?.image === "string" && set.image.trim().length > 0
            ? set.image.trim()
            : null,
          imageObsolete: Boolean(set?.imageObsolete)
        }
        : null;
    })
    .filter((set): set is ResolvedOutfitSet => Boolean(set));
}

function resolveOutfitSetImageSrc(image: string | null | undefined): string {
  const trimmed = String(image || "").trim();
  if (!trimmed) {
    return "";
  }
  return /^https?:\/\//i.test(trimmed) || /^data:image\//i.test(trimmed)
    ? trimmed
    : `data:image/png;base64,${trimmed}`;
}

const OUTFIT_SET_IMAGE_WIDTH = 896;
const OUTFIT_SET_IMAGE_HEIGHT = 1195;
const OUTFIT_SET_IMAGE_ASPECT_RATIO = `${OUTFIT_SET_IMAGE_WIDTH} / ${OUTFIT_SET_IMAGE_HEIGHT}`;
const OUTFIT_SET_IMAGE_PREVIEW_MAX_WIDTH = OUTFIT_SET_IMAGE_WIDTH / 2;

function CapsuleActionMenu({
  anchorEl,
  open,
  onClose,
  capsule,
  disabled = false,
  showRegenerateAll = false,
  onRegenerateAll,
  onDownloadPdf,
  onRename,
  onRevert,
  onSave,
  onDuplicate,
  onShare,
  allowUnknownShareContent = false,
  onDelete
}) {
  const { t } = useI18n();
  const canRevert = capsule?.status === "modified";
  const canSave = capsule?.status === "new" || capsule?.status === "modified";
  const canDuplicate = Boolean(capsule?.saved);
  const canShare = capsuleCanRequestShare(capsule, { allowUnknownContent: allowUnknownShareContent });
  const handleAction = (event: MouseEvent<HTMLElement>, action: () => void) => {
    event.currentTarget.blur();
    onClose();
    action();
  };

  return (
    <Menu anchorEl={anchorEl} open={open} onClose={onClose}>
      {showRegenerateAll ? (
        <>
          <MenuItem disabled={disabled} onClick={(event) => handleAction(event, () => onRegenerateAll?.())}>
            <ListItemIcon sx={{ visibility: "hidden" }} />
            {t("capsule.regenerateAll")}
          </MenuItem>
          <Divider />
        </>
      ) : null}
      <MenuItem disabled={disabled} onClick={(event) => handleAction(event, onDownloadPdf)}>
        <ListItemIcon><DownloadRoundedIcon fontSize="small" /></ListItemIcon>
        {t("capsule.exportPdf")}
      </MenuItem>
      {canShare ? (
        <MenuItem disabled={disabled} onClick={(event) => handleAction(event, onShare)}>
          <ListItemIcon><ShareRoundedIcon fontSize="small" /></ListItemIcon>
          {t("capsule.share")}
        </MenuItem>
      ) : null}
      <Divider />
      <MenuItem disabled={disabled} onClick={(event) => handleAction(event, onRename)}>
        <ListItemIcon><DriveFileRenameOutlineRoundedIcon fontSize="small" /></ListItemIcon>
        {t("capsule.rename")}
      </MenuItem>
      <Divider />
      <MenuItem disabled={disabled || !canRevert} onClick={(event) => handleAction(event, onRevert)}>
        <ListItemIcon><RestoreRoundedIcon fontSize="small" /></ListItemIcon>
        {t("capsule.revert")}
      </MenuItem>
      <MenuItem disabled={disabled || !canSave} onClick={(event) => handleAction(event, onSave)}>
        <ListItemIcon sx={{ visibility: "hidden" }} />
        {t("actions.save")}
      </MenuItem>
      {canDuplicate ? (
        <MenuItem disabled={disabled} onClick={(event) => handleAction(event, onDuplicate)}>
          <ListItemIcon sx={{ visibility: "hidden" }} />
          {t("capsule.saveAs")}
        </MenuItem>
      ) : null}
      <Divider />
      <MenuItem disabled={disabled} onClick={(event) => handleAction(event, onDelete)} sx={{ color: "error.main" }}>
        <ListItemIcon sx={{ color: "inherit" }}><DeleteOutlineRoundedIcon fontSize="small" /></ListItemIcon>
        {t("actions.delete")}
      </MenuItem>
    </Menu>
  );
}

function MainScreen({
  activeCapsule = null,
  capsuleList = [],
  isSigningOut,
  onRefreshItems,
  onDownloadPdf,
  onCreateCapsule = async () => {},
  onOpenCapsule = async () => {},
  onSaveCapsule = async () => {},
  onRevertCapsule = async () => {},
  onRenameCapsule = async () => {},
  onDuplicateCapsule = async () => {},
  onDeleteCapsule = async () => {},
  onShareCapsule = async () => {},
  onSearchCapsules = async () => [],
  items,
  outfitSets = [],
  isLoadingItems,
  isContentBusy = false,
  isDownloadingPdf,
  showAdditionalItemPlaceholder,
  styleOptions,
  occasionOptions,
  seasonOptions,
  audienceOptions,
  accentColorOptions,
  patternOptions,
  selectedStyleCore,
  selectedStyleAesthetic,
  selectedOccasions,
  selectedSeasons,
  selectedAudience,
  selectedAccentColor,
  selectedPattern,
  selectedText,
  hasFilterChanges,
  status,
  onSelectStyleCore,
  onSelectStyleAesthetic,
  onToggleOccasion,
  onToggleSeason,
  onSelectAudience,
  onSelectAccentColor,
  onSelectPattern,
  onTextChange,
  onApplyFilters,
  onResetFilters,
  onNavigateApp,
  selectedRegenerationUrls,
  partialRegenerationPendingUrls,
  pendingImageSetIndexes = [],
  onToggleRegenerationSelection,
  onCancelRegenerationSelection,
  onRegenerateSelectedItems,
  onDeleteOutfitSetImage = async () => {},
  onGenerateOutfitSetImage = () => {},
  isPartialRegenerationLoading,
  registerCapsuleSidebarActions
}: MainScreenProps) {
  const { t } = useI18n();
  const isOverlaySidebar = useMediaQuery("(max-width: 1279.95px)");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [headerMenuAnchor, setHeaderMenuAnchor] = useState<CapsuleMenuAnchor>(null);
  const [rowMenuAnchor, setRowMenuAnchor] = useState<CapsuleMenuAnchor>(null);
  const [rowMenuCapsule, setRowMenuCapsule] = useState<CapsuleLike | null>(null);
  const [productMenuAnchor, setProductMenuAnchor] = useState<CapsuleMenuAnchor>(null);
  const [productMenuUrl, setProductMenuUrl] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameCapsuleId, setRenameCapsuleId] = useState("");
  const [isInlineRenameActive, setIsInlineRenameActive] = useState(false);
  const [inlineRenameValue, setInlineRenameValue] = useState("");
  const [isInlineRenameSubmitting, setIsInlineRenameSubmitting] = useState(false);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveAsValue, setSaveAsValue] = useState("");
  const [saveAsCapsuleId, setSaveAsCapsuleId] = useState("");
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareExpiresAt, setShareExpiresAt] = useState<string | Date | null>(null);
  const [shareCapsuleName, setShareCapsuleName] = useState("");
  const [shareCopied, setShareCopied] = useState(false);
  const [isSharingCapsule, setIsSharingCapsule] = useState(false);
  const [isOutfitSetImageDialogOpen, setIsOutfitSetImageDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState("");
  const [confirmCapsuleId, setConfirmCapsuleId] = useState("");
  const [confirmOutfitSetIndex, setConfirmOutfitSetIndex] = useState(-1);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CapsuleLike[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeItemsTab, setActiveItemsTab] = useState("all");
  const [optimisticActiveCapsuleId, setOptimisticActiveCapsuleId] = useState(activeCapsule?.id || "");
  const inlineRenameSubmitGuardRef = useRef(false);
  const searchDialogPaperRef = useRef<HTMLDivElement | null>(null);
  const isDeleteConfirm = confirmAction.startsWith("delete");
  const isRegenerateFiltersConfirm = confirmAction === "regenerate-with-filter-changes";
  const isRegenerateAllConfirm = confirmAction === "regenerate-all";
  const isDeleteOutfitSetImageConfirm = confirmAction === "delete-outfit-set-image";
  const confirmBodyKey = isDeleteOutfitSetImageConfirm
    ? "capsule.deleteOutfitSetImageConfirmBody"
    : isRegenerateFiltersConfirm
      ? "capsule.regenerateWithFilterChangesBody"
      : isRegenerateAllConfirm
        ? "capsule.regenerateAllConfirmBody"
        : isDeleteConfirm
          ? "capsule.deleteConfirmBody"
          : "capsule.revertConfirmBody";
  const confirmTitleKey = isDeleteOutfitSetImageConfirm
    ? "capsule.deleteOutfitSetImageTitle"
    : isRegenerateFiltersConfirm
      ? "capsule.regenerateWithFilterChangesTitle"
      : isRegenerateAllConfirm
        ? "capsule.regenerateAllTitle"
        : isDeleteConfirm
          ? "capsule.deleteTitle"
          : "capsule.revertTitle";
  const confirmButtonKey = isDeleteConfirm
    ? "capsule.deleteConfirm"
    : isRegenerateFiltersConfirm
      ? "capsule.regenerateWithFilterChangesConfirm"
      : isRegenerateAllConfirm
        ? "capsule.regenerateAllConfirm"
      : "capsule.revertConfirm";

  const selectedCount = selectedRegenerationUrls.length;
  const isInteractionDisabled = isContentBusy || isInlineRenameSubmitting || isSharingCapsule;
  const searchGroups = useMemo(() => groupCapsules(searchResults), [searchResults]);
  const activeCapsuleName = activeCapsule?.name || `<${t("capsule.new")}>`;
  const resolvedOutfitSets = useMemo(() => resolveOutfitSets(items, outfitSets), [items, outfitSets]);
  const activeOutfitSet = activeItemsTab === "all"
    ? null
    : (resolvedOutfitSets.find((set) => set.id === activeItemsTab) || null);
  const visibleItems = activeItemsTab === "all"
    ? items
    : (activeOutfitSet?.items || items);
  const isActiveOutfitSetImagePending = activeOutfitSet
    ? pendingImageSetIndexes.includes(activeOutfitSet.index)
    : false;
  const activeOutfitSetImageSrc = resolveOutfitSetImageSrc(activeOutfitSet?.image);

  useEffect(() => {
    if (!searchOpen) {
      return;
    }

    let isCurrent = true;
    setIsSearching(true);
    Promise.resolve(onSearchCapsules(searchQuery)).then((items) => {
      if (isCurrent) {
        setSearchResults(items);
      }
    }).finally(() => {
      if (isCurrent) {
        setIsSearching(false);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [searchOpen, searchQuery, onSearchCapsules]);

  useEffect(() => {
    setOptimisticActiveCapsuleId(activeCapsule?.id || "");
  }, [activeCapsule?.id]);

  useEffect(() => {
    if (activeItemsTab === "all") {
      return;
    }

    if (!resolvedOutfitSets.some((set) => set.id === activeItemsTab)) {
      setActiveItemsTab("all");
    }
  }, [activeItemsTab, resolvedOutfitSets]);

  useEffect(() => {
    setIsInlineRenameActive(false);
    setInlineRenameValue(activeCapsule?.name || "");
    setIsInlineRenameSubmitting(false);
    inlineRenameSubmitGuardRef.current = false;
  }, [activeCapsule?.id, activeCapsule?.name]);

  const handleCapsuleOpen = async (capsuleId: string, onComplete?: () => void) => {
    if (isInteractionDisabled) {
      return;
    }
    setOptimisticActiveCapsuleId(capsuleId);
    await onOpenCapsule(capsuleId);
    onComplete?.();
    setSearchOpen(false);
  };

  const handleCloseSearchDialog = () => {
    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLElement &&
      searchDialogPaperRef.current?.contains(activeElement)
    ) {
      activeElement.blur();
    }
    setSearchOpen(false);
  };

  const handleOpenSearchDialog = (event?: MouseEvent<HTMLElement>) => {
    if (isInteractionDisabled) {
      return;
    }
    if (event?.currentTarget instanceof HTMLElement) {
      event.currentTarget.blur();
    }
    setSearchOpen(true);
  };

  useEffect(() => {
    registerCapsuleSidebarActions?.({
      openSearchDialog: () => handleOpenSearchDialog(),
      openCapsuleActions: (event, capsule) => {
        const capsuleId = String(capsule?.id || "");
        const activeId = String(activeCapsule?.id || "");
        setRowMenuAnchor(event.currentTarget);
        setRowMenuCapsule(capsuleId && capsuleId === activeId ? { ...capsule, ...activeCapsule } : capsule);
      }
    });
    return () => registerCapsuleSidebarActions?.(null);
  }, [registerCapsuleSidebarActions, isInteractionDisabled, activeCapsule]);

  const handleRequestDuplicate = async (capsule = activeCapsule) => {
    if (!capsule?.id || isInteractionDisabled) {
      return;
    }
    setSaveAsCapsuleId(capsule.id);
    setSaveAsValue(capsule.name || "");
    setSaveAsOpen(true);
  };

  const handleShareCapsule = async (capsule = activeCapsule, { allowUnknownContent = false } = {}) => {
    if (!capsule?.id || isInteractionDisabled || !capsuleCanRequestShare(capsule, { allowUnknownContent })) {
      return;
    }
    setIsSharingCapsule(true);
    try {
      const result = await onShareCapsule(capsule.id);
      if (!result) {
        return;
      }
      const nextUrl = typeof result?.url === "string" ? result.url : "";
      if (!nextUrl) {
        return;
      }
      setShareUrl(nextUrl);
      setShareExpiresAt(result?.expiresAt || null);
      setShareCapsuleName(capsule.name || activeCapsuleName);
      setShareCopied(false);
      setShareDialogOpen(true);
    } finally {
      setIsSharingCapsule(false);
    }
  };

  const handleCopyShareUrl = async () => {
    if (!shareUrl || typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      return;
    }
    await navigator.clipboard.writeText(shareUrl);
    setShareCopied(true);
  };

  const handleProductMenuClick = (event: MouseEvent<HTMLButtonElement>, productUrl: string) => {
    setProductMenuAnchor(event.currentTarget);
    setProductMenuUrl(productUrl);
  };

  const handleCloseProductMenu = () => {
    setProductMenuAnchor(null);
    setProductMenuUrl("");
  };

  const handleCopyProductUrl = async () => {
    const productUrl = productMenuUrl;
    handleCloseProductMenu();
    if (!productUrl || typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      return;
    }
    await navigator.clipboard.writeText(productUrl);
  };

  const handleShowProductInfo = () => {
    const productUrl = productMenuUrl;
    handleCloseProductMenu();
    if (!productUrl) {
      return;
    }
    onNavigateApp("explore", { query: productUrl });
  };

  const handleRequestRegenerateAll = async () => {
    if (isInteractionDisabled) {
      return;
    }

    if (hasFilterChanges) {
      setConfirmCapsuleId("");
      setConfirmOutfitSetIndex(-1);
      setConfirmAction("regenerate-with-filter-changes");
      return;
    }

    if (items.length > 0) {
      setConfirmCapsuleId("");
      setConfirmOutfitSetIndex(-1);
      setConfirmAction("regenerate-all");
      return;
    }

    await onRefreshItems();
  };

  const handleStartInlineRename = () => {
    if (isOverlaySidebar || !activeCapsule?.id || isInteractionDisabled) {
      return;
    }
    setInlineRenameValue(activeCapsule?.name || "");
    setIsInlineRenameActive(true);
  };

  const handleCancelInlineRename = () => {
    inlineRenameSubmitGuardRef.current = false;
    setInlineRenameValue(activeCapsule?.name || "");
    setIsInlineRenameActive(false);
    setIsInlineRenameSubmitting(false);
  };

  const handleSubmitInlineRename = async () => {
    if (!activeCapsule?.id || inlineRenameSubmitGuardRef.current || isInteractionDisabled) {
      return;
    }

    const nextName = normalizeCapsuleName(inlineRenameValue);
    const currentName = normalizeCapsuleName(activeCapsule?.name);

    if (!nextName || nextName === currentName) {
      handleCancelInlineRename();
      return;
    }

    inlineRenameSubmitGuardRef.current = true;
    setIsInlineRenameSubmitting(true);
    try {
      setIsInlineRenameActive(false);
      await onRenameCapsule(nextName, activeCapsule.id);
    } finally {
      inlineRenameSubmitGuardRef.current = false;
      setIsInlineRenameSubmitting(false);
    }
  };

  return (
    <>
      {(() => {
          const nameDialogProps: Partial<DialogProps> = isOverlaySidebar ? { fullScreen: true } : {
            fullWidth: true,
            maxWidth: "sm",
            PaperProps: {
              sx: {
                width: "min(92vw, 720px)"
              }
            }
          };
          const confirmDialogProps: Partial<DialogProps> = isOverlaySidebar ? { fullScreen: true } : {
            fullWidth: true,
            maxWidth: "xs",
            PaperProps: {
              sx: {
                width: "min(92vw, 460px)"
              }
            }
          };

          return (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  lg: "320px minmax(0, 1fr)"
                },
                gap: { xs: 3, lg: 3 },
                flex: 1,
                minHeight: 0,
                overflow: "hidden"
              }}
            >
              <Box
                sx={{
                  display: { xs: "none", lg: "block" },
                  pr: { lg: 3 },
                  borderRight: { lg: "1px solid" },
                  borderColor: { lg: "divider" },
                  minHeight: 0,
                  overflowY: "auto"
                }}
              >
                <ProfileFiltersSidebar
                  styleOptions={styleOptions}
                  occasionOptions={occasionOptions}
                  seasonOptions={seasonOptions}
                  audienceOptions={audienceOptions}
                  accentColorOptions={accentColorOptions}
                  patternOptions={patternOptions}
                  selectedStyleCore={selectedStyleCore}
                  selectedStyleAesthetic={selectedStyleAesthetic}
                  selectedOccasions={selectedOccasions}
                  selectedSeasons={selectedSeasons}
                  selectedAudience={selectedAudience}
                  selectedAccentColor={selectedAccentColor}
                  selectedPattern={selectedPattern}
                  selectedText={selectedText}
                  hasFilterChanges={hasFilterChanges}
                  status={status}
                  onSelectStyleCore={onSelectStyleCore}
                  onSelectStyleAesthetic={onSelectStyleAesthetic}
                  onToggleOccasion={onToggleOccasion}
                  onToggleSeason={onToggleSeason}
                  onSelectAudience={onSelectAudience}
                  onSelectAccentColor={onSelectAccentColor}
                  onSelectPattern={onSelectPattern}
                  onTextChange={onTextChange}
                  onApply={onApplyFilters}
                  onReset={onResetFilters}
                  onSignOut={null}
                  isSigningOut={isSigningOut}
                  isInteractionDisabled={isInteractionDisabled}
                />
              </Box>

              <Stack
                spacing={resolvedOutfitSets.length > 0 ? 0 : 2.5}
                sx={{ minWidth: 0, minHeight: 0, overflow: "hidden" }}
              >
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  spacing={1}
                  sx={{ pb: 2.5 }}
                >
                  <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
                    {isOverlaySidebar && selectedCount === 0 ? (
                      <IconButton
                        aria-label={t("filters.open")}
                        onClick={() => setIsFiltersOpen(true)}
                        disabled={isInteractionDisabled}
                        sx={{ ml: -1 }}
                      >
                        <TuneRoundedIcon />
                      </IconButton>
                    ) : null}
                    {!(isOverlaySidebar && selectedCount > 0) ? (
                      <>
                        {isOverlaySidebar ? (
                          <>
                            <Typography variant="h6" noWrap sx={{ minWidth: 0 }}>
                              {activeCapsuleName}
                            </Typography>
                            {capsuleHasUnsavedChanges(activeCapsule) ? (
                              <Tooltip title={t("capsule.notSaved")}>
                                <FiberManualRecordRoundedIcon sx={{ fontSize: 10, color: "#2f8f58", flexShrink: 0 }} />
                              </Tooltip>
                            ) : null}
                          </>
                        ) : (
                          <Stack
                            direction="row"
                            alignItems="center"
                            spacing={0.75}
                            sx={{
                              minWidth: 0,
                              flex: 1,
                              "& .capsule-header-rename-icon": {
                                opacity: isInlineRenameActive ? 1 : 0,
                                transition: "opacity 160ms ease"
                              },
                              "&:hover .capsule-header-rename-icon": {
                                opacity: 1
                              },
                              "&:focus-within .capsule-header-rename-icon": {
                                opacity: 1
                              }
                            }}
                          >
                            {isInlineRenameActive ? (
                              <TextField
                                autoFocus
                                variant="standard"
                                value={inlineRenameValue}
                                disabled={isInteractionDisabled}
                                inputProps={{ "aria-label": "Capsule name" }}
                                onChange={(event) => setInlineRenameValue(event.target.value)}
                                onBlur={() => {
                                  void handleSubmitInlineRename();
                                }}
                                onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    void handleSubmitInlineRename();
                                    return;
                                  }
                                  if (event.key === "Escape") {
                                    event.preventDefault();
                                    handleCancelInlineRename();
                                  }
                                }}
                                sx={{
                                  minWidth: 0,
                                  flex: 1,
                                  mt: "-1px",
                                  "& .MuiInputBase-root": {
                                    alignItems: "center",
                                    fontSize: "1.25rem",
                                    fontWeight: 500,
                                    lineHeight: 1.6,
                                    p: 0,
                                    "&::before": {
                                      display: "none"
                                    },
                                    "&::after": {
                                      display: "none"
                                    }
                                  },
                                  "& .MuiInputBase-root.Mui-focused": {
                                    boxShadow: "inset 0 -1px 0 rgba(15, 23, 42, 0.38)"
                                  },
                                  "& .MuiInputBase-input": {
                                    p: 0,
                                    lineHeight: 1.6
                                  }
                                }}
                              />
                            ) : (
                              <>
                                <Box
                                  component="button"
                                  type="button"
                                  onClick={handleStartInlineRename}
                                  aria-label={`Rename capsule ${activeCapsuleName}`}
                                  disabled={isInteractionDisabled}
                                  sx={{
                                    minWidth: 0,
                                    flexShrink: 1,
                                    p: 0,
                                    border: 0,
                                    background: "transparent",
                                    textAlign: "left",
                                    color: "inherit",
                                    cursor: isInteractionDisabled ? "default" : "text"
                                  }}
                                >
                                  <Typography variant="h6" noWrap sx={{ minWidth: 0 }}>
                                    {activeCapsuleName}
                                  </Typography>
                                </Box>
                                {capsuleHasUnsavedChanges(activeCapsule) ? (
                                  <Tooltip title={t("capsule.notSaved")}>
                                    <FiberManualRecordRoundedIcon sx={{ fontSize: 10, color: "#2f8f58", flexShrink: 0 }} />
                                  </Tooltip>
                                ) : null}
                                <Box sx={{ width: 32, display: "flex", justifyContent: "center", flexShrink: 0 }}>
                                  <IconButton
                                    className="capsule-header-rename-icon"
                                    aria-label="Edit capsule name"
                                    size="small"
                                    disabled={isInteractionDisabled}
                                    onClick={handleStartInlineRename}
                                  >
                                    <DriveFileRenameOutlineRoundedIcon fontSize="small" />
                                  </IconButton>
                                </Box>
                              </>
                            )}
                          </Stack>
                        )}
                      </>
                    ) : null}
                  </Stack>
                  {selectedCount > 0 ? (
                    <Stack direction="row" spacing={1} sx={{ minHeight: 40, alignItems: "center" }}>
                      <Button variant="outlined" onClick={onCancelRegenerationSelection} disabled={isInteractionDisabled}>
                        {t("main.cancelSelection")}
                      </Button>
                      <Button variant="contained" onClick={onRegenerateSelectedItems} disabled={isInteractionDisabled}>
                        {t("main.regenerateSelected", { count: selectedCount })}
                      </Button>
                    </Stack>
                  ) : (
                    <Stack direction="row" spacing={1} sx={{ minHeight: 40, alignItems: "center" }}>
                      {!isOverlaySidebar ? (
                        <Button
                          variant="contained"
                          onClick={handleRequestRegenerateAll}
                          disabled={isInteractionDisabled}
                        >
                          {t("capsule.regenerateAll")}
                        </Button>
                      ) : null}
                      <IconButton
                        aria-label={t("capsule.openMenu")}
                        disabled={isInteractionDisabled}
                        onClick={(event) => setHeaderMenuAnchor(event.currentTarget)}
                      >
                        <MoreVertRoundedIcon />
                      </IconButton>
                    </Stack>
                  )}
                </Stack>
                <Box sx={{ position: "relative" }}>
                  <Divider />
                  {isContentBusy || isSharingCapsule ? (
                    <LinearProgress
                      color="success"
                      sx={{
                        position: "absolute",
                        inset: "auto 0 -1px 0",
                        height: 2,
                        backgroundColor: "transparent"
                      }}
                    />
                  ) : null}
                </Box>
                {resolvedOutfitSets.length > 0 ? (
                  <Tabs
                    value={activeItemsTab}
                    onChange={(_event, value) => {
                      if (!isInteractionDisabled) {
                        setActiveItemsTab(value);
                      }
                    }}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{ px: { xs: 2, md: 3 }, pt: 0, pb: 0.5 }}
                  >
                    <Tab value="all" label={t("search.all")} disabled={isInteractionDisabled} />
                    {resolvedOutfitSets.map((set) => (
                      <Tab
                        key={set.id}
                        value={set.id}
                        label={t("capsule.outfitSet", { number: set.label })}
                        disabled={isInteractionDisabled}
                      />
                    ))}
                  </Tabs>
                ) : null}
                <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", pr: 0.5, pb: 2 }}>
                  {isLoadingItems ? (
                    <ClothingGridPlaceholder count={12} />
                  ) : (
                    <Stack spacing={3} sx={{ minHeight: "100%" }}>
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: {
                            xs: "1fr",
                            sm: "repeat(2, minmax(0, 1fr))",
                            lg: "repeat(2, minmax(0, 1fr))"
                          },
                          gap: 2.5,
                          "@media (min-width: 1400px)": {
                            gridTemplateColumns: "repeat(3, minmax(0, 1fr))"
                          },
                          "@media (min-width: 1760px)": {
                            gridTemplateColumns: "repeat(4, minmax(0, 1fr))"
                          }
                        }}
                      >
                        {visibleItems.map((item) => {
                          const itemUrl = String(item?.url || "");
                          if (partialRegenerationPendingUrls.includes(itemUrl)) {
                            return (
                              <ClothingPlaceholderCard
                                key={`pending-${item.url || item.id}`}
                                placeholderKey={`pending-${item.url || item.id}`}
                              />
                            );
                          }

                          return (
                            <ClothingCard
                              key={item.url || item.id}
                              item={item}
                              isSelectable={Boolean(itemUrl)}
                              isSelected={selectedRegenerationUrls.includes(itemUrl)}
                              isRegenerating={isInteractionDisabled}
                              onToggleSelected={onToggleRegenerationSelection}
                              onProductMenuClick={handleProductMenuClick}
                              isMobile={isOverlaySidebar}
                            />
                          );
                        })}
                        {showAdditionalItemPlaceholder ? <ClothingGridPlaceholder count={1} inline /> : null}
                      </Box>

                      {activeOutfitSet ? (
                        <Stack spacing={2} sx={{ pb: 2, px: { xs: 0.5, md: 1 } }}>
                          <Divider sx={{ mx: { xs: 1, md: 2 } }} />
                          {activeOutfitSet.image && activeOutfitSet.imageObsolete ? (
                            <Alert
                              severity="warning"
                              sx={{
                                alignSelf: "center",
                                width: "100%",
                                maxWidth: `${OUTFIT_SET_IMAGE_PREVIEW_MAX_WIDTH}px`,
                                borderRadius: "5.4px"
                              }}
                            >
                              {t("capsule.outfitSetImageObsolete")}
                            </Alert>
                          ) : null}
                          {isActiveOutfitSetImagePending ? (
                            <Box
                              sx={{
                                alignSelf: "center",
                                width: "100%",
                                maxWidth: `${OUTFIT_SET_IMAGE_PREVIEW_MAX_WIDTH}px`,
                                borderRadius: 0.3,
                                overflow: "hidden",
                                backgroundColor: "background.paper",
                                position: "relative",
                                boxShadow: "0 16px 40px rgba(17, 36, 34, 0.08)",
                                "&::before": {
                                  content: '""',
                                  position: "absolute",
                                  inset: 0,
                                  borderRadius: 0.3,
                                  padding: "1px",
                                  background:
                                    "linear-gradient(140deg, rgba(28,124,124,0.2), rgba(240,180,41,0.2))",
                                  WebkitMask:
                                    "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                                  WebkitMaskComposite: "xor",
                                  pointerEvents: "none"
                                }
                              }}
                            >
                              <Box
                                data-testid="outfit-set-image-placeholder"
                                sx={{
                                  width: "100%",
                                  aspectRatio: OUTFIT_SET_IMAGE_ASPECT_RATIO,
                                  background:
                                    "linear-gradient(110deg, #ece8e2 8%, #f6f4f1 18%, #ece8e2 33%)",
                                  backgroundSize: "200% 100%",
                                  animation: "placeholderShimmer 1.3s linear infinite",
                                  position: "relative",
                                  overflow: "hidden"
                                }}
                              >
                                <Box
                                  sx={{
                                    position: "absolute",
                                    inset: 0,
                                    background:
                                      "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(10,12,12,0.12) 100%)"
                                  }}
                                />
                              </Box>
                            </Box>
                          ) : activeOutfitSetImageSrc ? (
                            <Box
                              sx={{
                                alignSelf: "center",
                                width: "100%",
                                maxWidth: `${OUTFIT_SET_IMAGE_PREVIEW_MAX_WIDTH}px`,
                                position: "relative",
                                "&:hover .outfit-set-image-delete-button, &:focus-within .outfit-set-image-delete-button": {
                                  opacity: 1,
                                  transform: "translateY(0)"
                                }
                              }}
                            >
                              <IconButton
                                className="outfit-set-image-delete-button"
                                aria-label={t("capsule.deleteOutfitSetImage")}
                                disabled={isInteractionDisabled}
                                onClick={() => {
                                  setConfirmAction("delete-outfit-set-image");
                                  setConfirmOutfitSetIndex(activeOutfitSet.index);
                                }}
                                sx={{
                                  position: "absolute",
                                  top: 12,
                                  right: 12,
                                  zIndex: 1,
                                  bgcolor: "rgba(255,255,255,0.9)",
                                  color: "error.main",
                                  boxShadow: "0 8px 24px rgba(17, 36, 34, 0.16)",
                                  opacity: isOverlaySidebar ? 1 : 0,
                                  transform: isOverlaySidebar ? "translateY(0)" : "translateY(-4px)",
                                  transition: "opacity 160ms ease, transform 160ms ease, background-color 160ms ease",
                                  "&:hover": {
                                    bgcolor: "rgba(255,255,255,0.98)"
                                  }
                                }}
                              >
                                <DeleteOutlineRoundedIcon />
                              </IconButton>
                              <Box
                                component="img"
                                src={activeOutfitSetImageSrc}
                                alt={`Outfit set ${activeOutfitSet.label}`}
                                data-testid="outfit-set-image"
                                onClick={() => setIsOutfitSetImageDialogOpen(true)}
                                sx={{
                                  width: "auto",
                                  maxWidth: "100%",
                                  height: "auto",
                                  borderRadius: 0.3,
                                  display: "block",
                                  border: "1px solid",
                                  borderColor: "divider",
                                  cursor: "zoom-in"
                                }}
                              />
                            </Box>
                          ) : (
                            <Button
                              variant="outlined"
                              disabled={isInteractionDisabled}
                              onClick={() => onGenerateOutfitSetImage(activeOutfitSet.index)}
                              sx={{ alignSelf: "center", minWidth: 180 }}
                            >
                              Create image
                            </Button>
                          )}
                        </Stack>
                      ) : null}
                    </Stack>
                  )}
                </Box>
              </Stack>

              <Dialog open={renameOpen} onClose={() => {
                if (!isInteractionDisabled) {
                  setRenameOpen(false);
                }
              }} {...nameDialogProps}>
                <DialogTitle>{t("capsule.renameTitle")}</DialogTitle>
                <DialogContent sx={{ pt: 1, pb: 0.5 }}>
                  <TextField
                    fullWidth
                    autoFocus
                    disabled={isInteractionDisabled}
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    margin="normal"
                  />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5 }}>
                  <Button disabled={isInteractionDisabled} onClick={() => setRenameOpen(false)}>{t("actions.cancel")}</Button>
                  <Button
                    onClick={async () => {
                      const nextName = renameValue;
                      const nextCapsuleId = renameCapsuleId;
                      setRenameOpen(false);
                      await onRenameCapsule(nextName, nextCapsuleId);
                    }}
                    disabled={isInteractionDisabled || !renameValue.trim()}
                  >
                    {t("actions.ok")}
                  </Button>
                </DialogActions>
              </Dialog>

              <Dialog open={saveAsOpen} onClose={() => {
                if (!isInteractionDisabled) {
                  setSaveAsOpen(false);
                }
              }} {...nameDialogProps}>
                <DialogTitle>{t("capsule.saveAsTitle")}</DialogTitle>
                <DialogContent sx={{ pt: 1, pb: 0.5 }}>
                  <TextField
                    fullWidth
                    autoFocus
                    disabled={isInteractionDisabled}
                    value={saveAsValue}
                    onChange={(event) => setSaveAsValue(event.target.value)}
                    margin="normal"
                  />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5 }}>
                  <Button disabled={isInteractionDisabled} onClick={() => setSaveAsOpen(false)}>{t("actions.cancel")}</Button>
                  <Button
                    onClick={async () => {
                      setSaveAsOpen(false);
                      await onDuplicateCapsule(saveAsValue, saveAsCapsuleId);
                    }}
                    disabled={isInteractionDisabled || !saveAsValue.trim()}
                  >
                    {t("actions.ok")}
                  </Button>
                </DialogActions>
              </Dialog>

              <Dialog
                open={Boolean(confirmAction)}
                onClose={() => {
                  if (!isInteractionDisabled) {
                    setConfirmAction("");
                    setConfirmCapsuleId("");
                    setConfirmOutfitSetIndex(-1);
                  }
                }}
                {...confirmDialogProps}
              >
                <DialogTitle sx={{ pb: 1 }}>
                  {t(confirmTitleKey)}
                </DialogTitle>
                <DialogContent sx={{ pt: 0.5, pb: 0 }}>
                  <DialogContentText sx={{ color: "text.secondary" }}>
                    {t(confirmBodyKey)}
                  </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5, pt: 2 }}>
                  <Button disabled={isInteractionDisabled} onClick={() => {
                    setConfirmAction("");
                    setConfirmCapsuleId("");
                    setConfirmOutfitSetIndex(-1);
                  }}
                  >
                    {t("actions.cancel")}
                  </Button>
                  <Button
                    color={isDeleteConfirm ? "error" : "primary"}
                    variant="contained"
                    disabled={isInteractionDisabled}
                    onClick={async () => {
                      const nextConfirmAction = confirmAction;
                      const nextConfirmCapsuleId = confirmCapsuleId;
                      const nextConfirmOutfitSetIndex = confirmOutfitSetIndex;
                      setConfirmCapsuleId("");
                      setConfirmOutfitSetIndex(-1);
                      setConfirmAction("");
                      if (nextConfirmAction === "delete") {
                        await onDeleteCapsule();
                      }
                      if (nextConfirmAction === "delete-row") {
                        await onDeleteCapsule(nextConfirmCapsuleId);
                        setRowMenuAnchor(null);
                        setRowMenuCapsule(null);
                      }
                      if (nextConfirmAction === "revert") {
                        await onRevertCapsule();
                      }
                      if (nextConfirmAction === "revert-row") {
                        await onRevertCapsule(nextConfirmCapsuleId);
                        setRowMenuAnchor(null);
                        setRowMenuCapsule(null);
                      }
                      if (nextConfirmAction === "delete-outfit-set-image" && nextConfirmOutfitSetIndex >= 0) {
                        await onDeleteOutfitSetImage(nextConfirmOutfitSetIndex);
                      }
                      if (nextConfirmAction === "regenerate-with-filter-changes") {
                        await onApplyFilters();
                      }
                      if (nextConfirmAction === "regenerate-all") {
                        await onRefreshItems();
                      }
                    }}
                  >
                    {t(confirmButtonKey)}
                  </Button>
                </DialogActions>
              </Dialog>

              <Dialog
                open={isOutfitSetImageDialogOpen}
                onClose={() => {
                  if (!isInteractionDisabled) {
                    setIsOutfitSetImageDialogOpen(false);
                  }
                }}
                fullScreen
                maxWidth={false}
                PaperProps={{
                  elevation: 0,
                  sx: {
                    backgroundColor: "transparent",
                    backgroundImage: "none",
                    border: "none",
                    boxShadow: "none",
                    overflow: "hidden"
                  }
                }}
                BackdropProps={{
                  sx: {
                    backgroundColor: "rgba(10, 12, 12, 0.5)"
                  }
                }}
              >
                <Box
                  data-testid="outfit-set-image-dialog"
                  sx={{
                    position: "relative",
                    width: "100vw",
                    height: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    p: 2
                  }}
                >
                  <IconButton
                    aria-label={t("actions.close")}
                    disabled={isInteractionDisabled}
                    onClick={() => setIsOutfitSetImageDialogOpen(false)}
                    sx={{
                      position: "fixed",
                      top: 16,
                      right: 16,
                      zIndex: 1,
                      bgcolor: "rgba(255,255,255,0.94)",
                      color: "#14211f",
                      boxShadow: "0 8px 24px rgba(17, 36, 34, 0.18)",
                      "&:hover": {
                        bgcolor: "rgba(255,255,255,0.98)"
                      }
                    }}
                  >
                    <CloseRoundedIcon />
                  </IconButton>
                  {activeOutfitSetImageSrc ? (
                    <Box
                      component="img"
                      src={activeOutfitSetImageSrc}
                      alt={`Outfit set ${activeOutfitSet?.label || ""}`}
                      sx={{
                        display: "block",
                        width: "auto",
                        maxWidth: "calc(100vw - 32px)",
                        maxHeight: "calc(100vh - 32px)",
                        objectFit: "contain",
                        borderRadius: 0.3
                      }}
                    />
                  ) : null}
                </Box>
              </Dialog>

              <Dialog
                open={searchOpen}
                onClose={() => {
                  if (!isInteractionDisabled) {
                    handleCloseSearchDialog();
                  }
                }}
                fullScreen={isOverlaySidebar}
                maxWidth="md"
                fullWidth
                PaperProps={{ ref: searchDialogPaperRef }}
              >
                <DialogContent sx={{ p: 0 }}>
                  <Stack spacing={0}>
                    <Stack direction="row" alignItems="center" sx={{ px: 2, py: 2 }}>
                      <TextField
                        autoFocus
                        fullWidth
                        variant="standard"
                        placeholder={t("capsule.searchPlaceholder")}
                        value={searchQuery}
                        disabled={isInteractionDisabled}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        InputProps={{ disableUnderline: true }}
                      />
                      <IconButton disabled={isInteractionDisabled} onClick={handleCloseSearchDialog}>
                        <CloseRoundedIcon />
                      </IconButton>
                    </Stack>
                    <Box sx={{ position: "relative" }}>
                      <Divider />
                      {isSearching ? (
                        <LinearProgress
                          color="success"
                          sx={{
                            position: "absolute",
                            inset: "auto 0 -1px 0",
                            height: 2,
                            backgroundColor: "transparent"
                          }}
                        />
                      ) : null}
                    </Box>
                    <Box sx={{ p: 2, maxHeight: "70vh", overflowY: "auto" }}>
                      {Object.entries(searchGroups).map(([label, group]) => (
                        <Stack key={label} spacing={1} sx={{ mb: 3 }}>
                          <Typography color="text.secondary">{t(`capsule.${label}`)}</Typography>
                          {group.map((capsule) => (
                            <ListItemButton
                              key={capsule.id}
                              disabled={isInteractionDisabled}
                              onClick={() => handleCapsuleOpen(capsule.id)}
                              sx={{
                                borderRadius: 3,
                                px: 1.5,
                                py: 1.25,
                                alignItems: "center",
                                "& .capsule-search-date": {
                                  opacity: 0,
                                  transition: "opacity 160ms ease"
                                },
                                "&:hover .capsule-search-date, &:focus-visible .capsule-search-date, &:focus-within .capsule-search-date": {
                                  opacity: 1
                                }
                              }}
                            >
                              <Stack direction="row" alignItems="center" spacing={2} sx={{ width: "100%", minWidth: 0 }}>
                                <Typography noWrap sx={{ minWidth: 0, flex: 1 }}>
                                  {highlightMatch(capsule.name, searchQuery)}
                                </Typography>
                                <Typography
                                  className="capsule-search-date"
                                  variant="body2"
                                  color="text.secondary"
                                  sx={{ flexShrink: 0, whiteSpace: "nowrap" }}
                                >
                                  {new Date(capsule.updatedAt).toLocaleDateString()}
                                </Typography>
                              </Stack>
                            </ListItemButton>
                          ))}
                        </Stack>
                      ))}
                    </Box>
                  </Stack>
                </DialogContent>
              </Dialog>

              <Dialog open={isFiltersOpen} onClose={() => {
                if (!isInteractionDisabled) {
                  setIsFiltersOpen(false);
                }
              }} fullScreen={isOverlaySidebar}>
                <DialogTitle sx={{ pr: 1.5 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                    <Typography variant="inherit">{t("filters.title")}</Typography>
                    <IconButton
                      aria-label={t("capsule.closeFilters")}
                      disabled={isInteractionDisabled}
                      onClick={() => setIsFiltersOpen(false)}
                    >
                      <CloseRoundedIcon />
                    </IconButton>
                  </Stack>
                </DialogTitle>
                <DialogContent>
                  <ProfileFiltersSidebar
                    styleOptions={styleOptions}
                    occasionOptions={occasionOptions}
                    seasonOptions={seasonOptions}
                    audienceOptions={audienceOptions}
                    accentColorOptions={accentColorOptions}
                    patternOptions={patternOptions}
                    selectedStyleCore={selectedStyleCore}
                    selectedStyleAesthetic={selectedStyleAesthetic}
                    selectedOccasions={selectedOccasions}
                    selectedSeasons={selectedSeasons}
                    selectedAudience={selectedAudience}
                    selectedAccentColor={selectedAccentColor}
                    selectedPattern={selectedPattern}
                    selectedText={selectedText}
                    hasFilterChanges={hasFilterChanges}
                    status={status}
                    onSelectStyleCore={onSelectStyleCore}
                    onSelectStyleAesthetic={onSelectStyleAesthetic}
                    onToggleOccasion={onToggleOccasion}
                    onToggleSeason={onToggleSeason}
                    onSelectAudience={onSelectAudience}
                    onSelectAccentColor={onSelectAccentColor}
                    onSelectPattern={onSelectPattern}
                    onTextChange={onTextChange}
                    onApply={async () => {
                      setIsFiltersOpen(false);
                      await onApplyFilters();
                    }}
                    onReset={async () => {
                      setIsFiltersOpen(false);
                      await onResetFilters();
                    }}
                    onSignOut={null}
                    isSigningOut={isSigningOut}
                    isInteractionDisabled={isInteractionDisabled}
                  />
                </DialogContent>
              </Dialog>

              <Dialog
                open={shareDialogOpen}
                onClose={() => setShareDialogOpen(false)}
                fullScreen={isOverlaySidebar}
                fullWidth
                maxWidth="sm"
                aria-labelledby="share-link-dialog-title"
                PaperProps={{
                  sx: {
                    borderRadius: isOverlaySidebar ? 0 : "18px",
                    overflow: "hidden"
                  }
                }}
              >
                <DialogTitle sx={{ px: { xs: 2.5, sm: 3 }, pt: 3, pb: 1.5 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: "12px",
                          display: "grid",
                          placeItems: "center",
                          color: "primary.main",
                          bgcolor: (theme) => (
                            theme.palette.mode === "dark"
                              ? "rgba(73, 163, 163, 0.14)"
                              : "rgba(28, 124, 124, 0.08)"
                          )
                        }}
                      >
                        <ShareRoundedIcon fontSize="small" />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography id="share-link-dialog-title" component="span" variant="h6" sx={{ display: "block", lineHeight: 1.25 }}>
                          {t("capsule.shareTitle")}
                        </Typography>
                      </Box>
                    </Stack>
                    <IconButton aria-label={t("actions.close")} onClick={() => setShareDialogOpen(false)} sx={{ flexShrink: 0 }}>
                      <CloseRoundedIcon />
                    </IconButton>
                  </Stack>
                </DialogTitle>
                <DialogContent sx={{ px: { xs: 2.5, sm: 3 }, pt: 0.5, pb: 2 }}>
                  <Stack spacing={1.5}>
                    <Typography variant="body2" color="text.secondary">
                      {t("capsule.shareReady")}
                    </Typography>
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr) auto",
                        alignItems: "center",
                        gap: 1.25,
                        p: 1,
                        pl: 1.5,
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: "12px",
                        bgcolor: (theme) => (
                          theme.palette.mode === "dark"
                            ? "rgba(255,255,255,0.035)"
                            : "rgba(246, 248, 247, 0.92)"
                        )
                      }}
                    >
                      <Link
                        href={shareUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={shareCapsuleName || shareUrl}
                        underline="none"
                        sx={{ minWidth: 0, color: "text.primary" }}
                      >
                        <Typography noWrap sx={{ fontWeight: 700, lineHeight: 1.35 }}>
                          {shareCapsuleName || shareUrl}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 0.25 }}>
                          {shareUrl}
                        </Typography>
                      </Link>
                      <Tooltip title={shareCopied ? t("capsule.shareCopied") : t("capsule.copyShareLink")}>
                        <IconButton
                          aria-label={t("capsule.copyShareLink")}
                          onClick={handleCopyShareUrl}
                          sx={{
                            width: 42,
                            height: 42,
                            borderRadius: "10px",
                            color: shareCopied ? "success.main" : "primary.contrastText",
                            bgcolor: shareCopied ? "success.light" : "primary.main",
                            "&:hover": {
                              bgcolor: shareCopied ? "success.light" : "primary.dark"
                            }
                          }}
                        >
                          {shareCopied ? <CheckRoundedIcon /> : <ContentCopyRoundedIcon />}
                        </IconButton>
                      </Tooltip>
                    </Box>
                    {shareExpiresAt ? (
                      <Typography variant="body2" color="text.secondary">
                        {t("capsule.shareExpires", { date: new Date(shareExpiresAt).toLocaleString() })}
                      </Typography>
                    ) : null}
                  </Stack>
                </DialogContent>
                <DialogActions sx={{ px: { xs: 2.5, sm: 3 }, pb: 2.5, pt: 0 }}>
                  <Button variant="text" onClick={() => setShareDialogOpen(false)}>{t("actions.close")}</Button>
                </DialogActions>
              </Dialog>
            </Box>
          );
        })()}

      <CapsuleActionMenu
        anchorEl={headerMenuAnchor}
        open={Boolean(headerMenuAnchor)}
        onClose={() => setHeaderMenuAnchor(null)}
        capsule={activeCapsule}
        disabled={isInteractionDisabled}
        showRegenerateAll={isOverlaySidebar && selectedCount === 0}
        onRegenerateAll={handleRequestRegenerateAll}
        onDownloadPdf={onDownloadPdf}
        onRename={() => {
          setRenameCapsuleId(activeCapsule?.id || "");
          setRenameValue(activeCapsuleName);
          setRenameOpen(true);
        }}
        onRevert={() => setConfirmAction("revert")}
        onSave={onSaveCapsule}
        onDuplicate={() => handleRequestDuplicate(activeCapsule)}
        onShare={() => handleShareCapsule(activeCapsule)}
        onDelete={() => setConfirmAction("delete")}
      />

      <CapsuleActionMenu
        anchorEl={rowMenuAnchor}
        open={Boolean(rowMenuAnchor)}
        onClose={() => {
          setRowMenuAnchor(null);
          setRowMenuCapsule(null);
        }}
        capsule={rowMenuCapsule}
        disabled={isInteractionDisabled}
        onDownloadPdf={() => onDownloadPdf(rowMenuCapsule?.id)}
        onRename={() => {
          setRenameCapsuleId(rowMenuCapsule?.id || "");
          setRenameValue(rowMenuCapsule?.name || "");
          setRenameOpen(true);
        }}
        onRevert={() => {
          setConfirmCapsuleId(rowMenuCapsule?.id || "");
          setConfirmAction("revert-row");
        }}
        onSave={() => onSaveCapsule(rowMenuCapsule?.id)}
        onRegenerateAll={() => {}}
        onDuplicate={() => handleRequestDuplicate(rowMenuCapsule)}
        onShare={() => handleShareCapsule(rowMenuCapsule, { allowUnknownContent: true })}
        allowUnknownShareContent
        onDelete={() => {
          setConfirmCapsuleId(rowMenuCapsule?.id || "");
          setConfirmAction("delete-row");
        }}
      />
      <Menu
        anchorEl={productMenuAnchor}
        open={Boolean(productMenuAnchor)}
        onClose={handleCloseProductMenu}
      >
        <MenuItem onClick={handleCopyProductUrl}>{t("capsule.copyProductLinkAddress")}</MenuItem>
        <MenuItem onClick={handleShowProductInfo}>{t("capsule.showProductInfo")}</MenuItem>
      </Menu>
    </>
  );
}

export default MainScreen;
