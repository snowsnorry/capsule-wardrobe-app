import { useEffect } from "react";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useI18n } from "../../i18n/useI18n";
import MainScreenView from "./MainScreenView";
import {
  useCapsuleDisplay,
  useCapsuleSearch,
  useInlineRename,
  useMainScreenUiState,
  useRegenerateAllRequest,
  useWardrobeOnlyRegenerationBlock,
  useShareCapsule,
} from "./MainScreenHooks";
import type { MainScreenProps } from "./MainScreenTypes";

function MainScreen(props: MainScreenProps) {
  const { t, locale } = useI18n();
  const isOverlaySidebar = useMediaQuery("(max-width: 1279.95px)");
  const ui = useMainScreenUiState();
  const display = useCapsuleDisplay(props, ui.activeTab, locale, t);
  const { activeName, resolvedSets } = display;
  const { setActiveTab, setSelectionMode } = ui;
  const { share, setShare, shareCapsule } = useShareCapsule(
    props,
    Boolean(props.isContentBusy),
    activeName,
  );
  const disabled = Boolean(props.isContentBusy || share.loading);
  const inlineRename = useInlineRename({
    activeCapsule: props.activeCapsule,
    disabled,
    isOverlay: isOverlaySidebar,
    onRenameCapsule: props.onRenameCapsule,
  });
  const interactionDisabled = disabled || inlineRename.submitting;
  const { search, setSearch } = useCapsuleSearch(
    props,
    interactionDisabled,
    ui.setRowMenuAnchor,
    ui.setRowMenuCapsule,
  );
  const selectedCount = props.selectedRegenerationUrls.length;
  const sourceModeBlocked = useWardrobeOnlyRegenerationBlock(
    props.selectedSourceMode,
  );
  useResetMissingActiveTab(ui.activeTab, resolvedSets, setActiveTab);
  useExitSelectionModeWhenEmpty(selectedCount, setSelectionMode);

  const requestRegenerateAll = useRegenerateAllRequest({
    hasFilterChanges: props.hasFilterChanges,
    interactionDisabled,
    itemCount: props.items.length,
    onRefreshItems: props.onRefreshItems,
    sourceModeBlocked,
    setConfirm: ui.setConfirm,
  });

  return (
    <MainScreenView
      activeTab={ui.activeTab}
      confirm={ui.confirm}
      display={display}
      filtersOpen={ui.filtersOpen}
      headerMenuAnchor={ui.headerMenuAnchor}
      imageDialogOpen={ui.imageDialogOpen}
      inlineRename={inlineRename}
      interactionDisabled={interactionDisabled}
      isOverlaySidebar={isOverlaySidebar}
      mobileColumns={ui.mobileColumns}
      nameDialog={ui.nameDialog}
      productDetailItem={ui.productDetailItem}
      productMenu={ui.productMenu}
      props={props}
      requestRegenerateAll={requestRegenerateAll}
      isRegenerateAllDisabled={sourceModeBlocked}
      rowMenuAnchor={ui.rowMenuAnchor}
      rowMenuCapsule={ui.rowMenuCapsule}
      search={search}
      selectedCount={selectedCount}
      selectionMode={ui.selectionMode}
      setActiveTab={ui.setActiveTab}
      setConfirm={ui.setConfirm}
      setFiltersOpen={ui.setFiltersOpen}
      setHeaderMenuAnchor={ui.setHeaderMenuAnchor}
      setImageDialogOpen={ui.setImageDialogOpen}
      setNameDialog={ui.setNameDialog}
      setProductDetailItem={ui.setProductDetailItem}
      setProductMenu={ui.setProductMenu}
      setRowMenuAnchor={ui.setRowMenuAnchor}
      setRowMenuCapsule={ui.setRowMenuCapsule}
      setSearch={setSearch}
      setSelectionMode={ui.setSelectionMode}
      setShare={setShare}
      share={share}
      shareCapsule={shareCapsule}
      t={t}
      updateColumns={ui.updateColumns}
    />
  );
}

function useResetMissingActiveTab(
  activeTab: string,
  resolvedSets: ReturnType<typeof useCapsuleDisplay>["resolvedSets"],
  setActiveTab: (tab: string) => void,
) {
  useEffect(() => {
    if (
      activeTab !== "all" &&
      !resolvedSets.some((set) => set.id === activeTab)
    ) {
      setActiveTab("all");
    }
  }, [activeTab, resolvedSets, setActiveTab]);
}

function useExitSelectionModeWhenEmpty(
  selectedCount: number,
  setSelectionMode: (selected: boolean) => void,
) {
  useEffect(() => {
    if (selectedCount === 0) {
      setSelectionMode(false);
    }
  }, [selectedCount, setSelectionMode]);
}

export default MainScreen;
