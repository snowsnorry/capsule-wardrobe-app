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
  const state = input.appState;
  const handlers = input.handlers;
  const navigation = input.navigation;
  const notifications = input.notifications;
  const profileOptions = input.profileOptions;
  const viewState = input.viewState;

  return buildAppPresentationModel({
    actions: {
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
    },
    handlers: {
      onApplyCapsuleFilters: handlers.handleApplyCapsuleFilters,
      onBackOnboarding: handlers.handleBackOnboarding,
      onBackToMain: handlers.handleBackToMain,
      onCancelRegenerationSelection: handlers.handleCancelRegenerationSelection,
      onCreateCapsule: handlers.handleCreateCapsule,
      onCreateCapsuleFromSidebar: handlers.handleCreateCapsuleFromSidebar,
      onDeleteCapsule: handlers.handleDeleteCapsule,
      onDeleteOutfitSetImage: handlers.handleDeleteOutfitSetImage,
      onDeleteProfile: handlers.handleDeleteProfile,
      onDownloadWardrobePdf: handlers.handleDownloadWardrobePdf,
      onDuplicateCapsule: handlers.handleDuplicateCapsule,
      onFinishOnboarding: handlers.handleFinishOnboarding,
      onGenerateOutfitSetImage: handlers.handleGenerateOutfitSetImage,
      onGoogleCredential: handlers.handleGoogleCredential,
      onNavigateApp: handlers.handleNavigateApp,
      onNextOnboarding: handlers.handleNextOnboarding,
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
      onSaveProfile: handlers.handleSaveProfile,
      onSearchCapsules: handlers.handleSearchCapsules,
      onShareCapsule: handlers.handleShareCapsule,
      onToggleRegenerationSelection: handlers.handleToggleRegenerationSelection,
      onVerifyCode: handlers.handleVerifyCode,
      registerCapsuleSidebarActions: handlers.registerCapsuleSidebarActions,
    },
    layout: {
      activeCapsuleId: state.activeCapsuleId,
      activeCapsuleMeta: state.activeCapsuleMeta,
      appRoute: navigation.appRoute,
      capsuleList: state.capsuleList,
      cardPadding: input.cardPadding,
      currentView: state.currentView,
      hasBrandedPanelHeader: viewState.hasBrandedPanelHeader,
      isContentBusy: viewState.isContentBusy,
      isLarge: input.isLarge,
      isMainScreenView: viewState.isMainScreenView,
      isSearchView: viewState.isSearchView,
      isSignInView: viewState.isSignInView,
      isStatisticsView: viewState.isStatisticsView,
      sessionInitialized: state.sessionInitialized,
      settingsProfile: state.settingsProfile,
      t: input.t,
      user: state.user,
    },
    notifications: {
      notificationOpen: notifications.notificationPrompt.open,
      passkeyPrompt: input.passkeyPrompt,
    },
    options: {
      audienceOptions: profileOptions.audienceOptions,
      occasionOptions: profileOptions.occasionOptions,
      orderedSeasonOptions: profileOptions.orderedSeasonOptions,
      patternOptions: profileOptions.patternOptions,
      styleOptions: profileOptions.styleOptions,
    },
    session: {
      code: state.code,
      email: state.email,
      hasProfile: state.hasProfile,
      isCheckingSession: state.isCheckingSession,
      profileCreated: state.profileCreated,
      status: state.status,
      step: state.step,
    },
    share: {
      isShareDialogOpen: input.isShareDialogOpen,
      isShareLoading: input.isShareLoading,
      isSignOutConfirmOpen: state.isSignOutConfirmOpen,
      shareMetadata: input.shareMetadata,
    },
    theme: input.appTheme,
    view: {
      hasFilterChanges: viewState.hasFilterChanges,
      hasPendingAdditionalItems: state.hasPendingAdditionalItems,
      isDownloadingWardrobePdf: state.isDownloadingWardrobePdf,
      isLoadingItems: state.isLoadingItems,
      isPartialRegenerationLoading: state.isPartialRegenerationLoading,
      isSigningOut: state.status.loading,
      onboardingStep: state.onboardingStep,
      partialRegenerationPendingUrls: state.partialRegenerationPendingUrls,
      pendingImageSetIndexes: state.pendingImageSetIndexes,
      profileItems: state.profileItems,
      profileOutfitSets: state.profileOutfitSets,
      searchAutoOpenProductDetail: navigation.searchAutoOpenProductDetail,
      searchInitialQuery: navigation.searchInitialQuery,
      selectedAudience: state.selectedAudience,
      selectedColor: state.selectedColor,
      selectedFormalityLevel: state.selectedFormalityLevel,
      selectedOccasions: state.selectedOccasions,
      selectedPattern: state.selectedPattern,
      selectedRegenerationUrls: state.selectedRegenerationUrls,
      selectedSeason: state.selectedSeason,
      selectedStyle: state.selectedStyle,
      selectedText: state.selectedText,
      setCode: state.setCode,
      setEmail: state.setEmail,
      setSelectedAudience: state.setSelectedAudience,
      setSelectedColor: state.setSelectedColor,
      setSelectedFormalityLevel: state.setSelectedFormalityLevel,
      setSelectedOccasions: state.setSelectedOccasions,
      setSelectedPattern: state.setSelectedPattern,
      setSelectedSeason: state.setSelectedSeason,
      setSelectedStyle: state.setSelectedStyle,
      setSelectedText: state.setSelectedText,
      toggleSelection: input.toggleSelection,
    },
  });
}
