import type { MouseEvent } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Box, Divider, LinearProgress, Stack } from "@mui/material";
import type { Theme } from "@mui/material/styles";
import MainScreenDialogs from "./MainScreenDialogs";
import MainScreenHeader from "./MainScreenHeader";
import MainScreenMenus from "./MainScreenMenus";
import MainScreenSidebar from "./MainScreenSidebar";
import MainScreenTabs from "./MainScreenTabs";
import MainScreenWardrobe from "./MainScreenWardrobe";
import type {
  MainScreenDisplay,
  SearchState,
  ShareState,
} from "./MainScreenHooks";
import type {
  CapsuleLike,
  CapsuleMenuAnchor,
  MainScreenItem,
  MainScreenProps,
  MobileCardColumns,
} from "./MainScreenTypes";

type NameDialogState = {
  type: "rename" | "save-as" | "";
  capsuleId: string;
  value: string;
};

type ConfirmState = {
  action: string;
  capsuleId: string;
  outfitSetIndex: number;
};

type ProductMenuState = {
  anchor: CapsuleMenuAnchor;
  url: string;
  item: MainScreenItem | null;
};

type InlineRenameState = {
  active: boolean;
  value: string;
  setValue: (value: string) => void;
  start: () => void;
  cancel: () => void;
  submit: () => Promise<void>;
};

type MainScreenViewProps = {
  activeTab: string;
  confirm: ConfirmState;
  display: MainScreenDisplay;
  filtersOpen: boolean;
  headerMenuAnchor: CapsuleMenuAnchor;
  imageDialogOpen: boolean;
  inlineRename: InlineRenameState;
  interactionDisabled: boolean;
  isOverlaySidebar: boolean;
  mobileColumns: MobileCardColumns;
  nameDialog: NameDialogState;
  productMenu: ProductMenuState;
  props: MainScreenProps;
  requestRegenerateAll: () => void;
  rowMenuAnchor: CapsuleMenuAnchor;
  rowMenuCapsule: CapsuleLike | null;
  search: SearchState;
  selectedCount: number;
  selectionMode: boolean;
  setActiveTab: (tab: string) => void;
  setConfirm: (state: ConfirmState) => void;
  setFiltersOpen: (open: boolean) => void;
  setHeaderMenuAnchor: (anchor: CapsuleMenuAnchor) => void;
  setImageDialogOpen: (open: boolean) => void;
  setNameDialog: (state: NameDialogState) => void;
  setProductMenu: (state: ProductMenuState) => void;
  setRowMenuAnchor: (anchor: CapsuleMenuAnchor) => void;
  setRowMenuCapsule: (capsule: CapsuleLike | null) => void;
  setSearch: Dispatch<SetStateAction<SearchState>>;
  setSelectionMode: (selected: boolean) => void;
  setShare: Dispatch<SetStateAction<ShareState>>;
  share: ShareState;
  shareCapsule: (
    capsule?: CapsuleLike | null,
    allowUnknownContent?: boolean,
  ) => void;
  t: (key: string, params?: Record<string, unknown>) => string;
  updateColumns: (value: MobileCardColumns) => void;
};

const capsulePanelSx = (theme: Theme) => ({
  minWidth: 0,
  minHeight: 0,
  overflow: "hidden",
  border: { lg: `1px solid ${theme.palette.divider}` },
  borderRadius: { lg: "10px" },
  backgroundColor: "background.paper",
});

function MainScreenView(model: MainScreenViewProps) {
  return (
    <>
      <MainScreenBody {...model} />
      <MainScreenMenus
        activeName={model.display.activeName}
        disabled={model.interactionDisabled}
        headerMenuAnchor={model.headerMenuAnchor}
        isOverlay={model.isOverlaySidebar}
        mobileColumns={model.mobileColumns}
        productMenu={model.productMenu}
        props={model.props}
        rowMenuAnchor={model.rowMenuAnchor}
        rowMenuCapsule={model.rowMenuCapsule}
        setConfirm={model.setConfirm}
        setHeaderMenuAnchor={model.setHeaderMenuAnchor}
        setNameDialog={model.setNameDialog}
        setProductMenu={model.setProductMenu}
        setRowMenuAnchor={model.setRowMenuAnchor}
        setRowMenuCapsule={model.setRowMenuCapsule}
        setSelectionMode={model.setSelectionMode}
        onRegenerateAll={model.requestRegenerateAll}
        onShareCapsule={model.shareCapsule}
        onUpdateColumns={model.updateColumns}
        t={model.t}
      />
    </>
  );
}

