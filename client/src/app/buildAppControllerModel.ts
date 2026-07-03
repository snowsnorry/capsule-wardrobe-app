import { buildAppPresentationModel } from "./appPresentationModel";
import type { MouseEvent } from "react";
import type { useAppHandlers } from "./useAppHandlers";
import type { useAppNavigation } from "./useAppNavigation";
import type { useAppNotifications } from "./useAppNotifications";
import type { useAppState } from "./useAppState";
import type { useProfileOptions } from "./useProfileOptions";
import type { JobTrackerState } from "./useActiveSidebarJobs";
import type { buildAppViewState } from "./appViewState";
import type {
  CapsuleMeta,
  OutfitMeta,
  PasskeyPromptState,
  ShareMetadata,
} from "./appTypes";

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
  jobTracker: JobTrackerState;
  navigation: ReturnType<typeof useAppNavigation>;
  notifications: ReturnType<typeof useAppNotifications>;
  passkeyPrompt: PasskeyPromptState;
  profileOptions: ReturnType<typeof useProfileOptions>;
  requestBrowserNotificationPermission: () => Promise<unknown> | unknown;
  setIsSignOutConfirmOpen: (open: boolean) => void;
  setStatus: ReturnType<typeof useAppState>["setStatus"];
  shareMetadata: ShareMetadata | null;
  t: (key: string, params?: Record<string, unknown>) => string;
  toggleSelection: (
    value: string,
    selected: string[],
    setter: (value: string[]) => void,
  ) => void;
  viewState: ReturnType<typeof buildAppViewState>;
};

