/* eslint-disable max-lines, max-lines-per-function */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Pagination,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import DriveFileRenameOutlineRoundedIcon from "@mui/icons-material/DriveFileRenameOutlineRounded";
import FavoriteBorderRoundedIcon from "@mui/icons-material/FavoriteBorderRounded";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
import FiberManualRecordRoundedIcon from "@mui/icons-material/FiberManualRecordRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import AnchorPickerCard from "../../components/ProfileFiltersAnchorPickerCard";
import AnchorPickerFilters from "../../components/ProfileFiltersAnchorPickerFilters";
import {
  mobileCapsuleDialogActionsSx,
  mobileCapsuleDialogContentSx,
  mobileCapsuleDialogPaperSx,
  mobileCapsuleDialogTitleSx,
} from "../../components/MobileDialogSurfaceStyles";
import MobileProductCardContextMenu from "../../components/MobileProductCardContextMenu";
import {
  pickerDialogActionsSx,
  pickerDialogContentSx,
  pickerDialogFullScreenPaperSx,
  pickerDialogLoadingDividerSx,
  pickerDialogPaperSx,
  pickerGridSx,
  pickerScrollAreaSx,
} from "../../components/ProfileFiltersAnchorStyles";
import ClothingCard from "../../components/ClothingCard";
import { fetchMyWardrobeItems } from "../../api/myWardrobe";
import { fetchSearchOptions, runSearch } from "../../api/search";
import { translateOption } from "../../i18n";
import { useI18n } from "../../i18n/useI18n";
import SearchFiltersSidebar from "../../search/SearchFiltersSidebar";
import { SearchFiltersFooter } from "../../search/SearchFiltersSidebarSections";
import {
  EMPTY_SEARCH_OPTIONS,
  buildActiveFilterChips,
  buildSearchOptionsPayload,
  createSearchState,
  serializeDraftState,
} from "../../search/searchState";
import SearchBar from "../searchScreen/SearchBar";
import { getSearchStateWithoutChip } from "../searchScreen/searchChipState";
import CapsuleProductDetailDialog from "../mainScreen/CapsuleProductDetailDialog";
import CardLayoutMenuSection from "../mainScreen/CapsuleActionMenuLayout";
import {
  getCanonicalItemUrl,
  isLikedItem,
  patchLikedStateByUrl,
} from "../../utils/likedItemState";
import { isUploadedWardrobeItemNeedsReview } from "../../utils/uploadedWardrobeItemStatus";
import type { UploadedWardrobeItemUpdatePayload } from "../../api/myWardrobe";
import { MAIN_SCREEN_CONTENT_COLUMN_SX } from "../mainScreen/MainScreenHelpers";
import type { MobileCardColumns } from "../mainScreen/MainScreenTypes";
import {
  CATEGORY_ORDER,
  sortWardrobeItems,
} from "../../../../shared/wardrobeOrder.js";
import {
  buildClothingGridGap,
  buildClothingGridTemplateColumns,
} from "../../components/ClothingGridPlaceholder";
import type {
  AnchorItem,
  AnchorSourceFilter,
  AnchorTypeFilter,
  Translate,
} from "../../components/ProfileFiltersAnchorTypes";
import type {
  OutfitItemSnapshot,
  OutfitMeta,
  WardrobeItem,
} from "../../app/appTypes";
import type {
  ActiveFilterChip,
  SearchDraftState,
  SearchOptions,
} from "../../search/searchState";
import type { ProductMenuOpenOptions } from "../../components/ClothingCardTypes";

type OutfitScreenProps = {
  activeOutfit: OutfitMeta | null;
  isContentBusy: boolean;
  onDeleteOutfit: (outfitId?: string) => Promise<void>;
  onDownloadOutfitPdf: (outfitId?: string) => Promise<void>;
  onDuplicateOutfit: (name: string, outfitId?: string) => Promise<void>;
  onRenameOutfit: (name: string, outfitId?: string) => Promise<void>;
  onReplaceOutfitItems: (
    outfitId: string,
    items: OutfitItemSnapshot[],
  ) => Promise<void>;
  onRemoveFromMyWardrobe?: (item: WardrobeItem) => Promise<void>;
  onRevertOutfit: (outfitId?: string) => Promise<void>;
  onSaveToMyWardrobe?: (item: WardrobeItem) => Promise<void>;
  onSaveOutfit: (outfitId?: string) => Promise<void>;
  onSetItemLike: (item: WardrobeItem, isLiked: boolean) => Promise<void>;
  onUpdateUploadedWardrobeItem?: (
    item: WardrobeItem,
    payload: UploadedWardrobeItemUpdatePayload,
  ) => Promise<WardrobeItem> | WardrobeItem;
};

type ItemMenuState = {
  anchor: HTMLElement | null;
  entry: OutfitItemSnapshot | null;
  originRect?: ProductMenuOpenOptions["originRect"];
  presentation?: ProductMenuOpenOptions["presentation"];
};
type SortableWardrobeItem = WardrobeItem & {
  category?: unknown;
  name?: unknown;
};
type ProductDetailMode = "read" | "edit";
const CATALOG_PICKER_PAGE_SIZE = 20;
const OUTFIT_MOBILE_CARD_COLUMNS_STORAGE_KEY = "outfit.mobileCardColumns";

function getOutfitItems(outfit: OutfitMeta | null): OutfitItemSnapshot[] {
  return (
    outfit?.effective?.items ||
    outfit?.draft?.items ||
    outfit?.saved?.items ||
    []
  );
}

function isMobileCardColumns(value: unknown): value is MobileCardColumns {
  return value === 1 || value === 2 || value === 3;
}

