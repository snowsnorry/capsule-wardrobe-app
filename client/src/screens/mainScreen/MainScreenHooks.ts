import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getReadyWardrobeCapsuleItems } from "../../../../shared/capsuleCategories.js";
import { fetchMyWardrobeItems } from "../../api/myWardrobe";
import {
  readStoredMobileCardColumns,
  writeStoredMobileCardColumns,
} from "./MainScreenHelpers";
import {
  buildCapsuleSummaryItems,
  normalizeCapsuleName,
  resolveOutfitSetImageSrc,
  resolveOutfitSets,
} from "./MainScreenHelpers";
import type {
  CapsuleLike,
  CapsuleMenuAnchor,
  MainScreenItem,
  MainScreenProps,
  MobileCardColumns,
} from "./MainScreenTypes";
import type {
  MobileContextMenuOriginRect,
  ProductMenuPresentation,
} from "../../components/ClothingCardTypes";

type SearchState = {
  open: boolean;
  query: string;
  results: CapsuleLike[];
  loading: boolean;
};

function useMainScreenUiState() {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [headerMenuAnchor, setHeaderMenuAnchor] =
    useState<CapsuleMenuAnchor>(null);
  const [rowMenuAnchor, setRowMenuAnchor] = useState<CapsuleMenuAnchor>(null);
  const [rowMenuCapsule, setRowMenuCapsule] = useState<CapsuleLike | null>(
    null,
  );
  const [productMenu, setProductMenu] = useState<{
    anchor: CapsuleMenuAnchor;
    url: string;
    item: MainScreenItem | null;
    originRect?: MobileContextMenuOriginRect;
    presentation?: ProductMenuPresentation;
  }>({ anchor: null, url: "", item: null });
  const [productDetailItem, setProductDetailItem] =
    useState<MainScreenItem | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [mobileColumns, setMobileColumns] = useState<MobileCardColumns>(() =>
    readStoredMobileCardColumns(),
  );
  const [activeTab, setActiveTab] = useState("all");
  const [nameDialog, setNameDialog] = useState<{
    type: "rename" | "save-as" | "";
    capsuleId: string;
    value: string;
  }>({ type: "", capsuleId: "", value: "" });
  const [confirm, setConfirm] = useState<{
    action: string;
    capsuleId: string;
    outfitSetIndex: number;
  }>({ action: "", capsuleId: "", outfitSetIndex: -1 });
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const updateColumns = (value: MobileCardColumns) => {
    setMobileColumns(value);
    writeStoredMobileCardColumns(value);
  };
  return {
    activeTab,
    confirm,
    filtersOpen,
    headerMenuAnchor,
    imageDialogOpen,
    mobileColumns,
    nameDialog,
    productDetailItem,
    productMenu,
    rowMenuAnchor,
    rowMenuCapsule,
    selectionMode,
    setActiveTab,
    setConfirm,
    setFiltersOpen,
    setHeaderMenuAnchor,
    setImageDialogOpen,
    setNameDialog,
    setProductDetailItem,
    setProductMenu,
    setRowMenuAnchor,
    setRowMenuCapsule,
    setSelectionMode,
    updateColumns,
  };
}

function useInlineRename({
  activeCapsule,
  disabled,
  isOverlay,
  onRenameCapsule,
}: Pick<MainScreenProps, "activeCapsule" | "onRenameCapsule"> & {
  disabled: boolean;
  isOverlay: boolean;
}) {
  const [active, setActive] = useState(false);
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const guardRef = useRef(false);
  useEffect(() => {
    setActive(false);
    setValue(activeCapsule?.name || "");
    setSubmitting(false);
    guardRef.current = false;
  }, [activeCapsule?.id, activeCapsule?.name]);
  const cancel = useCallback(() => {
    guardRef.current = false;
    setValue(activeCapsule?.name || "");
    setActive(false);
    setSubmitting(false);
  }, [activeCapsule?.name]);
  const submit = useCallback(async () => {
    if (!activeCapsule?.id || guardRef.current || disabled) return;
    const nextName = normalizeCapsuleName(value);
    if (!nextName || nextName === normalizeCapsuleName(activeCapsule.name)) {
      cancel();
      return;
    }
    guardRef.current = true;
    setSubmitting(true);
    try {
      setActive(false);
      await onRenameCapsule?.(nextName, activeCapsule.id);
    } finally {
      guardRef.current = false;
      setSubmitting(false);
    }
  }, [activeCapsule, cancel, disabled, onRenameCapsule, value]);
  const start = useCallback(() => {
    if (!isOverlay && activeCapsule?.id && !disabled) {
      setValue(activeCapsule.name || "");
      setActive(true);
    }
  }, [activeCapsule, disabled, isOverlay]);
  return { active, value, setValue, submitting, start, cancel, submit };
}

