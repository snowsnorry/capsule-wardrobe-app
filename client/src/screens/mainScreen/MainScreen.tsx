import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { Box, Divider, LinearProgress, Stack } from "@mui/material";
import type { Theme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useI18n } from "../../i18n/useI18n";
import MainScreenDialogs from "./MainScreenDialogs";
import MainScreenHeader from "./MainScreenHeader";
import MainScreenMenus from "./MainScreenMenus";
import MainScreenSidebar from "./MainScreenSidebar";
import MainScreenTabs from "./MainScreenTabs";
import MainScreenWardrobe from "./MainScreenWardrobe";
import {
  buildCapsuleSummaryItems,
  capsuleCanRequestShare,
  normalizeCapsuleName,
  readStoredMobileCardColumns,
  resolveOutfitSetImageSrc,
  resolveOutfitSets,
  writeStoredMobileCardColumns
} from "./MainScreenHelpers";
import type { CapsuleLike, CapsuleMenuAnchor, MainScreenItem, MainScreenProps, MobileCardColumns } from "./MainScreenTypes";

type SearchState = { open: boolean; query: string; results: CapsuleLike[]; loading: boolean };
type ShareState = { open: boolean; url: string; expiresAt: string | Date | null; name: string; copied: boolean; loading: boolean };

const capsulePanelSx = (theme: Theme) => ({
  minWidth: 0,
  minHeight: 0,
  overflow: "hidden",
  border: { lg: `1px solid ${theme.palette.divider}` },
  borderRadius: { lg: "10px" },
  backgroundColor: "background.paper"
});

function canStartShare(capsule: CapsuleLike | null | undefined, disabled: boolean, allowUnknownContent: boolean) {
  return Boolean(capsule?.id) && !disabled && capsuleCanRequestShare(capsule, { allowUnknownContent });
}

function readShareResult(result: Awaited<ReturnType<NonNullable<MainScreenProps["onShareCapsule"]>>>) {
  const data = result && typeof result === "object" ? result : null;
  const url = typeof data?.url === "string" ? data.url : "";
  return url ? { url, expiresAt: data?.expiresAt || null } : null;
}

function useInlineRename({
  activeCapsule,
  disabled,
  isOverlay,
  onRenameCapsule
}: Pick<MainScreenProps, "activeCapsule" | "onRenameCapsule"> & { disabled: boolean; isOverlay: boolean }) {
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
    if (!activeCapsule?.id || guardRef.current || disabled) {
      return;
    }
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
  setRowMenuCapsule: (capsule: CapsuleLike | null) => void
) {
  const [search, setSearch] = useState<SearchState>({ open: false, query: "", results: [], loading: false });
  const openSearch = useCallback(() => {
    if (!interactionDisabled) setSearch((state) => ({ ...state, open: true }));
  }, [interactionDisabled]);

  useEffect(() => {
    if (!search.open) return;
    let current = true;
    setSearch((state) => ({ ...state, loading: true }));
    Promise.resolve(props.onSearchCapsules?.(search.query) || []).then((results) => {
      if (current) setSearch((state) => ({ ...state, results }));
    }).finally(() => {
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
        const isActive = String(capsule?.id || "") === String(props.activeCapsule?.id || "");
        setRowMenuAnchor(event.currentTarget);
        setRowMenuCapsule(isActive ? { ...capsule, ...props.activeCapsule } : capsule);
      }
    });
    return () => props.registerCapsuleSidebarActions?.(null);
  }, [openSearch, props, setRowMenuAnchor, setRowMenuCapsule]);

  return { search, setSearch };
}

function useShareCapsule(props: MainScreenProps, interactionDisabled: boolean, activeName: string) {
  const [share, setShare] = useState<ShareState>({ open: false, url: "", expiresAt: null, name: "", copied: false, loading: false });

  const shareCapsule = useCallback(async (capsule = props.activeCapsule, allowUnknownContent = false) => {
    if (!canStartShare(capsule, interactionDisabled, allowUnknownContent)) return;
    setShare((state) => ({ ...state, loading: true }));
    try {
      const result = await props.onShareCapsule?.(capsule.id);
      const shareData = readShareResult(result);
      if (shareData) setShare({ open: true, ...shareData, name: capsule.name || activeName, copied: false, loading: false });
    } finally {
      setShare((state) => ({ ...state, loading: false }));
    }
  }, [activeName, interactionDisabled, props]);

  return { share, setShare, shareCapsule };
}