function readStoredOutfitMobileCardColumns(): MobileCardColumns {
  if (typeof window === "undefined") {
    return 2;
  }

  const parsed = Number(
    window.localStorage?.getItem(OUTFIT_MOBILE_CARD_COLUMNS_STORAGE_KEY),
  );
  return isMobileCardColumns(parsed) ? parsed : 2;
}

function writeStoredOutfitMobileCardColumns(value: MobileCardColumns) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage?.setItem(
    OUTFIT_MOBILE_CARD_COLUMNS_STORAGE_KEY,
    String(value),
  );
}

function getItemKey(item: WardrobeItem, source: "personal" | "catalog") {
  if (source === "personal") {
    const id = String(item.id || item.wardrobeId || "").trim();
    if (id) return `wardrobe://${id}`;
  }
  return String(item.url || item.id || "").trim();
}

function toSnapshot(
  item: WardrobeItem,
  source: "personal" | "catalog",
): OutfitItemSnapshot | null {
  const key = getItemKey(item, source);
  return key ? { key, source, item } : null;
}

function getItemImageUrl(item: WardrobeItem) {
  return String(item.imageUrl || item.rawImageUrl || "").trim();
}

function getItemName(item: WardrobeItem) {
  return String(item.name || item.title || item.productName || "").trim();
}

function getPreviewItemKey(item: WardrobeItem | null) {
  if (!item) return "";
  return String(item.id ?? item.wardrobeId ?? item.url ?? "");
}

function getPreviewComparableKey(item: WardrobeItem) {
  return getCanonicalItemUrl(item) || getPreviewItemKey(item);
}

function toAnchorCardItem(
  item: WardrobeItem,
  key: string,
  source: "personal" | "catalog",
): AnchorItem {
  const wardrobeId = Number(item.id || item.wardrobeId);
  const itemUrl = String(item.url || "").trim();
  const personalSource = getOutfitPersonalItemSource(item);
  return {
    id: key,
    wardrobeId: Number.isInteger(wardrobeId) && wardrobeId > 0 ? wardrobeId : 0,
    url: itemUrl,
    name: getItemName(item) || null,
    imageUrl: getItemImageUrl(item) || null,
    category: String(item.category || "").trim() || null,
    isLiked: isLikedItem(item),
    source: source === "personal" ? personalSource : "catalog",
  };
}

function sortOutfitWardrobeItems(items: WardrobeItem[]) {
  return sortWardrobeItems(items as SortableWardrobeItem[]);
}

function sortOutfitItemSnapshots(items: OutfitItemSnapshot[]) {
  return sortWardrobeItems(
    items.map((entry) => ({
      category: entry.item?.category,
      entry,
      name: getItemName(entry.item),
    })),
  ).map(({ entry }) => entry);
}

function useOutfitPersonalItemTypeOptions(items: WardrobeItem[]) {
  return useMemo(() => {
    const values = new Set(
      items.map((item) => String(item.category || "").trim()).filter(Boolean),
    );
    return CATEGORY_ORDER.filter((category) => values.has(category)).concat(
      [...values].filter((category) => !CATEGORY_ORDER.includes(category)),
    );
  }, [items]);
}

function getOutfitPersonalItemSource(item: WardrobeItem) {
  const explicitSource = String(item.source || "")
    .trim()
    .toLowerCase();
  if (explicitSource === "uploaded") return "uploaded";
  if (explicitSource === "from_catalog") return "catalog";
  return "catalog";
}

function useVisibleOutfitPersonalItems({
  items,
  likedOnly,
  sourceFilter,
  typeFilter,
}: {
  items: WardrobeItem[];
  likedOnly: boolean;
  sourceFilter: AnchorSourceFilter;
  typeFilter: AnchorTypeFilter;
}) {
  return useMemo(() => {
    const filtered = items.filter((item) => {
      const sourceMatches =
        sourceFilter === "all" ||
        getOutfitPersonalItemSource(item) === sourceFilter;
      const likedMatches = !likedOnly || isLikedItem(item);
      const typeMatches =
        typeFilter === "all" || String(item.category || "") === typeFilter;
      return sourceMatches && likedMatches && typeMatches;
    });
    return typeFilter === "all" ? sortOutfitWardrobeItems(filtered) : filtered;
  }, [items, likedOnly, sourceFilter, typeFilter]);
}

function buildSummary(
  items: OutfitItemSnapshot[],
  t: (key: string, params?: Record<string, unknown>) => string,
) {
  const counts = new Map<string, number>();
  items.forEach(({ item }) => {
    const category = String(item.category || "").trim();
    if (category) counts.set(category, (counts.get(category) || 0) + 1);
  });
  const parts = [...counts.entries()].map(([category, count]) =>
    t("outfit.categoryCount", {
      count,
      category: t(`options.categories.${category}`) || category,
    }),
  );
  return parts.length ? parts.join(" · ") : t("outfit.emptySummary");
}

function outfitHasUnsavedChanges(outfit: OutfitMeta | null | undefined) {
  return outfit?.status === "new" || outfit?.status === "modified";
}

function normalizeOutfitName(name: string | undefined) {
  return String(name || "").trim();
}

