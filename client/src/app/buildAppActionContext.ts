import type { AppActionContext } from "./actionContext";
import type { useAppHandlers } from "./useAppHandlers";
import type { useAppState } from "./useAppState";

type AppActionContextInput = {
  appState: ReturnType<typeof useAppState>;
  applyCapsuleState: AppActionContext["applyCapsuleState"];
  applyWardrobeSnapshot: AppActionContext["applyWardrobeSnapshot"];
  bootstrapCapsules: AppActionContext["bootstrapCapsules"];
  buildCurrentDraftSnapshot: AppActionContext["buildCurrentDraftSnapshot"];
  clearShareRoute: AppActionContext["clearShareRoute"];
  closeNotificationPrompt: AppActionContext["closeNotificationPrompt"];
  handlers: ReturnType<typeof useAppHandlers>;
  locale: string;
  pendingShareId: string;
  resolveErrorMessage: AppActionContext["resolveErrorMessage"];
  setIsShareLoading: AppActionContext["setIsShareLoading"];
  setLocale: AppActionContext["setLocale"];
  shareMetadata: AppActionContext["shareMetadata"];
  startCapsuleEventStream: AppActionContext["startCapsuleEventStream"];
  startPendingNotificationFlow: AppActionContext["startPendingNotificationFlow"];
  t: AppActionContext["t"];
};

export function buildAppActionContext(input: AppActionContextInput) {
  const state = input.appState;

  return {
    activeCapsuleId: state.activeCapsuleId,
    activeCapsuleMeta: state.activeCapsuleMeta,
    activeOutfitId: state.activeOutfitId,
    activeOutfitMeta: state.activeOutfitMeta,
    applyCapsuleState: input.applyCapsuleState,
    applyWardrobeSnapshot: input.applyWardrobeSnapshot,
    bootstrapCapsules: input.bootstrapCapsules,
    buildCurrentDraftSnapshot: input.buildCurrentDraftSnapshot,
    capsuleList: state.capsuleList,
    capsulePagination: state.capsulePagination,
    outfitList: state.outfitList,
    outfitPagination: state.outfitPagination,
    capsuleEventsAbortRef: state.capsuleEventsAbortRef,
    clearShareRoute: input.clearShareRoute,
    closeNotificationPrompt: input.closeNotificationPrompt,
    handleLogout: async () => {
      await input.handlers.signOut();
    },
    isMountedRef: state.isMountedRef,
    isPartialRegenerationLoading: state.isPartialRegenerationLoading,
    locale: input.locale,
    manualWardrobeRegenerationCapsuleIdRef:
      state.manualWardrobeRegenerationCapsuleIdRef,
    pendingShareId: input.pendingShareId,
    pendingNotificationKindRef: state.pendingNotificationKindRef,
    pendingRegenerationUrlsRef: state.pendingRegenerationUrlsRef,
    profileItems: state.profileItems,
    regenerationBaseItemsRef: state.regenerationBaseItemsRef,
    resolveErrorMessage: input.resolveErrorMessage,
    selectedAudience: state.selectedAudience,
    selectedFormalityLevel: state.selectedFormalityLevel,
    selectedOccasions: state.selectedOccasions,
    selectedRegenerationUrls: state.selectedRegenerationUrls,
    selectedSeason: state.selectedSeason,
    setActiveCapsuleMeta: state.setActiveCapsuleMeta,
    setActiveOutfitId: state.setActiveOutfitId,
    setActiveOutfitMeta: state.setActiveOutfitMeta,
    setCapsuleList: state.setCapsuleList,
    setCapsulePagination: state.setCapsulePagination,
    setCurrentView: state.setCurrentView,
    setHasPendingAdditionalItems: state.setHasPendingAdditionalItems,
    setHasProfile: state.setHasProfile,
    setIsContentOperationLoading: state.setIsContentOperationLoading,
    setIsDownloadingWardrobePdf: state.setIsDownloadingWardrobePdf,
    setIsOutfitImagePending: state.setIsOutfitImagePending,
    setIsOutfitReportPending: state.setIsOutfitReportPending,
    setIsLoadingItems: state.setIsLoadingItems,
    setIsPartialRegenerationLoading: state.setIsPartialRegenerationLoading,
    setIsShareLoading: input.setIsShareLoading,
    setIsWardrobePending: state.setIsWardrobePending,
    setLocale: input.setLocale,
    setOutfitList: state.setOutfitList,
    setOutfitPagination: state.setOutfitPagination,
    setPartialRegenerationPendingUrls: state.setPartialRegenerationPendingUrls,
    setPendingImageSetIndexes: state.setPendingImageSetIndexes,
    setProfileCreated: state.setProfileCreated,
    setProfileItems: state.setProfileItems,
    setProfileOutfitSets: state.setProfileOutfitSets,
    setSelectedRegenerationUrls: state.setSelectedRegenerationUrls,
    setSettingsProfile: state.setSettingsProfile,
    setStatus: state.setStatus,
    settingsProfile: state.settingsProfile,
    shareMetadata: input.shareMetadata,
    startCapsuleEventStream: input.startCapsuleEventStream,
    startPendingNotificationFlow: input.startPendingNotificationFlow,
    t: input.t,
    user: state.user,
  };
}
