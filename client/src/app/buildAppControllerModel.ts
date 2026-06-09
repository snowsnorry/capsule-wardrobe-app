import { buildAppPresentationModel } from "./appPresentationModel";
import type { MouseEvent } from "react";
import type { useAppHandlers } from "./useAppHandlers";
import type { useAppNavigation } from "./useAppNavigation";
import type { useAppNotifications } from "./useAppNotifications";
import type { useAppState } from "./useAppState";
import type { useProfileOptions } from "./useProfileOptions";
import type { buildAppViewState } from "./appViewState";
import type { CapsuleMeta, OutfitMeta, PasskeyPromptState } from "./appTypes";

type ControllerModelInput = {
  appState: ReturnType<typeof useAppState>;
  appTheme: unknown;
  cardPadding: number;
  clearShareRoute: () => void;
  dismissPasskeyPrompt: () => void;
  handleAddPasskeyFromPrompt: () => Promise<void> | void;
  handlers: ReturnType<typeof useAppHandlers>;
  isLarge: boolean;
  isShareDialogOpen: boolean;
  isShareLoading: boolean;
  navigation: ReturnType<typeof useAppNavigation>;
  notifications: ReturnType<typeof useAppNotifications>;
  passkeyPrompt: PasskeyPromptState;
  profileOptions: ReturnType<typeof useProfileOptions>;
  requestBrowserNotificationPermission: () => Promise<unknown> | unknown;
  setIsSignOutConfirmOpen: (open: boolean) => void;
  setStatus: ReturnType<typeof useAppState>["setStatus"];
  shareMetadata: unknown;
  t: (key: string, params?: Record<string, unknown>) => string;
  toggleSelection: (
    value: string,
    selected: string[],
    setter: (value: string[]) => void,
  ) => void;
  viewState: ReturnType<typeof buildAppViewState>;
};

export function buildAppControllerModel(input: ControllerModelInput) {
  return buildAppPresentationModel({
    actions: buildActions(input),
    handlers: buildHandlers(input.handlers),
    layout: buildLayout(input),
    notifications: buildNotifications(input),
    options: buildOptions(input.profileOptions),
    session: buildSession(input.appState),
    share: buildShare(input),
    theme: input.appTheme,
    view: buildView(input),
  });
}

function buildActions(input: ControllerModelInput) {
  const state = input.appState;
  const handlers = input.handlers;

  return {
    ...handlers,
    onAddPasskey: () => {
      void input.handleAddPasskeyFromPrompt();
    },
    onClearError: () =>
      input.setStatus((current) => ({ ...current, error: "" })),
    onClearShareRoute: input.clearShareRoute,
    onCloseSignOutConfirm: () => input.setIsSignOutConfirmOpen(false),
    onDismissPasskey: input.dismissPasskeyPrompt,
    onImportSharedCapsule: () => {
      void handlers.handleImportSharedCapsule();
    },
    onLogout: () => {
      void handlers.signOut();
    },
    onRequestNotificationPermission: () => {
      void input.requestBrowserNotificationPermission();
    },
    onSaveSettings: handlers.handleSaveSettings,
    openCapsuleActions: (
      event: MouseEvent<HTMLElement>,
      capsule: CapsuleMeta,
    ) => {
      state.capsuleSidebarActionsRef.current?.openCapsuleActions(
        event,
        capsule,
      );
    },
    openOutfitActions: (event: MouseEvent<HTMLElement>, outfit: OutfitMeta) => {
      state.outfitSidebarActionsRef.current?.openOutfitActions(event, outfit);
    },
    openSearchDialog: () =>
      state.capsuleSidebarActionsRef.current?.openSearchDialog(),
    openOutfitSearchDialog: () =>
      state.outfitSidebarActionsRef.current?.openSearchDialog(),
  };
}