function useOutfitInlineRename({
  activeOutfit,
  disabled,
  onRenameOutfit,
}: {
  activeOutfit: OutfitMeta | null;
  disabled: boolean;
  onRenameOutfit: OutfitScreenProps["onRenameOutfit"];
}) {
  const [active, setActive] = useState(false);
  const [value, setValue] = useState(activeOutfit?.name || "");
  const [submitting, setSubmitting] = useState(false);
  const guardRef = useRef(false);

  useEffect(() => {
    setActive(false);
    setValue(activeOutfit?.name || "");
    setSubmitting(false);
    guardRef.current = false;
  }, [activeOutfit?.id, activeOutfit?.name]);

  const cancel = useCallback(() => {
    guardRef.current = false;
    setValue(activeOutfit?.name || "");
    setActive(false);
    setSubmitting(false);
  }, [activeOutfit?.name]);

  const submit = useCallback(async () => {
    if (!activeOutfit?.id || guardRef.current || disabled) return;
    const nextName = normalizeOutfitName(value);
    if (!nextName || nextName === normalizeOutfitName(activeOutfit.name)) {
      cancel();
      return;
    }

    guardRef.current = true;
    setSubmitting(true);
    try {
      setActive(false);
      await onRenameOutfit(nextName, activeOutfit.id);
    } finally {
      guardRef.current = false;
      setSubmitting(false);
    }
  }, [activeOutfit, cancel, disabled, onRenameOutfit, value]);

  const start = useCallback(() => {
    if (activeOutfit?.id && !disabled) {
      setValue(activeOutfit.name || "");
      setActive(true);
    }
  }, [activeOutfit, disabled]);

  return { active, cancel, setValue, start, submit, submitting, value };
}

function ActiveOutfitUnsavedIndicator({ t }: { t: (key: string) => string }) {
  const label = t("capsule.notSaved");

  return (
    <Tooltip title={label}>
      <FiberManualRecordRoundedIcon
        aria-label={label}
        data-testid="active-outfit-unsaved-indicator"
        role="img"
        sx={{ fontSize: 10, color: "success.main" }}
      />
    </Tooltip>
  );
}

function OutfitInlineTitle({
  activeOutfit,
  activeName,
  disabled,
  inlineRename,
  t,
}: {
  activeOutfit: OutfitMeta | null;
  activeName: string;
  disabled: boolean;
  inlineRename: ReturnType<typeof useOutfitInlineRename>;
  t: (key: string, params?: Record<string, unknown>) => string;
}) {
  if (inlineRename.active) {
    return (
      <TextField
        autoFocus
        variant="standard"
        value={inlineRename.value}
        disabled={disabled}
        onChange={(event) => inlineRename.setValue(event.target.value)}
        onBlur={() => void inlineRename.submit()}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void inlineRename.submit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            inlineRename.cancel();
          }
        }}
        sx={{ minWidth: 0, flex: 1 }}
        slotProps={{ htmlInput: { "aria-label": t("capsule.nameLabel") } }}
      />
    );
  }

  return (
    <Stack
      direction="row"
      spacing={0.75}
      sx={[{ alignItems: "center", flex: 1 }, outfitInlineTitleSx]}
    >
      <Box
        component="button"
        type="button"
        aria-label={t("capsule.renameWithName", { name: activeName })}
        disabled={disabled}
        onClick={inlineRename.start}
        sx={{
          p: 0,
          border: 0,
          background: "transparent",
          color: "inherit",
          minWidth: 0,
        }}
      >
        <Typography variant="h6" noWrap>
          {activeName}
        </Typography>
      </Box>
      {outfitHasUnsavedChanges(activeOutfit) ? (
        <ActiveOutfitUnsavedIndicator t={t} />
      ) : null}
      <Box
        className="outfit-title-edit-action"
        sx={{
          width: 32,
          display: "flex",
          justifyContent: "center",
          flexShrink: 0,
          opacity: 0,
          transition: "opacity 120ms ease",
        }}
      >
        <IconButton
          aria-label={t("capsule.editName")}
          size="small"
          disabled={disabled}
          onClick={inlineRename.start}
        >
          <DriveFileRenameOutlineRoundedIcon fontSize="small" />
        </IconButton>
      </Box>
    </Stack>
  );
}

const outfitInlineTitleSx = {
  minWidth: 0,
  "&:hover .outfit-title-edit-action, &:focus-within .outfit-title-edit-action":
    {
      opacity: 1,
    },
} as const;

function OutfitHeader({
  activeOutfit,
  isContentBusy,
  isMobile,
  items,
  onAdd,
  onCancelSelection,
  onMenuOpen,
  onRenameOutfit,
  onRemoveSelected,
  selectedCount,
  t,
}: {
  activeOutfit: OutfitMeta | null;
  isContentBusy: boolean;
  isMobile: boolean;
  items: OutfitItemSnapshot[];
  onAdd: () => void;
  onCancelSelection: () => void;
  onMenuOpen: (anchor: HTMLElement) => void;
  onRenameOutfit: OutfitScreenProps["onRenameOutfit"];
  onRemoveSelected: () => void;
  selectedCount: number;
  t: (key: string, params?: Record<string, unknown>) => string;
}) {
  const inlineRename = useOutfitInlineRename({
    activeOutfit,
    disabled: isContentBusy,
    onRenameOutfit,
  });
  const activeName = activeOutfit?.name || "";
  const disabled =
    !activeOutfit?.id || isContentBusy || inlineRename.submitting;

  return (
    <Stack spacing={1.5}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ alignItems: { xs: "stretch", sm: "center" } }}
      >
        {isMobile ? null : (
          <OutfitInlineTitle
            activeOutfit={activeOutfit}
            activeName={activeName}
            disabled={disabled}
            inlineRename={inlineRename}
            t={t}
          />
        )}
        <OutfitHeaderActions
          disabled={disabled}
          selectedCount={selectedCount}
          t={t}
          onAdd={onAdd}
          onCancelSelection={onCancelSelection}
          onMenuOpen={onMenuOpen}
          onRemoveSelected={onRemoveSelected}
        />
      </Stack>
      <Typography variant="body2" color="text.secondary">
        {buildSummary(items, t)}
      </Typography>
      <Divider />
    </Stack>
  );
}

