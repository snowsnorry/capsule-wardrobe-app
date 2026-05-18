import { buildAppPresentationModel } from "./appPresentationModel";
import type { MouseEvent } from "react";
import type { useAppHandlers } from "./useAppHandlers";
import type { useAppNavigation } from "./useAppNavigation";
import type { useAppNotifications } from "./useAppNotifications";
import type { useAppState } from "./useAppState";
import type { useProfileOptions } from "./useProfileOptions";
import type { buildAppViewState } from "./appViewState";
import type { CapsuleMeta, PasskeyPromptState } from "./appTypes";

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
    openSearchDialog: () =>
      state.capsuleSidebarActionsRef.current?.openSearchDialog(),
  };
}

function buildHandlers(handlers: ReturnType<typeof useAppHandlers>) {
  return {
    onApplyCapsuleFilters: handlers.handleApplyCapsuleFilters,
    onBackToMain: handlers.handleBackToMain,
    onCancelRegenerationSelection: handlers.handleCancelRegenerationSelection,
    onCreateCapsule: handlers.handleCreateCapsule,
    onCreateCapsuleFromSidebar: handlers.handleCreateCapsuleFromSidebar,
    onDeleteCapsule: handlers.handleDeleteCapsule,
    onDeleteOutfitSetImage: handlers.handleDeleteOutfitSetImage,
    onDeleteProfile: handlers.handleDeleteProfile,
    onDownloadWardrobePdf: handlers.handleDownloadWardrobePdf,
    onDuplicateCapsule: handlers.handleDuplicateCapsule,
    onGenerateOutfitSetImage: handlers.handleGenerateOutfitSetImage,
    onGoogleCredential: handlers.handleGoogleCredential,
    onNavigateApp: handlers.handleNavigateApp,
    onOpenCapsule: handlers.handleOpenCapsule,
    onOpenCapsuleFromSidebar: handlers.handleOpenCapsuleFromSidebar,
    onPasskeySignIn: handlers.handlePasskeySignIn,
    onRefreshWardrobe: handlers.handleRefreshWardrobe,
    onRegenerateSelectedItems: handlers.handleRegenerateSelectedItems,
    onRenameCapsule: handlers.handleRenameCapsule,
    onRequestCode: handlers.handleRequestCode,
    onRequestSignOut: handlers.handleRequestSignOut,
    onResetEmail: handlers.resetToEmail,
    onResetProfileFilters: handlers.handleResetProfileFilters,
    onRevertCapsule: handlers.handleRevertCapsule,
    onSaveCapsule: handlers.handleSaveCapsule,
    onRemoveFromMyWardrobe: handlers.handleRemoveFromMyWardrobe,
    onSaveToMyWardrobe: handlers.handleSaveToMyWardrobe,
    onUpdateUploadedWardrobeItem: handlers.handleUpdateUploadedWardrobeItem,
    onSaveProfile: handlers.handleSaveProfile,
    onSearchCapsules: handlers.handleSearchCapsules,
    onShareCapsule: handlers.handleShareCapsule,
    onToggleRegenerationSelection: handlers.handleToggleRegenerationSelection,
    onVerifyCode: handlers.handleVerifyCode,
    registerCapsuleSidebarActions: handlers.registerCapsuleSidebarActions,
  };
}

function buildLayout(input: ControllerModelInput) {
  const state = input.appState;
  const viewState = input.viewState;

  return {
    activeCapsuleId: state.activeCapsuleId,
    activeCapsuleMeta: state.activeCapsuleMeta,
    appRoute: input.navigation.appRoute,
    capsuleList: state.capsuleList,
    cardPadding: input.cardPadding,
    currentView: state.currentView,
    hasBrandedPanelHeader: viewState.hasBrandedPanelHeader,
    isContentBusy: viewState.isContentBusy,
    isLarge: input.isLarge,
    isMainScreenView: viewState.isMainScreenView,
    isMyWardrobeView: viewState.isMyWardrobeView,
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
    selectedAnchorWardrobeItemIds: state.selectedAnchorWardrobeItemIds,
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
    setSelectedAnchorWardrobeItemIds: state.setSelectedAnchorWardrobeItemIds,
    toggleSelection: input.toggleSelection,
  };
}
