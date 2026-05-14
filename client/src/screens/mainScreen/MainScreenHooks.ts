import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  readStoredMobileCardColumns,
  writeStoredMobileCardColumns,
} from "./MainScreenHelpers";
import {
  buildCapsuleSummaryItems,
  capsuleCanRequestShare,
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

type SearchState = {
  open: boolean;
  query: string;
  results: CapsuleLike[];
  loading: boolean;
};

type ShareState = {
  open: boolean;
  url: string;
  expiresAt: string | Date | null;
  name: string;
  copied: boolean;
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

function canStartShare(
  capsule: CapsuleLike | null | undefined,
  disabled: boolean,
  allowUnknownContent: boolean,
) {
  return (
    Boolean(capsule?.id) &&
    !disabled &&
    capsuleCanRequestShare(capsule, { allowUnknownContent })
  );
}

function readShareResult(
  result: Awaited<ReturnType<NonNullable<MainScreenProps["onShareCapsule"]>>>,
) {
  const data = result && typeof result === "object" ? result : null;
  const url = typeof data?.url === "string" ? data.url : "";
  return url ? { url, expiresAt: data?.expiresAt || null } : null;
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

function useShareCapsule(
  props: MainScreenProps,
  interactionDisabled: boolean,
  activeName: string,
) {
  const [share, setShare] = useState<ShareState>({
    open: false,
    url: "",
    expiresAt: null,
    name: "",
    copied: false,
    loading: false,
  });
  const shareCapsule = useCallback(
    async (capsule = props.activeCapsule, allowUnknownContent = false) => {
      if (!canStartShare(capsule, interactionDisabled, allowUnknownContent))
        return;
      setShare((state) => ({ ...state, loading: true }));
      try {
        const result = await props.onShareCapsule?.(capsule.id);
        const shareData = readShareResult(result);
        if (shareData)
          setShare({
            open: true,
            ...shareData,
            name: capsule.name || activeName,
            copied: false,
            loading: false,
          });
      } finally {
        setShare((state) => ({ ...state, loading: false }));
      }
    },
    [activeName, interactionDisabled, props],
  );
  return { share, setShare, shareCapsule };
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
  setConfirm,
}: {
  hasFilterChanges: boolean;
  interactionDisabled: boolean;
  itemCount: number;
  onRefreshItems: () => Promise<void> | void;
  setConfirm: (state: {
    action: string;
    capsuleId: string;
    outfitSetIndex: number;
  }) => void;
}) {
  return async () => {
    if (interactionDisabled) return;
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

export {
  useCapsuleDisplay,
  useCapsuleSearch,
  useInlineRename,
  useMainScreenUiState,
  useRegenerateAllRequest,
  useShareCapsule,
};
export type { SearchState, ShareState };
export type MainScreenDisplay = ReturnType<typeof useCapsuleDisplay>;