function OutfitHeaderActions({
  disabled,
  onAdd,
  onCancelSelection,
  onMenuOpen,
  onRemoveSelected,
  selectedCount,
  t,
}: {
  disabled: boolean;
  onAdd: () => void;
  onCancelSelection: () => void;
  onMenuOpen: (anchor: HTMLElement) => void;
  onRemoveSelected: () => void;
  selectedCount: number;
  t: (key: string, params?: Record<string, unknown>) => string;
}) {
  if (selectedCount > 0) {
    return (
      <Stack
        direction="row"
        spacing={1}
        sx={{
          minHeight: 40,
          alignItems: "center",
          justifyContent: "flex-end",
          ml: "auto",
          flexShrink: 0,
        }}
      >
        <Button
          variant="outlined"
          disabled={disabled}
          onClick={onCancelSelection}
        >
          {t("main.cancelSelection")}
        </Button>
        <Button
          color="error"
          variant="contained"
          disabled={disabled}
          onClick={onRemoveSelected}
        >
          {t("outfit.removeSelectedCount", { count: selectedCount })}
        </Button>
      </Stack>
    );
  }

  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{
        minHeight: 40,
        alignItems: "center",
        justifyContent: "flex-end",
        ml: "auto",
        flexShrink: 0,
      }}
    >
      <Button
        variant="outlined"
        startIcon={<AddRoundedIcon />}
        disabled={disabled}
        onClick={onAdd}
        sx={{
          height: 32,
          minHeight: 32,
          py: 0,
          px: 1.5,
        }}
      >
        {t("outfit.addItems")}
      </Button>
      <IconButton
        aria-label={t("outfit.openActions")}
        disabled={disabled}
        onClick={(event) => onMenuOpen(event.currentTarget)}
      >
        <MoreVertRoundedIcon />
      </IconButton>
    </Stack>
  );
}

function OutfitMenu({
  anchor,
  disabled,
  mobileCardColumns,
  outfit,
  onClose,
  onDelete,
  onDownload,
  onDuplicate,
  onMobileCardColumnsChange,
  onRevert,
  onSave,
  showCardLayout,
  t,
}: {
  anchor: HTMLElement | null;
  disabled: boolean;
  mobileCardColumns: MobileCardColumns;
  outfit: OutfitMeta | null;
  onClose: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onDuplicate: () => void;
  onMobileCardColumnsChange: (value: MobileCardColumns) => void;
  onRevert: () => void;
  onSave: () => void;
  showCardLayout: boolean;
  t: (key: string, params?: Record<string, unknown>) => string;
}) {
  return (
    <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={onClose}>
      <MenuItem disabled={disabled || !outfit?.id} onClick={onDownload}>
        <ListItemIcon>
          <DownloadRoundedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{t("capsule.exportPdf")}</ListItemText>
      </MenuItem>
      <CardLayoutMenuSection
        show={showCardLayout}
        disabled={disabled}
        mobileCardColumns={mobileCardColumns}
        onClose={onClose}
        onMobileCardColumnsChange={onMobileCardColumnsChange}
      />
      <Divider />
      <MenuItem
        disabled={disabled || outfit?.status === "saved"}
        onClick={onRevert}
      >
        <ListItemIcon>
          <RestoreRoundedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{t("capsule.revert")}</ListItemText>
      </MenuItem>
      <MenuItem
        disabled={disabled || outfit?.status === "saved"}
        onClick={onSave}
      >
        <ListItemIcon sx={{ visibility: "hidden" }}>
          <RestoreRoundedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{t("actions.save")}</ListItemText>
      </MenuItem>
      <MenuItem disabled={disabled || !outfit?.id} onClick={onDuplicate}>
        <ListItemIcon sx={{ visibility: "hidden" }}>
          <RestoreRoundedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{t("capsule.saveAs")}</ListItemText>
      </MenuItem>
      <Divider />
      <MenuItem
        disabled={disabled || !outfit?.id}
        onClick={onDelete}
        sx={{
          color: "error.main",
          "& .MuiListItemIcon-root": { color: "inherit" },
        }}
      >
        <ListItemIcon>
          <DeleteOutlineRoundedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{t("actions.delete")}</ListItemText>
      </MenuItem>
    </Menu>
  );
}

function OutfitItemMenu({
  menu,
  onClose,
  onLike,
  onRemove,
  onSelect,
  t,
}: {
  menu: ItemMenuState;
  onClose: () => void;
  onLike: (entry: OutfitItemSnapshot) => void;
  onRemove: (entry: OutfitItemSnapshot) => void;
  onSelect: (entry: OutfitItemSnapshot) => void;
  t: (key: string) => string;
}) {
  const entry = menu.entry;
  const liked = isLikedItem(entry?.item);
  const renderActions = () => (
    <>
      <MenuItem
        onClick={() => {
          if (entry) onSelect(entry);
          onClose();
        }}
      >
        <ListItemIcon>
          <CheckRoundedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{t("outfit.selectItem")}</ListItemText>
      </MenuItem>
      <MenuItem
        disabled={!entry || !getCanonicalItemUrl(entry.item)}
        onClick={() => {
          if (entry) onLike(entry);
          onClose();
        }}
      >
        <ListItemIcon>
          {liked ? (
            <FavoriteRoundedIcon fontSize="small" />
          ) : (
            <FavoriteBorderRoundedIcon fontSize="small" />
          )}
        </ListItemIcon>
        <ListItemText>
          {t(liked ? "wardrobe.removeLike" : "wardrobe.like")}
        </ListItemText>
      </MenuItem>
      <Divider />
      <MenuItem
        onClick={() => {
          if (entry) onRemove(entry);
          onClose();
        }}
        sx={{ color: "error.main" }}
      >
        <ListItemIcon sx={{ color: "inherit" }}>
          <DeleteOutlineRoundedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{t("actions.delete")}</ListItemText>
      </MenuItem>
    </>
  );
  const isMobileContextMenu = menu.presentation === "mobile-context";

  return (
    <>
      <Menu
        anchorEl={menu.anchor}
        open={Boolean(menu.anchor) && !isMobileContextMenu}
        onClose={onClose}
      >
        {renderActions()}
      </Menu>
      <MobileProductCardContextMenu
        actions={renderActions()}
        item={entry?.item ?? null}
        label={t("capsule.openProductMenu")}
        open={Boolean(menu.anchor) && isMobileContextMenu}
        originRect={menu.originRect}
        onClose={onClose}
      />
    </>
  );
}