export function buildAppControllerModel(input: ControllerModelInput) {
  const actions = buildActions(input);
  const handlers = buildHandlers(input.handlers);
  const layout = buildLayout(input);
  const notifications = buildNotifications(input);
  const options = buildOptions(input.profileOptions);
  const session = buildSession(input.appState);
  const share = buildShare(input);
  const view = buildView(input);

  return buildAppPresentationModel({
    dialogs: buildDialogModel({ actions, session, share, t: input.t }),
    route: buildRouteModel({
      actions,
      handlers,
      layout,
      options,
      session,
      view,
    }),
    shell: buildShellModel({ actions, handlers, layout }),
    snackbars: buildSnackbarModel({
      actions,
      notifications,
      session,
      t: input.t,
    }),
    theme: input.appTheme,
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
    onSaveSettings: async (
      ...args: Parameters<typeof handlers.handleSaveSettings>
    ) => {
      await handlers.handleSaveSettings(...args);
    },
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
    onDeleteCapsuleReport: handlers.handleDeleteCapsuleReport,
    onDeleteOutfit: handlers.handleDeleteOutfit,
    onDeleteOutfitImage: handlers.handleDeleteOutfitImage,
    onDeleteOutfitReport: handlers.handleDeleteOutfitReport,
    onDeleteOutfitSetImage: handlers.handleDeleteOutfitSetImage,
    onDeleteProfile: handlers.handleDeleteProfile,
    onDownloadWardrobePdf: handlers.handleDownloadWardrobePdf,
    onDownloadOutfitPdf: handlers.handleDownloadOutfitPdf,
    onDuplicateCapsule: handlers.handleDuplicateCapsule,
    onDuplicateOutfit: handlers.handleDuplicateOutfit,
    onGenerateOutfitSetImage: handlers.handleGenerateOutfitSetImage,
    onGenerateCapsuleReport: handlers.handleGenerateCapsuleReport,
    onGenerateOutfitImage: handlers.handleGenerateOutfitImage,
    onGenerateOutfitReport: handlers.handleGenerateOutfitReport,
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
    onSetCapsulePin: handlers.handleSetCapsulePin,
    onSetOutfitPin: handlers.handleSetOutfitPin,
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
    activeJobEntityKeys: input.jobTracker.activeJobEntityKeys,
    waitForJobCompletion: input.jobTracker.waitForJobCompletion,
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
    isCapsuleReportPending: state.isCapsuleReportPending,
    isOutfitImagePending: state.isOutfitImagePending,
    isOutfitReportPending: state.isOutfitReportPending,
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

function buildRouteModel({
  actions,
  handlers,
  layout,
  options,
  session,
  view,
}: {
  actions: ReturnType<typeof buildActions>;
  handlers: ReturnType<typeof buildHandlers>;
  layout: ReturnType<typeof buildLayout>;
  options: ReturnType<typeof buildOptions>;
  session: ReturnType<typeof buildSession>;
  view: ReturnType<typeof buildView>;
}) {
  return {
    activeCapsuleMeta: layout.activeCapsuleMeta,
    activeJobEntityKeys: layout.activeJobEntityKeys,
    activeOutfitMeta: layout.activeOutfitMeta,
    appRoute: layout.appRoute,
    audienceOptions: options.audienceOptions,
    capsuleList: layout.capsuleList,
    code: session.code,
    currentView: layout.currentView,
    email: session.email,
    hasFilterChanges: view.hasFilterChanges,
    hasPendingAdditionalItems: view.hasPendingAdditionalItems,
    hasProfile: session.hasProfile,
    isCapsuleReportPending: layout.isCapsuleReportPending,
    isCheckingSession: session.isCheckingSession,
    isContentBusy: layout.isContentBusy,
    isDownloadingWardrobePdf: view.isDownloadingWardrobePdf,
    isLoadingItems: view.isLoadingItems,
    isOutfitImagePending: layout.isOutfitImagePending,
    isOutfitReportPending: layout.isOutfitReportPending,
    isPartialRegenerationLoading: view.isPartialRegenerationLoading,
    isSigningOut: view.isSigningOut,
    occasionOptions: options.occasionOptions,
    orderedSeasonOptions: options.orderedSeasonOptions,
    partialRegenerationPendingUrls: view.partialRegenerationPendingUrls,
    patternOptions: options.patternOptions,
    pendingImageSetIndexes: view.pendingImageSetIndexes,
    profileCreated: session.profileCreated,
    profileItems: view.profileItems,
    profileOutfitSets: view.profileOutfitSets,
    searchAutoOpenProductDetail: view.searchAutoOpenProductDetail,
    searchInitialQuery: view.searchInitialQuery,
    selectedAnchorItemRefs: view.selectedAnchorItemRefs,
    selectedAudience: view.selectedAudience,
    selectedColor: view.selectedColor,
    selectedFormalityLevel: view.selectedFormalityLevel,
    selectedOccasions: view.selectedOccasions,
    selectedPattern: view.selectedPattern,
    selectedRegenerationUrls: view.selectedRegenerationUrls,
    selectedSeason: view.selectedSeason,
    selectedSourceMode: view.selectedSourceMode,
    selectedStyle: view.selectedStyle,
    selectedText: view.selectedText,
    sessionInitialized: layout.sessionInitialized,
    setCode: view.setCode,
    setEmail: view.setEmail,
    setSelectedAnchorItemRefs: view.setSelectedAnchorItemRefs,
    setSelectedAudience: view.setSelectedAudience,
    setSelectedColor: view.setSelectedColor,
    setSelectedFormalityLevel: view.setSelectedFormalityLevel,
    setSelectedOccasions: view.setSelectedOccasions,
    setSelectedPattern: view.setSelectedPattern,
    setSelectedSeason: view.setSelectedSeason,
    setSelectedSourceMode: view.setSelectedSourceMode,
    setSelectedStyle: view.setSelectedStyle,
    setSelectedText: view.setSelectedText,
    settingsProfile: layout.settingsProfile,
    status: session.status,
    step: session.step,
    styleOptions: options.styleOptions,
    t: layout.t,
    toggleSelection: view.toggleSelection,
    user: layout.user,
    waitForJobCompletion: layout.waitForJobCompletion,
    onSaveSettings: actions.onSaveSettings,
    ...handlers,
  };
}

function buildShellModel({
  actions,
  handlers,
  layout,
}: {
  actions: ReturnType<typeof buildActions>;
  handlers: ReturnType<typeof buildHandlers>;
  layout: ReturnType<typeof buildLayout>;
}) {
  return {
    activeCapsuleId: layout.activeCapsuleId,
    activeCapsuleMeta: layout.activeCapsuleMeta,
    activeJobEntityKeys: layout.activeJobEntityKeys,
    activeOutfitId: layout.activeOutfitId,
    activeOutfitMeta: layout.activeOutfitMeta,
    appRoute: layout.appRoute,
    capsuleList: layout.capsuleList,
    capsulePagination: layout.capsulePagination,
    capsuleRouteId: layout.capsuleRouteId,
    cardPadding: layout.cardPadding,
    currentView: layout.currentView,
    hasBrandedPanelHeader: layout.hasBrandedPanelHeader,
    isContentBusy: layout.isContentBusy,
    isLarge: layout.isLarge,
    isMainScreenView: layout.isMainScreenView,
    isSearchView: layout.isSearchView,
    isSignInView: layout.isSignInView,
    isStatisticsView: layout.isStatisticsView,
    isWardrobeView: layout.isWardrobeView,
    outfitList: layout.outfitList,
    outfitPagination: layout.outfitPagination,
    outfitRouteId: layout.outfitRouteId,
    sessionInitialized: layout.sessionInitialized,
    settingsProfile: layout.settingsProfile,
    t: layout.t,
    user: layout.user,
    onCreateCapsuleFromSidebar: handlers.onCreateCapsuleFromSidebar,
    onCreateOutfitFromSidebar: handlers.onCreateOutfitFromSidebar,
    onDeleteCapsule: handlers.onDeleteCapsule,
    onDeleteOutfit: handlers.onDeleteOutfit,
    onDeleteProfile: handlers.onDeleteProfile,
    onDownloadOutfitPdf: handlers.onDownloadOutfitPdf,
    onDownloadWardrobePdf: handlers.onDownloadWardrobePdf,
    onDuplicateCapsule: handlers.onDuplicateCapsule,
    onDuplicateOutfit: handlers.onDuplicateOutfit,
    onLoadMoreCapsules: handlers.onLoadMoreCapsules,
    onLoadMoreOutfits: handlers.onLoadMoreOutfits,
    onNavigateApp: handlers.onNavigateApp,
    onOpenCapsuleFromSidebar: handlers.onOpenCapsuleFromSidebar,
    onOpenOutfitFromSidebar: handlers.onOpenOutfitFromSidebar,
    onRenameCapsule: handlers.onRenameCapsule,
    onRenameOutfit: handlers.onRenameOutfit,
    onRequestSignOut: handlers.onRequestSignOut,
    onRevertCapsule: handlers.onRevertCapsule,
    onRevertOutfit: handlers.onRevertOutfit,
    onSaveCapsule: handlers.onSaveCapsule,
    onSaveOutfit: handlers.onSaveOutfit,
    onSaveSettings: actions.onSaveSettings,
    onSearchCapsules: handlers.onSearchCapsules,
    onSearchOutfits: handlers.onSearchOutfits,
    onSetCapsulePin: handlers.onSetCapsulePin,
    onSetOutfitPin: handlers.onSetOutfitPin,
    onShareCapsule: handlers.onShareCapsule,
    openSearchDialog: actions.openSearchDialog,
  };
}

function buildDialogModel({
  actions,
  session,
  share,
  t,
}: {
  actions: ReturnType<typeof buildActions>;
  session: ReturnType<typeof buildSession>;
  share: ReturnType<typeof buildShare>;
  t: ControllerModelInput["t"];
}) {
  return {
    isShareDialogOpen: share.isShareDialogOpen,
    isShareLoading: share.isShareLoading,
    isSignOutConfirmOpen: share.isSignOutConfirmOpen,
    onClearShareRoute: actions.onClearShareRoute,
    onCloseSignOutConfirm: actions.onCloseSignOutConfirm,
    onImportSharedCapsule: actions.onImportSharedCapsule,
    onLogout: actions.onLogout,
    shareMetadata: share.shareMetadata,
    status: session.status,
    t,
  };
}

function buildSnackbarModel({
  actions,
  notifications,
  session,
  t,
}: {
  actions: ReturnType<typeof buildActions>;
  notifications: ReturnType<typeof buildNotifications>;
  session: ReturnType<typeof buildSession>;
  t: ControllerModelInput["t"];
}) {
  return {
    notificationOpen: notifications.notificationOpen,
    onAddPasskey: actions.onAddPasskey,
    onClearError: actions.onClearError,
    onDismissPasskey: actions.onDismissPasskey,
    onRequestNotificationPermission: actions.onRequestNotificationPermission,
    passkeyPrompt: notifications.passkeyPrompt,
    status: session.status,
    t,
  };
}