function useCapsuleDisplay(props: MainScreenProps, activeTab: string, locale: string, t: (key: string, params?: Record<string, unknown>) => string) {
  const resolvedSets = useMemo(() => resolveOutfitSets(props.items, props.outfitSets), [props.items, props.outfitSets]);
  const activeSet = activeTab === "all" ? null : resolvedSets.find((set) => set.id === activeTab) || null;
  const summary = useMemo(() => buildCapsuleSummaryItems({
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
    t
  }), [props, locale, resolvedSets.length, t]);

  return {
    activeImageSrc: resolveOutfitSetImageSrc(activeSet?.image),
    activeName: props.activeCapsule?.name || `<${t("capsule.new")}>`,
    activeSet,
    resolvedSets,
    summary,
    visibleItems: activeSet?.items || props.items
  };
}

function MainScreen(props: MainScreenProps) {
  const { t, locale } = useI18n();
  const isOverlaySidebar = useMediaQuery("(max-width: 1279.95px)");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [headerMenuAnchor, setHeaderMenuAnchor] = useState<CapsuleMenuAnchor>(null);
  const [rowMenuAnchor, setRowMenuAnchor] = useState<CapsuleMenuAnchor>(null);
  const [rowMenuCapsule, setRowMenuCapsule] = useState<CapsuleLike | null>(null);
  const [productMenu, setProductMenu] = useState<{ anchor: CapsuleMenuAnchor; url: string; item: MainScreenItem | null }>({ anchor: null, url: "", item: null });
  const [selectionMode, setSelectionMode] = useState(false);
  const [mobileColumns, setMobileColumns] = useState<MobileCardColumns>(() => readStoredMobileCardColumns());
  const [activeTab, setActiveTab] = useState("all");
  const [nameDialog, setNameDialog] = useState<{ type: "rename" | "save-as" | ""; capsuleId: string; value: string }>({ type: "", capsuleId: "", value: "" });
  const [confirm, setConfirm] = useState<{ action: string; capsuleId: string; outfitSetIndex: number }>({ action: "", capsuleId: "", outfitSetIndex: -1 });
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const display = useCapsuleDisplay(props, activeTab, locale, t);
  const { activeImageSrc, activeName, activeSet, resolvedSets, summary, visibleItems } = display;
  const { share, setShare, shareCapsule } = useShareCapsule(props, Boolean(props.isContentBusy), activeName);
  const disabled = Boolean(props.isContentBusy || share.loading);
  const inlineRename = useInlineRename({ activeCapsule: props.activeCapsule, disabled, isOverlay: isOverlaySidebar, onRenameCapsule: props.onRenameCapsule });
  const interactionDisabled = disabled || inlineRename.submitting;
  const { search, setSearch } = useCapsuleSearch(props, interactionDisabled, setRowMenuAnchor, setRowMenuCapsule);
  const selectedCount = props.selectedRegenerationUrls.length;
  useEffect(() => {
    if (activeTab !== "all" && !resolvedSets.some((set) => set.id === activeTab)) {
      setActiveTab("all");
    }
  }, [activeTab, resolvedSets]);

  useEffect(() => {
    if (selectedCount === 0) {
      setSelectionMode(false);
    }
  }, [selectedCount]);

  const requestRegenerateAll = async () => {
    if (interactionDisabled) return;
    if (props.hasFilterChanges) setConfirm({ action: "regenerate-with-filter-changes", capsuleId: "", outfitSetIndex: -1 });
    else if (props.items.length > 0) setConfirm({ action: "regenerate-all", capsuleId: "", outfitSetIndex: -1 });
    else await props.onRefreshItems();
  };

  const openProductMenu = (event: MouseEvent<HTMLButtonElement>, url: string, item: MainScreenItem) => setProductMenu({ anchor: event.currentTarget, url, item });
  const updateColumns = (value: MobileCardColumns) => {
    setMobileColumns(value);
    writeStoredMobileCardColumns(value);
  };

  return (
    <>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "320px minmax(0, 1fr)" }, gap: 3, flex: 1, minHeight: 0, overflow: "hidden" }}>
        <MainScreenSidebar props={props} disabled={interactionDisabled} isSigningOut={props.isSigningOut} />
        <Stack spacing={0} sx={capsulePanelSx}>
          <MainScreenHeader activeCapsule={props.activeCapsule} activeName={activeName} disabled={interactionDisabled} inlineRename={inlineRename} isOverlay={isOverlaySidebar} selectedCount={selectedCount} summary={summary} onCancelSelection={props.onCancelRegenerationSelection} onOpenFilters={() => setFiltersOpen(true)} onOpenMenu={(event) => setHeaderMenuAnchor(event.currentTarget)} onRegenerateAll={requestRegenerateAll} onRegenerateSelected={props.onRegenerateSelectedItems} />
          <MainScreenTabs activeTab={activeTab} disabled={interactionDisabled} isOverlay={isOverlaySidebar} selectedCount={selectedCount} sets={resolvedSets} summary={summary} onChange={setActiveTab} />
          <Divider />
          {props.isContentBusy || share.loading ? <LinearProgress color="success" sx={{ height: 2 }} /> : null}
          <MainScreenWardrobe activeImageSrc={activeImageSrc} activeSet={activeSet} disabled={interactionDisabled} isImagePending={Boolean(activeSet && props.pendingImageSetIndexes?.includes(activeSet.index))} isLoading={props.isLoadingItems} isOverlay={isOverlaySidebar} mobileColumns={mobileColumns} partialPendingUrls={props.partialRegenerationPendingUrls} selectedUrls={props.selectedRegenerationUrls} selectionMode={selectionMode || selectedCount > 0} showAdditionalItemPlaceholder={props.showAdditionalItemPlaceholder} visibleItems={visibleItems} onDeleteImage={(index) => setConfirm({ action: "delete-outfit-set-image", capsuleId: "", outfitSetIndex: index })} onGenerateImage={props.onGenerateOutfitSetImage} onImageClick={() => setImageDialogOpen(true)} onProductMenuClick={openProductMenu} onToggleSelected={props.onToggleRegenerationSelection} />
        </Stack>
        <MainScreenDialogs activeImageSrc={activeImageSrc} activeSetLabel={activeSet?.label} confirm={confirm} filtersOpen={filtersOpen} imageDialogOpen={imageDialogOpen} interactionDisabled={interactionDisabled} isOverlay={isOverlaySidebar} nameDialog={nameDialog} props={props} search={search} share={share} setConfirm={setConfirm} setFiltersOpen={setFiltersOpen} setImageDialogOpen={setImageDialogOpen} setNameDialog={setNameDialog} setSearch={setSearch} setShare={setShare} onOpenCapsule={props.onOpenCapsule} onCloseRowMenu={() => { setRowMenuAnchor(null); setRowMenuCapsule(null); }} />
      </Box>
      <MainScreenMenus
        activeName={activeName}
        disabled={interactionDisabled}
        headerMenuAnchor={headerMenuAnchor}
        isOverlay={isOverlaySidebar}
        mobileColumns={mobileColumns}
        productMenu={productMenu}
        props={props}
        rowMenuAnchor={rowMenuAnchor}
        rowMenuCapsule={rowMenuCapsule}
        setConfirm={setConfirm}
        setHeaderMenuAnchor={setHeaderMenuAnchor}
        setNameDialog={setNameDialog}
        setProductMenu={setProductMenu}
        setRowMenuAnchor={setRowMenuAnchor}
        setRowMenuCapsule={setRowMenuCapsule}
        setSelectionMode={setSelectionMode}
        onRegenerateAll={requestRegenerateAll}
        onShareCapsule={shareCapsule}
        onUpdateColumns={updateColumns}
        t={t}
      />
    </>
  );
}

export default MainScreen;
