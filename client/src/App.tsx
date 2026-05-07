import { useCallback, useMemo } from "react";
import { useMediaQuery } from "@mui/material";
import { fetchCapsule, fetchCapsuleBootstrap } from "./api/capsules";
import { useI18n } from "./i18n/useI18n";
import { createAppTheme } from "./theme";
import AppPresentation from "./app/AppPresentation";
import { applyCapsuleStateToApp } from "./app/capsuleStateActions";
import { buildDraftSnapshotFromState } from "./app/capsuleState";
import {
  buildAppViewState,
  resolveThemeMode,
  toggleStringSelection,
} from "./app/appViewState";
import { resolveAppErrorMessage } from "./app/errorMessages";
import { normalizeProfileSettings } from "./app/profileSettings";
import { buildAppActionContext } from "./app/buildAppActionContext";
import { buildAppControllerModel } from "./app/buildAppControllerModel";
import { buildAppSessionActionContext } from "./app/buildAppSessionActionContext";
import { useAppNavigation } from "./app/useAppNavigation";
import { useAppNotifications } from "./app/useAppNotifications";
import { usePasskeyPrompt } from "./app/usePasskeyPrompt";
import { useProfileOptions } from "./app/useProfileOptions";
import { useShareRoute } from "./app/useShareRoute";
import { useSessionBootstrap } from "./app/useSessionBootstrap";
import { applyWardrobeSnapshotToApp } from "./app/wardrobeSnapshotActions";
import { refreshCapsuleList } from "./app/capsuleActions";
import {
  startCapsuleEventStream as startWardrobeEventStream,
  stopCapsuleEventStream as stopWardrobeEventStream,
} from "./app/wardrobeActions";
import { useAppHandlers } from "./app/useAppHandlers";
import { useAppLifecycleEffects } from "./app/useAppLifecycleEffects";
import { useAppState } from "./app/useAppState";
import { retry } from "./app/retry";
import type {
  CapsuleBootstrapResponse,
  CapsuleDraft,
  CapsuleMeta,
  CapsuleWardrobeData,
  OutfitSetSnapshot,
  WardrobeItem,
  WardrobeSnapshot,
} from "./app/appTypes";