function getAddItemsDialogPaperSx(fullScreen: boolean) {
  if (!fullScreen) return pickerDialogPaperSx;
  return {
    ...mobileCapsuleDialogPaperSx,
    ...pickerDialogFullScreenPaperSx,
  };
}

function getAddItemsDialogTitleSx(fullScreen: boolean) {
  return fullScreen ? mobileCapsuleDialogTitleSx : { pb: 0 };
}

function getAddItemsDialogContentSx(fullScreen: boolean) {
  if (!fullScreen) return pickerDialogContentSx;
  return {
    ...mobileCapsuleDialogContentSx,
    ...pickerDialogContentSx,
  };
}

function getAddItemsDialogActionsSx(fullScreen: boolean) {
  return fullScreen ? mobileCapsuleDialogActionsSx : pickerDialogActionsSx;
}

function AddItemsDialog({
  existingItems,
  locale,
  open,
  onAdd,
  onClose,
  t,
}: {
  existingItems: OutfitItemSnapshot[];
  locale: string;
  open: boolean;
  onAdd: (items: OutfitItemSnapshot[]) => void;
  onClose: () => void;
  t: Translate;
}) {
  const [tab, setTab] = useState(0);
  const [personalItems, setPersonalItems] = useState<WardrobeItem[]>([]);
  const [personalLoading, setPersonalLoading] = useState(false);
  const [catalogItems, setCatalogItems] = useState<WardrobeItem[]>([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogOptions, setCatalogOptions] =
    useState<SearchOptions>(EMPTY_SEARCH_OPTIONS);
  const [catalogDraftState, setCatalogDraftState] = useState<SearchDraftState>(
    () => createSearchState(null, EMPTY_SEARCH_OPTIONS.priceRange),
  );
  const [catalogAppliedQuery, setCatalogAppliedQuery] = useState("");
  const [catalogMobileFiltersDraftState, setCatalogMobileFiltersDraftState] =
    useState<SearchDraftState>(() =>
      createSearchState(null, EMPTY_SEARCH_OPTIONS.priceRange),
    );
  const [catalogStatus, setCatalogStatus] = useState({
    loading: false,
    error: "",
  });
  const [isCatalogFiltersOpen, setIsCatalogFiltersOpen] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<AnchorSourceFilter>("all");
  const [likedOnly, setLikedOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState<AnchorTypeFilter>("all");
  const [selected, setSelected] = useState<OutfitItemSnapshot[]>([]);
  const isCatalogMobile = useMediaQuery("(max-width:899px)");
  const fullScreen = isCatalogMobile;

  useEffect(() => {
    if (!open) return;
    setTab(0);
    setSelected([]);
    setSourceFilter("all");
    setLikedOnly(false);
    setTypeFilter("all");
    setPersonalLoading(true);
    void fetchMyWardrobeItems({ force: true })
      .then((result) => {
        setPersonalItems(Array.isArray(result.items) ? result.items : []);
      })
      .catch(() => {
        setPersonalItems([]);
      })
      .finally(() => setPersonalLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open || tab !== 1) return;
    void bootstrapCatalogSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab]);

  const selectedKeys = new Set(selected.map((item) => item.key));
  const existingKeys = new Set(existingItems.map((item) => item.key));
  const personalCount = selected.filter(
    (item) => item.source === "personal",
  ).length;
  const catalogCount = selected.filter(
    (item) => item.source === "catalog",
  ).length;
  const typeOptions = useOutfitPersonalItemTypeOptions(personalItems);
  const visiblePersonalItems = useVisibleOutfitPersonalItems({
    items: personalItems,
    likedOnly,
    sourceFilter,
    typeFilter,
  });
  const visibleCatalogItems = useMemo(
    () => sortOutfitWardrobeItems(catalogItems),
    [catalogItems],
  );
  const catalogActiveChips = useMemo(
    () =>
      buildActiveFilterChips({
        state:
          catalogDraftState.query === catalogAppliedQuery
            ? catalogDraftState
            : { ...catalogDraftState, query: catalogAppliedQuery },
        options: catalogOptions,
        locale,
        t,
        translateOption,
      }),
    [catalogAppliedQuery, catalogDraftState, catalogOptions, locale, t],
  );
  const totalParts = [
    personalCount ? t("outfit.personalSelected", { count: personalCount }) : "",
    catalogCount ? t("outfit.catalogSelected", { count: catalogCount }) : "",
  ].filter(Boolean);
  const catalogFormattedTotal = new Intl.NumberFormat(locale).format(
    catalogTotal,
  );
  const catalogTotalPages = Math.max(
    1,
    Math.ceil(catalogTotal / CATALOG_PICKER_PAGE_SIZE),
  );
  const isDialogLoading = personalLoading || catalogStatus.loading;

  const runCatalogSearch = async (nextState: SearchDraftState) => {
    setCatalogStatus({ loading: true, error: "" });
    try {
      const payload = serializeDraftState(nextState, catalogOptions.priceRange);
      const result = await runSearch({
        ...payload,
        limit: CATALOG_PICKER_PAGE_SIZE,
        persist: false,
      });
      setCatalogItems(Array.isArray(result.items) ? result.items : []);
      setCatalogTotal(Number(result.total) || 0);
      setCatalogStatus({ loading: false, error: "" });
    } catch {
      setCatalogStatus({ loading: false, error: t("errors.generic") });
    }
  };

  const bootstrapCatalogSearch = async () => {
    setCatalogStatus({ loading: true, error: "" });
    try {
      const optionsResponse = await fetchSearchOptions({ force: true });
      const nextOptions = buildSearchOptionsPayload(optionsResponse);
      const nextState = createSearchState(null, nextOptions.priceRange);
      setCatalogOptions(nextOptions);
      setCatalogDraftState(nextState);
      setCatalogAppliedQuery(nextState.query);
      setCatalogMobileFiltersDraftState(nextState);
      const result = await runSearch({
        ...serializeDraftState(nextState, nextOptions.priceRange),
        limit: CATALOG_PICKER_PAGE_SIZE,
        persist: false,
      });
      setCatalogItems(Array.isArray(result.items) ? result.items : []);
      setCatalogTotal(Number(result.total) || 0);
      setCatalogStatus({ loading: false, error: "" });
    } catch {
      setCatalogStatus({ loading: false, error: t("errors.generic") });
    }
  };

  const changeCatalogDraft = async (
    updater:
      | SearchDraftState
      | ((current: SearchDraftState) => SearchDraftState),
    options: { submit?: boolean } = {},
  ) => {
    const nextState =
      typeof updater === "function" ? updater(catalogDraftState) : updater;
    setCatalogDraftState(nextState);
    if (options.submit) {
      setCatalogAppliedQuery(nextState.query);
      await runCatalogSearch(nextState);
    }
  };

  const applyCatalogSearch = async (state = catalogDraftState) => {
    const nextState = { ...state, page: 1 };
    setCatalogDraftState(nextState);
    setCatalogAppliedQuery(nextState.query);
    setCatalogMobileFiltersDraftState(nextState);
    await runCatalogSearch(nextState);
    setIsCatalogFiltersOpen(false);
  };

  const resetCatalogSearch = async () => {
    const nextState = createSearchState(null, catalogOptions.priceRange);
    setCatalogDraftState(nextState);
    setCatalogAppliedQuery(nextState.query);
    setCatalogMobileFiltersDraftState(nextState);
    await runCatalogSearch(nextState);
    setIsCatalogFiltersOpen(false);
  };

  const clearCatalogQuery = async () => {
    const nextState = { ...catalogDraftState, query: "", page: 1 };
    setCatalogDraftState(nextState);
    setCatalogAppliedQuery(nextState.query);
    await runCatalogSearch(nextState);
  };

  const changeCatalogPage = async (_event: unknown, page: number) => {
    const nextState = { ...catalogDraftState, page };
    setCatalogDraftState(nextState);
    setCatalogAppliedQuery(nextState.query);
    await runCatalogSearch(nextState);
  };

  const deleteCatalogChip = (chip: ActiveFilterChip) => {
    const nextState = getSearchStateWithoutChip({
      chip,
      currentState: catalogDraftState,
      priceRange: catalogOptions.priceRange,
    });
    setCatalogDraftState(nextState);
    setCatalogAppliedQuery(nextState.query);
    void runCatalogSearch(nextState);
  };

  const openCatalogFilters = () => {
    setCatalogMobileFiltersDraftState(catalogDraftState);
    setIsCatalogFiltersOpen(true);
  };

  const changeCatalogMobileFiltersDraft = (
    updater:
      | SearchDraftState
      | ((current: SearchDraftState) => SearchDraftState),
  ) => {
    setCatalogMobileFiltersDraftState((current) =>
      typeof updater === "function" ? updater(current) : updater,
    );
  };

  const renderCatalogFilters = ({
    autoApply,
    draftState,
    onDraftStateChange,
  }: {
    autoApply: boolean;
    draftState: SearchDraftState;
    onDraftStateChange: (
      updater:
        | SearchDraftState
        | ((current: SearchDraftState) => SearchDraftState),
      options?: { submit?: boolean },
    ) => void | Promise<void>;
  }) => (
    <SearchFiltersSidebar
      options={catalogOptions}
      draftState={draftState}
      status={catalogStatus}
      onDraftStateChange={onDraftStateChange}
      onApply={applyCatalogSearch}
      onReset={resetCatalogSearch}
      autoApply={autoApply}
      showFooterActions={false}
    />
  );

  const toggle = (snapshot: OutfitItemSnapshot | null) => {
    if (!snapshot || existingKeys.has(snapshot.key)) return;
    setSelected((current) =>
      current.some((item) => item.key === snapshot.key)
        ? current.filter((item) => item.key !== snapshot.key)
        : [...current, snapshot],
    );
  };

  const renderGrid = (
    items: WardrobeItem[],
    source: "personal" | "catalog",
    gridSx: SxProps<Theme> = pickerGridSx,
    showEmpty = true,
  ) => {
    if (items.length === 0) {
      return showEmpty ? (
        <Typography variant="body2" color="text.secondary">
          {t("capsule.anchors.empty")}
        </Typography>
      ) : null;
    }

    return (
      <Box sx={gridSx}>
        {items.map((item) => {
          const snapshot = toSnapshot(item, source);
          const key = snapshot?.key || String(item.id || item.url || "");
          const checked = snapshot ? selectedKeys.has(snapshot.key) : false;
          const disabled = snapshot ? existingKeys.has(snapshot.key) : true;
          const anchorItem = toAnchorCardItem(item, key, source);
          return (
            <AnchorPickerCard
              key={key}
              item={anchorItem}
              locale={locale}
              selected={checked}
              selectionFull={disabled}
              t={t}
              onToggle={() => toggle(snapshot)}
            />
          );
        })}
      </Box>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      fullWidth={!fullScreen}
      maxWidth={fullScreen ? false : "md"}
      slotProps={{
        paper: {
          sx: getAddItemsDialogPaperSx(fullScreen),
        },
      }}
    >
      <DialogTitle sx={getAddItemsDialogTitleSx(fullScreen)}>
        <Stack spacing={2}>
          <Typography variant="h6">{t("outfit.addItems")}</Typography>
          <Typography variant="body2" color="text.secondary">
            {totalParts.length
              ? totalParts.join(" · ")
              : t("outfit.noneSelected")}
          </Typography>
          <Tabs value={tab} onChange={(_event, value) => setTab(value)}>
            <Tab label={t("outfit.personalItems")} />
            <Tab label={t("outfit.catalog")} />
          </Tabs>
        </Stack>
      </DialogTitle>
      <DialogLoadingDivider loading={isDialogLoading} />
      <DialogContent sx={getAddItemsDialogContentSx(fullScreen)}>
        {tab === 0 ? (
          <Stack spacing={2.5} sx={{ flex: 1, minHeight: 0 }}>
            <AnchorPickerFilters
              likedOnly={likedOnly}
              locale={locale}
              sourceFilter={sourceFilter}
              typeFilter={typeFilter}
              typeOptions={typeOptions}
              t={t}
              onLikedOnlyChange={setLikedOnly}
              onSourceChange={setSourceFilter}
              onTypeChange={setTypeFilter}
            />
            <Box sx={pickerScrollAreaSx}>
              {renderGrid(
                visiblePersonalItems,
                "personal",
                pickerGridSx,
                !personalLoading,
              )}
            </Box>
          </Stack>
        ) : null}
        {tab === 1 ? (
          <Box sx={catalogTabLayoutSx}>
            <Box sx={catalogDesktopFiltersSx}>
              <Stack spacing={2.5} sx={{ mb: 3.5 }}>
                <Typography variant="h6" sx={{ color: "text.primary" }}>
                  {t("filters.title")}
                </Typography>
                <Divider />
              </Stack>
              {renderCatalogFilters({
                autoApply: true,
                draftState: catalogDraftState,
                onDraftStateChange: changeCatalogDraft,
              })}
            </Box>
            <Divider orientation="vertical" sx={catalogDesktopDividerSx} />
            <Stack spacing={2} sx={catalogResultsPaneSx}>
              <Stack spacing={1.5} sx={{ flexShrink: 0 }}>
                <SearchBar
                  isMobile={isCatalogMobile}
                  query={catalogDraftState.query}
                  t={t}
                  onOpenFilters={openCatalogFilters}
                  onQueryChange={(query) =>
                    setCatalogDraftState((current) => ({
                      ...current,
                      query,
                      page: 1,
                    }))
                  }
                  onApplyQuery={() => {
                    void applyCatalogSearch();
                  }}
                  onClearQuery={() => {
                    void clearCatalogQuery();
                  }}
                />
                <CatalogResultsHeader
                  activeChips={catalogActiveChips}
                  formattedTotal={catalogFormattedTotal}
                  t={t}
                  onDeleteChip={deleteCatalogChip}
                />
              </Stack>
              <Box sx={catalogResultsScrollSx}>
                {catalogStatus.error ? (
                  <Typography variant="body2" color="error">
                    {catalogStatus.error}
                  </Typography>
                ) : null}
                {renderGrid(
                  visibleCatalogItems,
                  "catalog",
                  catalogPickerGridSx,
                  !catalogStatus.loading,
                )}
              </Box>
              {catalogTotal > CATALOG_PICKER_PAGE_SIZE ? (
                <Pagination
                  page={catalogDraftState.page}
                  count={catalogTotalPages}
                  onChange={changeCatalogPage}
                  shape="rounded"
                  color="primary"
                  siblingCount={isCatalogMobile ? 0 : 1}
                  boundaryCount={isCatalogMobile ? 1 : 2}
                  sx={catalogPaginationSx}
                />
              ) : null}
            </Stack>
          </Box>
        ) : null}
      </DialogContent>
      <Dialog
        open={isCatalogFiltersOpen}
        onClose={() => setIsCatalogFiltersOpen(false)}
        fullScreen
      >
        <DialogTitle sx={catalogMobileFiltersTitleSx}>
          <Typography component="span" variant="h6">
            {t("filters.title")}
          </Typography>
          <IconButton
            aria-label={t("actions.close")}
            onClick={() => setIsCatalogFiltersOpen(false)}
          >
            <CloseRoundedIcon />
          </IconButton>
        </DialogTitle>
        <DialogLoadingDivider loading={catalogStatus.loading} />
        <DialogContent sx={catalogMobileFiltersContentSx}>
          {renderCatalogFilters({
            autoApply: false,
            draftState: catalogMobileFiltersDraftState,
            onDraftStateChange: changeCatalogMobileFiltersDraft,
          })}
        </DialogContent>
        <DialogActions sx={mobileCapsuleDialogActionsSx}>
          <SearchFiltersFooter
            status={catalogStatus}
            onApply={() => applyCatalogSearch(catalogMobileFiltersDraftState)}
            onReset={resetCatalogSearch}
            showApplyButton
            t={t}
          />
        </DialogActions>
      </Dialog>
      <DialogActions sx={getAddItemsDialogActionsSx(fullScreen)}>
        <Button onClick={onClose}>{t("actions.cancel")}</Button>
        <Button
          variant="contained"
          disabled={selected.length === 0}
          onClick={() => onAdd(selected)}
        >
          {t("actions.add")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function DialogLoadingDivider({ loading }: { loading: boolean }) {
  return (
    <Box sx={pickerDialogLoadingDividerSx}>
      {loading ? <LinearProgress /> : null}
    </Box>
  );
}

function CatalogResultsHeader({
  activeChips,
  formattedTotal,
  onDeleteChip,
  t,
}: {
  activeChips: ActiveFilterChip[];
  formattedTotal: string;
  onDeleteChip: (chip: ActiveFilterChip) => void;
  t: Translate;
}) {
  return (
    <Stack spacing={1}>
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ minWidth: 0 }}
      >
        {t("search.resultsCount", { count: formattedTotal })}
      </Typography>
      {activeChips.length > 0 ? (
        <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", gap: 1 }}>
          {activeChips.map((chip) => (
            <Chip
              key={chip.key}
              data-testid={`active-filter-chip-${chip.field}`}
              label={chip.label}
              onDelete={() => onDeleteChip(chip)}
              sx={{
                maxWidth: "100%",
                "& .MuiChip-label": {
                  display: "block",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                },
              }}
            />
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
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
  const updateMobileCardColumns = (value: MobileCardColumns) => {
    setMobileCardColumns(value);
    writeStoredOutfitMobileCardColumns(value);
  };

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
      items.map((entry) =>
        getPreviewComparableKey(entry.item) === comparableKey
          ? { ...entry, item: nextItem }
          : entry,
      ),
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
      replaceItems(items.filter((item) => item.key !== entry.key));
    }
  };
  const removeSelectedItems = () => {
    if (window.confirm(t("outfit.confirmRemoveSelected"))) {
      replaceItems(items.filter((item) => !selectedKeys.includes(item.key)));
      setSelectedKeys([]);
    }
  };

  return (
    <Box sx={outfitScreenSx}>
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
      <Box sx={buildOutfitGridSectionSx(mobileCardColumns)}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns:
              buildClothingGridTemplateColumns(mobileCardColumns),
            gap: buildClothingGridGap(mobileCardColumns),
            "@media (min-width: 1400px)": {
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            },
            "@media (min-width: 1760px)": {
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            },
          }}
        >
          {visibleItems.map((entry) => (
            <ClothingCard
              key={entry.key}
              item={entry.item}
              isSelectable
              isSelected={selectedKeys.includes(entry.key)}
              isSelectionMode={isSelectionMode}
              onToggleSelected={() =>
                setSelectedKeys((current) =>
                  current.includes(entry.key)
                    ? current.filter((key) => key !== entry.key)
                    : [...current, entry.key],
                )
              }
              onProductClick={() => setPreviewItem(entry.item)}
              allowProductMenuWithoutUrl
              isMobile={isMobile}
              mobileColumns={mobileCardColumns}
              selectionToggleIcon="check"
              selectionToggleLabel={t("outfit.selectItem")}
              onProductMenuOpen={(anchor, _productUrl, _item, options) =>
                setItemMenu({
                  anchor,
                  entry,
                  originRect: options.originRect,
                  presentation: options.presentation,
                })
              }
            />
          ))}
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
        onLike={(entry) =>
          void onSetItemLike(entry.item, !isLikedItem(entry.item))
        }
        onRemove={removeEntry}
        onSelect={(entry) =>
          setSelectedKeys((current) => [...new Set([...current, entry.key])])
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

const outfitScreenSx = {
  ...MAIN_SCREEN_CONTENT_COLUMN_SX,
  backgroundColor: "background.default",
  boxSizing: "border-box",
  minHeight: "100%",
  minWidth: 0,
} as const;

const outfitHeaderSectionSx = {
  px: { xs: 2, md: 3 },
  pt: { xs: 1, md: 2.5 },
  pb: 0,
} as const;

function buildOutfitGridSectionSx(mobileCardColumns: MobileCardColumns) {
  return {
    px:
      mobileCardColumns === 1
        ? { xs: 1.25, sm: 2, md: 3 }
        : { xs: 0, sm: 2, md: 3 },
    pt: { xs: 1.25, md: 2 },
    pb: 2,
  } as const;
}

const catalogTabLayoutSx = {
  display: "grid",
  gridTemplateColumns: { xs: "1fr", md: "280px auto minmax(0, 1fr)" },
  gap: { xs: 2, md: 2 },
  alignItems: "stretch",
  flex: 1,
  minHeight: 0,
  overflow: "hidden",
} as const;

const catalogDesktopFiltersSx = {
  display: { xs: "none", md: "block" },
  height: "100%",
  minHeight: 0,
  pr: 1,
  overflowY: "auto",
} as const;

const catalogDesktopDividerSx = {
  display: { xs: "none", md: "block" },
  height: "100%",
} as const;

const catalogResultsPaneSx = {
  minWidth: 0,
  minHeight: 0,
  height: "100%",
  overflow: "hidden",
} as const;

const catalogResultsScrollSx = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  pr: 0.5,
} as const;

const catalogPickerGridSx = {
  ...pickerGridSx,
  gridTemplateColumns: {
    xs: "1fr",
    sm: "1fr",
    md: "repeat(2, minmax(0, 1fr))",
  },
} as const;

const catalogPaginationSx = {
  alignSelf: "center",
  maxWidth: "100%",
  flexShrink: 0,
  "& .MuiPagination-ul": {
    flexWrap: "nowrap",
    justifyContent: "center",
  },
} as const;

const catalogMobileFiltersTitleSx = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 2,
  flexShrink: 0,
} as const;

const catalogMobileFiltersContentSx = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
} as const;