function useCapsuleSearch(
  props: MainScreenProps,
  interactionDisabled: boolean,
  setRowMenuAnchor: (anchor: CapsuleMenuAnchor) => void,
  setRowMenuCapsule: (capsule: CapsuleLike | null) => void,
) {
  const [search, setSearch] = useState<SearchState>({
    open: false,
    query: "",
    results: [],
    loading: false,
  });
  const openSearch = useCallback(() => {
    if (!interactionDisabled) setSearch((state) => ({ ...state, open: true }));
  }, [interactionDisabled]);
  useEffect(() => {
    if (!search.open) return;
    let current = true;
    setSearch((state) => ({ ...state, loading: true }));
    Promise.resolve(props.onSearchCapsules?.(search.query) || [])
      .then((results) => {
        if (current) setSearch((state) => ({ ...state, results }));
      })
      .finally(() => {
        if (current) setSearch((state) => ({ ...state, loading: false }));
      });
    return () => {
      current = false;
    };
  }, [props, search.open, search.query]);
  useEffect(() => {
    props.registerCapsuleSidebarActions?.({
      openSearchDialog: openSearch,
      openCapsuleActions: (event, capsule) => {
        const isActive =
          String(capsule?.id || "") === String(props.activeCapsule?.id || "");
        setRowMenuAnchor(event.currentTarget);
        setRowMenuCapsule(
          isActive ? { ...capsule, ...props.activeCapsule } : capsule,
        );
      },
    });
    return () => props.registerCapsuleSidebarActions?.(null);
  }, [openSearch, props, setRowMenuAnchor, setRowMenuCapsule]);
  return { search, setSearch };
}

function useCapsuleDisplay(
  props: MainScreenProps,
  activeTab: string,
  locale: string,
  t: (key: string, params?: Record<string, unknown>) => string,
) {
  const resolvedSets = useMemo(
    () => resolveOutfitSets(props.items, props.outfitSets),
    [props.items, props.outfitSets],
  );
  const activeSet =
    activeTab === "all"
      ? null
      : resolvedSets.find((set) => set.id === activeTab) || null;
  const summary = useMemo(
    () =>
      buildCapsuleSummaryItems({
        itemCount: props.items.length,
        outfitCount: resolvedSets.length,
        selectedStyleCore: props.selectedStyleCore,
        selectedStyleAesthetic: props.selectedStyleAesthetic,
        selectedOccasions: props.selectedOccasions,
        selectedSeasons: props.selectedSeasons,
        selectedAudience: props.selectedAudience,
        selectedAccentColor: props.selectedAccentColor,
        selectedPattern: props.selectedPattern,
        selectedText: props.selectedText,
        locale,
        t,
      }),
    [props, locale, resolvedSets.length, t],
  );
  return {
    activeImageSrc: resolveOutfitSetImageSrc(activeSet?.image),
    activeName: props.activeCapsule?.name || `<${t("capsule.new")}>`,
    activeSet,
    resolvedSets,
    summary,
    visibleItems: activeSet?.items || props.items,
  };
}

function useRegenerateAllRequest({
  hasFilterChanges,
  interactionDisabled,
  itemCount,
  onRefreshItems,
  sourceModeBlocked,
  setConfirm,
}: {
  hasFilterChanges: boolean;
  interactionDisabled: boolean;
  itemCount: number;
  onRefreshItems: () => Promise<void> | void;
  sourceModeBlocked: boolean;
  setConfirm: (state: {
    action: string;
    capsuleId: string;
    outfitSetIndex: number;
  }) => void;
}) {
  return async () => {
    if (interactionDisabled || sourceModeBlocked) return;
    if (hasFilterChanges)
      setConfirm({
        action: "regenerate-with-filter-changes",
        capsuleId: "",
        outfitSetIndex: -1,
      });
    else if (itemCount > 0)
      setConfirm({
        action: "regenerate-all",
        capsuleId: "",
        outfitSetIndex: -1,
      });
    else await onRefreshItems();
  };
}

function useWardrobeOnlyRegenerationBlock(sourceMode: string) {
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    if (sourceMode !== "wardrobe_only") {
      setIsBlocked(false);
      return;
    }

    let current = true;
    setIsBlocked(true);
    fetchMyWardrobeItems({ force: true })
      .then((response) => {
        if (!current) return;
        const items = Array.isArray(response?.items)
          ? (response.items as Array<Record<string, unknown>>)
          : [];
        setIsBlocked(getReadyWardrobeCapsuleItems(items).length === 0);
      })
      .catch(() => {
        if (current) setIsBlocked(true);
      });

    return () => {
      current = false;
    };
  }, [sourceMode]);

  return isBlocked;
}

export {
  useCapsuleDisplay,
  useCapsuleSearch,
  useInlineRename,
  useMainScreenUiState,
  useRegenerateAllRequest,
  useWardrobeOnlyRegenerationBlock,
};
export { useShareCapsule } from "./MainScreenShareHook";
export type { ShareState } from "./MainScreenShareHook";
export type { SearchState };
export type MainScreenDisplay = ReturnType<typeof useCapsuleDisplay>;