function MainScreenBody(model: MainScreenViewProps) {
  return (
    <Box sx={mainScreenBodySx}>
      <MainScreenSidebar
        props={model.props}
        disabled={model.interactionDisabled}
        isSigningOut={model.props.isSigningOut}
      />
      <MainScreenCapsulePanel {...model} />
      <MainScreenDialogsPanel {...model} />
    </Box>
  );
}

const mainScreenBodySx = {
  display: "grid",
  gridTemplateColumns: { xs: "1fr", lg: "320px minmax(0, 1fr)" },
  gap: 3,
  flex: 1,
  minHeight: 0,
  overflow: "hidden",
} as const;

function MainScreenCapsulePanel(model: MainScreenViewProps) {
  const {
    activeImageSrc,
    activeName,
    activeSet,
    resolvedSets,
    summary,
    visibleItems,
  } = model.display;
  return (
    <Stack spacing={0} sx={capsulePanelSx}>
      <MainScreenHeader
        activeCapsule={model.props.activeCapsule}
        activeName={activeName}
        disabled={model.interactionDisabled}
        inlineRename={model.inlineRename}
        isOverlay={model.isOverlaySidebar}
        selectedCount={model.selectedCount}
        summary={summary}
        onCancelSelection={model.props.onCancelRegenerationSelection}
        onOpenFilters={() => model.setFiltersOpen(true)}
        onOpenMenu={(event: MouseEvent<HTMLElement>) =>
          model.setHeaderMenuAnchor(event.currentTarget)
        }
        onRegenerateAll={model.requestRegenerateAll}
        onRegenerateSelected={model.props.onRegenerateSelectedItems}
      />
      <MainScreenTabs
        activeTab={model.activeTab}
        disabled={model.interactionDisabled}
        isOverlay={model.isOverlaySidebar}
        selectedCount={model.selectedCount}
        sets={resolvedSets}
        summary={summary}
        onChange={model.setActiveTab}
      />
      <Divider />
      {model.props.isContentBusy || model.share.loading ? (
        <LinearProgress color="success" sx={{ height: 2 }} />
      ) : null}
      <MainScreenWardrobe
        activeImageSrc={activeImageSrc}
        activeSet={activeSet}
        disabled={model.interactionDisabled}
        isImagePending={Boolean(
          activeSet &&
          model.props.pendingImageSetIndexes?.includes(activeSet.index),
        )}
        isLoading={model.props.isLoadingItems}
        isOverlay={model.isOverlaySidebar}
        mobileColumns={model.mobileColumns}
        partialPendingUrls={model.props.partialRegenerationPendingUrls}
        selectedUrls={model.props.selectedRegenerationUrls}
        selectionMode={model.selectionMode || model.selectedCount > 0}
        showAdditionalItemPlaceholder={
          model.props.showAdditionalItemPlaceholder
        }
        visibleItems={visibleItems}
        onDeleteImage={(index) =>
          model.setConfirm({
            action: "delete-outfit-set-image",
            capsuleId: "",
            outfitSetIndex: index,
          })
        }
        onGenerateImage={model.props.onGenerateOutfitSetImage}
        onImageClick={() => model.setImageDialogOpen(true)}
        onProductMenuClick={(event, url, item) =>
          model.setProductMenu({ anchor: event.currentTarget, url, item })
        }
        onToggleSelected={model.props.onToggleRegenerationSelection}
      />
    </Stack>
  );
}

function MainScreenDialogsPanel(model: MainScreenViewProps) {
  return (
    <MainScreenDialogs
      activeImageSrc={model.display.activeImageSrc}
      activeSetLabel={model.display.activeSet?.label}
      confirm={model.confirm}
      filtersOpen={model.filtersOpen}
      imageDialogOpen={model.imageDialogOpen}
      interactionDisabled={model.interactionDisabled}
      isOverlay={model.isOverlaySidebar}
      nameDialog={model.nameDialog}
      props={model.props}
      search={model.search}
      share={model.share}
      setConfirm={model.setConfirm}
      setFiltersOpen={model.setFiltersOpen}
      setImageDialogOpen={model.setImageDialogOpen}
      setNameDialog={model.setNameDialog}
      setSearch={model.setSearch}
      setShare={model.setShare}
      onOpenCapsule={model.props.onOpenCapsule}
      onCloseRowMenu={() => {
        model.setRowMenuAnchor(null);
        model.setRowMenuCapsule(null);
      }}
    />
  );
}

export default MainScreenView;
