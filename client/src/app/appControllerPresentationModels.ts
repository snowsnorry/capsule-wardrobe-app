import type {
  ControllerModelActions,
  ControllerModelHandlers,
  ControllerModelInput,
  ControllerModelLayout,
  ControllerModelNotifications,
  ControllerModelOptions,
  ControllerModelSession,
  ControllerModelShare,
  ControllerModelView,
} from "./appControllerModelParts";

export function buildRouteModel({
  actions,
  handlers,
  layout,
  options,
  session,
  view,
}: {
  actions: ControllerModelActions;
  handlers: ControllerModelHandlers;
  layout: ControllerModelLayout;
  options: ControllerModelOptions;
  session: ControllerModelSession;
  view: ControllerModelView;
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

export function buildShellModel({
  actions,
  handlers,
  layout,
}: {
  actions: ControllerModelActions;
  handlers: ControllerModelHandlers;
  layout: ControllerModelLayout;
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
    personalItemsCount: layout.personalItemsCount,
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

export function buildDialogModel({
  actions,
  session,
  share,
  t,
}: {
  actions: ControllerModelActions;
  session: ControllerModelSession;
  share: ControllerModelShare;
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

export function buildSnackbarModel({
  actions,
  notifications,
  session,
  t,
}: {
  actions: ControllerModelActions;
  notifications: ControllerModelNotifications;
  session: ControllerModelSession;
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
