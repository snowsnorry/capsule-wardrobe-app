import { normalizeProfileSettings } from "./profileSettings";
import type { SessionActionContext } from "./sessionActions";
import type { useAppNavigation } from "./useAppNavigation";
import type { useAppState } from "./useAppState";
import type { useProfileOptions } from "./useProfileOptions";

type AppSessionActionInput = {
  appState: ReturnType<typeof useAppState>;
  bootstrapCapsules: SessionActionContext["bootstrapCapsules"];
  closeNotificationPrompt: SessionActionContext["closeNotificationPrompt"];
  locale: string;
  maybeShowPasskeyPrompt: SessionActionContext["maybeShowPasskeyPrompt"];
  profileOptions: ReturnType<typeof useProfileOptions>;
  resetNavigation: ReturnType<typeof useAppNavigation>["resetNavigation"];
  resolveErrorMessage: SessionActionContext["resolveErrorMessage"];
  retry: SessionActionContext["retry"];
};

export function buildAppSessionActionContext(input: AppSessionActionInput) {
  const state = input.appState;

  const resetProfileSelections = () => {
    state.setSelectedFormalityLevel("");
    state.setSelectedStyle(null);
    state.setSelectedOccasions([]);
    state.setSelectedSeason([]);
    state.setSelectedAudience("");
    state.setSelectedColor(null);
    state.setSelectedPattern("solid");
    state.setSelectedText("");
  };

  const resetSessionState = () => {
    state.setUser(null);
    state.setHasProfile(false);
    state.setProfileCreated(false);
    state.setSettingsProfile(normalizeProfileSettings());
    state.setCurrentView("main");
    state.setStep("email");
    state.setEmail("");
    state.setCode("");
    resetProfileSelections();
  };

  const resetCapsuleState = () => {
    state.setProfileItems(null);
    state.setProfileOutfitSets([]);
    state.setPendingImageSetIndexes([]);
    state.setActiveCapsuleId("");
    state.setActiveCapsuleMeta(null);
    state.setCapsuleList([]);
    state.setIsLoadingItems(false);
    state.setIsDownloadingWardrobePdf(false);
    state.setSelectedRegenerationUrls([]);
    state.setPartialRegenerationPendingUrls([]);
    state.setIsPartialRegenerationLoading(false);
    state.setIsWardrobePending(false);
    state.setHasPendingAdditionalItems(false);
    state.pendingRegenerationUrlsRef.current = [];
    state.regenerationBaseItemsRef.current = [];
    state.manualWardrobeRegenerationCapsuleIdRef.current = "";
    state.pendingNotificationKindRef.current = "";
  };

  const sessionActionContext: SessionActionContext = {
    bootstrapCapsules: input.bootstrapCapsules,
    closeNotificationPrompt: input.closeNotificationPrompt,
    code: state.code,
    email: state.email,
    ensureOptionsLoaded: input.profileOptions.ensureOptionsLoaded,
    locale: input.locale,
    maybeShowPasskeyPrompt: input.maybeShowPasskeyPrompt,
    resetCapsuleState,
    resetNavigation: input.resetNavigation,
    resetProfileOptions: input.profileOptions.resetProfileOptions,
    resetSessionState,
    resolveErrorMessage: input.resolveErrorMessage,
    retry: input.retry,
    setCode: state.setCode,
    setHasProfile: state.setHasProfile,
    setIsSignOutConfirmOpen: state.setIsSignOutConfirmOpen,
    setProfileCreated: state.setProfileCreated,
    setSettingsProfile: state.setSettingsProfile,
    setStatus: state.setStatus,
    setStep: state.setStep,
    setUser: state.setUser,
  };

  return {
    resetCapsuleState,
    resetSessionState,
    sessionActionContext,
  };
}