function buildHandlers(handlers: ReturnType<typeof useAppHandlers>) {
  return {
    onApplyCapsuleFilters: handlers.handleApplyCapsuleFilters,
    onBackToMain: handlers.handleBackToMain,
    onCancelRegenerationSelection: handlers.handleCancelRegenerationSelection,
    onCopyOutfitSetToOutfits: handlers.handleCopyOutfitSetToOutfits,
    onCreateCapsule: handlers.handleCreateCapsule,
    onCreateCapsuleFromSidebar: handlers.handleCreateCapsuleFromSidebar,
    onCreateOutfit: handlers.handleCreateOutfit,
    onCreateOutfitFromSidebar: handlers.handleCreateOutfitFromSidebar,
    onDeleteCapsule: handlers.handleDeleteCapsule,
    onDeleteOutfit: handlers.handleDeleteOutfit,
    onDeleteOutfitImage: handlers.handleDeleteOutfitImage,
    onDeleteOutfitSetImage: handlers.handleDeleteOutfitSetImage,
    onDeleteProfile: handlers.handleDeleteProfile,
    onDownloadWardrobePdf: handlers.handleDownloadWardrobePdf,
    onDownloadOutfitPdf: handlers.handleDownloadOutfitPdf,
    onDuplicateCapsule: handlers.handleDuplicateCapsule,
    onDuplicateOutfit: handlers.handleDuplicateOutfit,
    onGenerateOutfitSetImage: handlers.handleGenerateOutfitSetImage,
    onGenerateOutfitImage: handlers.handleGenerateOutfitImage,
    onGoogleCredential: handlers.handleGoogleCredential,
    onNavigateApp: handlers.handleNavigateApp,
    onLoadMoreCapsules: handlers.handleLoadMoreCapsules,
    onLoadMoreOutfits: handlers.handleLoadMoreOutfits,
    onOpenCapsule: handlers.handleOpenCapsule,
    onOpenCapsuleFromSidebar: handlers.handleOpenCapsuleFromSidebar,
    onOpenOutfit: handlers.handleOpenOutfit,
    onOpenOutfitFromSidebar: handlers.handleOpenOutfitFromSidebar,
    onPasskeySignIn: handlers.handlePasskeySignIn,
    onRefreshWardrobe: handlers.handleRefreshWardrobe,
    onReplaceOutfitItems: handlers.handleReplaceOutfitItems,
    onRegenerateSelectedItems: handlers.handleRegenerateSelectedItems,
    onRenameCapsule: handlers.handleRenameCapsule,
    onRenameOutfit: handlers.handleRenameOutfit,
    onRequestCode: handlers.handleRequestCode,
    onRequestSignOut: handlers.handleRequestSignOut,
    onResetEmail: handlers.resetToEmail,
    onResetProfileFilters: handlers.handleResetProfileFilters,
    onRevertCapsule: handlers.handleRevertCapsule,
    onRevertOutfit: handlers.handleRevertOutfit,
    onSaveCapsule: handlers.handleSaveCapsule,
    onSaveOutfit: handlers.handleSaveOutfit,
    onRemoveFromPersonalItems: handlers.handleRemoveFromPersonalItems,
    onSaveToPersonalItems: handlers.handleSaveToPersonalItems,
    onSetItemLike: handlers.handleSetItemLike,
    onUpdateUploadedWardrobeItem: handlers.handleUpdateUploadedWardrobeItem,
    onSaveProfile: handlers.handleSaveProfile,
    onSearchCapsules: handlers.handleSearchCapsules,
    onSearchOutfits: handlers.handleSearchOutfits,
    onShareCapsule: handlers.handleShareCapsule,
    onToggleRegenerationSelection: handlers.handleToggleRegenerationSelection,
    onVerifyCode: handlers.handleVerifyCode,
    registerCapsuleSidebarActions: handlers.registerCapsuleSidebarActions,
    registerOutfitSidebarActions: handlers.registerOutfitSidebarActions,
  };
}