function App() {
  const isLarge = useMediaQuery("(min-width:900px)");
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
  const { t, locale, setLocale } = useI18n();
  const navigation = useAppNavigation();
  const profileOptions = useProfileOptions();
  const appState = useAppState();
  const {
    activeCapsuleId,
    activeCapsuleMeta,
    capsuleSidebarActionsRef,
    currentView,
    hasProfile,
    isContentOperationLoading,
    isDownloadingWardrobePdf,
    isLoadingItems,
    isMountedRef,
    isPartialRegenerationLoading,
    isWardrobePending,
    manualWardrobeRegenerationCapsuleIdRef,
    pendingImageSetIndexes,
    pendingNotificationKindRef,
    pendingRegenerationUrlsRef,
    profileCreated,
    profileItems,
    profileOutfitSets,
    regenerationBaseItemsRef,
    selectedAudience,
    selectedColor,
    selectedFormalityLevel,
    selectedOccasions,
    selectedPattern,
    selectedSeason,
    selectedStyle,
    selectedText,
    setActiveCapsuleId,
    setActiveCapsuleMeta,
    setCapsuleList,
    setCurrentView,
    setHasPendingAdditionalItems,
    setHasProfile,
    setIsCheckingSession,
    setIsLoadingItems,
    setIsPartialRegenerationLoading,
    setIsSignOutConfirmOpen,
    setIsWardrobePending,
    setPartialRegenerationPendingUrls,
    setPendingImageSetIndexes,
    setProfileCreated,
    setProfileItems,
    setProfileOutfitSets,
    setSelectedAudience,
    setSelectedColor,
    setSelectedFormalityLevel,
    setSelectedOccasions,
    setSelectedPattern,
    setSelectedRegenerationUrls,
    setSelectedSeason,
    setSelectedStyle,
    setSelectedText,
    setSessionInitialized,
    setSettingsProfile,
    setStatus,
    setUser,
    settingsProfile,
    user,
  } = appState;
  const {
    appRoute,
    pendingShareId,
    clearShareRoute: clearNavigationShareRoute,
    navigateApp,
    resetNavigation,
  } = navigation;
  const { ensureOptionsLoaded, preloadOnboardingOptions } = profileOptions;

  const cardPadding = useMemo(() => (isLarge ? 5 : 3), [isLarge]);
  const resolvedThemeMode = resolveThemeMode(
    settingsProfile.theme,
    prefersDarkMode,
  );
  const appTheme = useMemo(
    () => createAppTheme(resolvedThemeMode),
    [resolvedThemeMode],
  );
  const notifications = useAppNotifications(t, settingsProfile.llm);
  const {
    closeNotificationPrompt,
    openPendingNotificationPrompt,
    requestBrowserNotificationPermission,
    sendReadyNotification,
  } = notifications;

  const resolveErrorMessage = useCallback(
    (error: { message?: string } | null | undefined) =>
      resolveAppErrorMessage(error, t),
    [t],
  );
  const {
    dismissPasskeyPrompt,
    handleAddPasskeyFromPrompt,
    maybeShowPasskeyPrompt,
    passkeyPrompt,
  } = usePasskeyPrompt(resolveErrorMessage, setStatus);
  const shareRouteOptions = useMemo(
    () => ({
      clearNavigationShareRoute,
      hasProfile,
      isMountedRef,
      pendingShareId,
      profileCreated,
      resolveErrorMessage,
      sessionInitialized: appState.sessionInitialized,
      setStatus,
      user,
    }),
    [
      clearNavigationShareRoute,
      hasProfile,
      isMountedRef,
      pendingShareId,
      profileCreated,
      resolveErrorMessage,
      appState.sessionInitialized,
      setStatus,
      user,
    ],
  );
  const {
    clearShareRoute,
    isShareDialogOpen,
    isShareLoading,
    setIsShareLoading,
    shareMetadata,
  } = useShareRoute(shareRouteOptions);

  const startPendingNotificationFlow = (
    kind: string,
    llm = settingsProfile.llm,
  ) => {
    pendingNotificationKindRef.current = kind;
    openPendingNotificationPrompt(llm);
  };

  const clearWardrobeProgressState = () => {
    stopCapsuleEventStream();
    setSelectedRegenerationUrls([]);
    pendingRegenerationUrlsRef.current = [];
    regenerationBaseItemsRef.current = [];
    manualWardrobeRegenerationCapsuleIdRef.current = "";
    pendingNotificationKindRef.current = "";
    closeNotificationPrompt();
    setPartialRegenerationPendingUrls([]);
    setPendingImageSetIndexes([]);
    setIsPartialRegenerationLoading(false);
    setIsWardrobePending(false);
    setHasPendingAdditionalItems(false);
    setIsLoadingItems(false);
  };

  const applyCapsuleState = (
    capsule: CapsuleMeta | null | undefined,
    { capsules = null as CapsuleMeta[] | null } = {},
  ) => {
    applyCapsuleStateToApp(
      {
        clearWardrobeProgressState,
        setActiveCapsuleId,
        setActiveCapsuleMeta,
        setCapsuleList,
        setPendingImageSetIndexes,
        setProfileItems,
        setProfileOutfitSets,
        setSelectedAudience,
        setSelectedColor,
        setSelectedFormalityLevel,
        setSelectedOccasions,
        setSelectedPattern,
        setSelectedSeason,
        setSelectedStyle,
        setSelectedText,
      },
      capsule,
      { capsules },
    );
  };

  const buildCurrentDraftSnapshot = ({
    wardrobe,
    rejectedUrls = null,
  }: {
    wardrobe?:
      | CapsuleWardrobeData
      | { items: WardrobeItem[] | null; outfitSets: OutfitSetSnapshot[] }
      | null;
    rejectedUrls?: string[] | null;
  } = {}): CapsuleDraft =>
    buildDraftSnapshotFromState({
      activeCapsuleMeta,
      profileItems,
      profileOutfitSets,
      rejectedUrls,
      selectedAudience,
      selectedColor,
      selectedFormalityLevel,
      selectedOccasions,
      selectedPattern,
      selectedSeason,
      selectedStyle,
      selectedText,
      wardrobe,
    });

  const restoreCapsuleSnapshot = async (
    capsuleId: string | undefined,
    snapshot: WardrobeSnapshot | undefined,
    { shouldResumeEvents = false }: { shouldResumeEvents?: boolean } = {},
  ) => {
    if (!snapshot) return;
    await applyWardrobeSnapshot(snapshot, capsuleId);
    if (snapshot.status === "pending" && shouldResumeEvents)
      startCapsuleEventStream(capsuleId);
  };

  const bootstrapCapsules = async (email = user?.email) => {
    const result = (await fetchCapsuleBootstrap()) as CapsuleBootstrapResponse;
    const normalizedProfile = normalizeProfileSettings(result.profile, email);
    setSettingsProfile(normalizedProfile);
    if (normalizedProfile.locale) setLocale(normalizedProfile.locale);
    applyCapsuleState(result.activeCapsule, {
      capsules: result.capsules || [],
    });
    await restoreCapsuleSnapshot(
      result.activeCapsule?.id,
      result.activeSnapshot,
      { shouldResumeEvents: true },
    );
    return normalizedProfile;
  };

  useSessionBootstrap({
    bootstrapCapsules,
    ensureOptionsLoaded,
    preloadOnboardingOptions,
    setHasProfile,
    setIsCheckingSession,
    setProfileCreated,
    setSessionInitialized,
    setSettingsProfile,
    setUser,
  });

  const { sessionActionContext } = buildAppSessionActionContext({
    appState,
    bootstrapCapsules,
    closeNotificationPrompt,
    locale,
    maybeShowPasskeyPrompt,
    profileOptions,
    resetNavigation,
    resolveErrorMessage,
    retry,
  });

  const toggleSelection = toggleStringSelection;

  const refreshCapsuleListForApp = async () => {
    await refreshCapsuleList(getAppActionContext());
  };

  const viewState = buildAppViewState({
    activeCapsuleMeta,
    appRoute,
    buildCurrentDraftSnapshot,
    currentView,
    hasProfile,
    isContentOperationLoading,
    isDownloadingWardrobePdf,
    isLoadingItems,
    isPartialRegenerationLoading,
    isWardrobePending,
    pendingImageSetIndexes,
    profileCreated,
    user,
  });

  const stopCapsuleEventStream = () => {
    stopWardrobeEventStream(getAppActionContext());
  };

  const applyWardrobeSnapshot = async (
    snapshot: WardrobeSnapshot | undefined,
    capsuleId: string | undefined = activeCapsuleId,
  ) => {
    await applyWardrobeSnapshotToApp(
      {
        activeCapsuleId,
        closeNotificationPrompt,
        fetchCapsule: async (nextCapsuleId) =>
          fetchCapsule(nextCapsuleId) as Promise<{
            capsule?: CapsuleMeta | null;
          }>,
        manualWardrobeRegenerationCapsuleIdRef,
        pendingNotificationKindRef,
        pendingRegenerationUrlsRef,
        refreshCapsuleList: refreshCapsuleListForApp,
        regenerationBaseItemsRef,
        sendReadyNotification,
        setActiveCapsuleMeta,
        setHasPendingAdditionalItems,
        setIsLoadingItems,
        setIsPartialRegenerationLoading,
        setIsWardrobePending,
        setPartialRegenerationPendingUrls,
        setPendingImageSetIndexes,
        setProfileItems,
        setProfileOutfitSets,
        setSelectedRegenerationUrls,
        setStatus,
        stopCapsuleEventStream,
        t,
      },
      snapshot,
      capsuleId,
    );
  };

  const startCapsuleEventStream = (capsuleId: string | undefined) => {
    return startWardrobeEventStream(getAppActionContext(), capsuleId);
  };

  const getAppActionContext = () =>
    buildAppActionContext({
      appState,
      applyCapsuleState,
      applyWardrobeSnapshot,
      bootstrapCapsules,
      buildCurrentDraftSnapshot,
      clearShareRoute,
      closeNotificationPrompt,
      handlers,
      locale,
      pendingShareId,
      resolveErrorMessage,
      setIsShareLoading,
      setLocale,
      shareMetadata,
      startCapsuleEventStream,
      startPendingNotificationFlow,
      t,
    });

  const handlers = useAppHandlers({
    activeCapsuleId,
    capsuleSidebarActionsRef,
    getAppActionContext,
    navigateApp,
    pendingShareId,
    setCurrentView,
    setIsSignOutConfirmOpen,
    setSelectedRegenerationUrls,
    shareMetadata,
    sessionActionContext,
  });

  useAppLifecycleEffects({ appState, locale });

  return (
    <AppPresentation
      model={buildAppControllerModel({
        appState,
        appTheme,
        cardPadding,
        clearShareRoute,
        dismissPasskeyPrompt,
        handleAddPasskeyFromPrompt,
        handlers,
        navigation,
        notifications,
        profileOptions,
        viewState,
        isLarge,
        isShareDialogOpen,
        isShareLoading,
        passkeyPrompt,
        requestBrowserNotificationPermission,
        setIsSignOutConfirmOpen,
        setStatus,
        shareMetadata,
        t,
        toggleSelection,
      })}
    />
  );
}

export default App;