function buildLayout(input: ControllerModelInput) {
  const state = input.appState;
  const viewState = input.viewState;

  return {
    activeCapsuleId: state.activeCapsuleId,
    activeCapsuleMeta: state.activeCapsuleMeta,
    activeOutfitId: state.activeOutfitId,
    activeOutfitMeta: state.activeOutfitMeta,
    appRoute: input.navigation.appRoute,
    capsuleRouteId: input.navigation.capsuleRouteId,
    outfitRouteId: input.navigation.outfitRouteId,
    capsuleList: state.capsuleList,
    capsulePagination: state.capsulePagination,
    outfitList: state.outfitList,
    outfitPagination: state.outfitPagination,
    cardPadding: input.cardPadding,
    currentView: state.currentView,
    hasBrandedPanelHeader: viewState.hasBrandedPanelHeader,
    isContentBusy: viewState.isContentBusy,
    isOutfitImagePending: state.isOutfitImagePending,
    isLarge: input.isLarge,
    isMainScreenView: viewState.isMainScreenView,
    isWardrobeView: viewState.isWardrobeView,
    isSearchView: viewState.isSearchView,
    isSignInView: viewState.isSignInView,
    isStatisticsView: viewState.isStatisticsView,
    sessionInitialized: state.sessionInitialized,
    settingsProfile: state.settingsProfile,
    t: input.t,
    user: state.user,
  };
}

function buildNotifications(input: ControllerModelInput) {
  return {
    notificationOpen: input.notifications.notificationPrompt.open,
    passkeyPrompt: input.passkeyPrompt,
  };
}

function buildOptions(profileOptions: ReturnType<typeof useProfileOptions>) {
  return {
    audienceOptions: profileOptions.audienceOptions,
    occasionOptions: profileOptions.occasionOptions,
    orderedSeasonOptions: profileOptions.orderedSeasonOptions,
    patternOptions: profileOptions.patternOptions,
    styleOptions: profileOptions.styleOptions,
  };
}

function buildSession(state: ReturnType<typeof useAppState>) {
  return {
    code: state.code,
    email: state.email,
    hasProfile: state.hasProfile,
    isCheckingSession: state.isCheckingSession,
    profileCreated: state.profileCreated,
    status: state.status,
    step: state.step,
  };
}

function buildShare(input: ControllerModelInput) {
  return {
    isShareDialogOpen: input.isShareDialogOpen,
    isShareLoading: input.isShareLoading,
    isSignOutConfirmOpen: input.appState.isSignOutConfirmOpen,
    shareMetadata: input.shareMetadata,
  };
}

function buildView(input: ControllerModelInput) {
  const state = input.appState;

  return {
    hasFilterChanges: input.viewState.hasFilterChanges,
    hasPendingAdditionalItems: state.hasPendingAdditionalItems,
    isDownloadingWardrobePdf: state.isDownloadingWardrobePdf,
    isLoadingItems: state.isLoadingItems,
    isPartialRegenerationLoading: state.isPartialRegenerationLoading,
    isSigningOut: state.status.loading,
    partialRegenerationPendingUrls: state.partialRegenerationPendingUrls,
    pendingImageSetIndexes: state.pendingImageSetIndexes,
    profileItems: state.profileItems,
    profileOutfitSets: state.profileOutfitSets,
    searchAutoOpenProductDetail: input.navigation.searchAutoOpenProductDetail,
    searchInitialQuery: input.navigation.searchInitialQuery,
    selectedAudience: state.selectedAudience,
    selectedColor: state.selectedColor,
    selectedFormalityLevel: state.selectedFormalityLevel,
    selectedOccasions: state.selectedOccasions,
    selectedPattern: state.selectedPattern,
    selectedRegenerationUrls: state.selectedRegenerationUrls,
    selectedSeason: state.selectedSeason,
    selectedSourceMode: state.selectedSourceMode,
    selectedStyle: state.selectedStyle,
    selectedText: state.selectedText,
    selectedAnchorItemRefs: state.selectedAnchorItemRefs,
    setCode: state.setCode,
    setEmail: state.setEmail,
    setSelectedAudience: state.setSelectedAudience,
    setSelectedColor: state.setSelectedColor,
    setSelectedFormalityLevel: state.setSelectedFormalityLevel,
    setSelectedOccasions: state.setSelectedOccasions,
    setSelectedPattern: state.setSelectedPattern,
    setSelectedSeason: state.setSelectedSeason,
    setSelectedSourceMode: state.setSelectedSourceMode,
    setSelectedStyle: state.setSelectedStyle,
    setSelectedText: state.setSelectedText,
    setSelectedAnchorItemRefs: state.setSelectedAnchorItemRefs,
    toggleSelection: input.toggleSelection,
  };
}
