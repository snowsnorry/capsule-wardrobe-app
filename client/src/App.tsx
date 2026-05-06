import { useCallback, useEffect, useMemo } from "react";
import {
  useMediaQuery
} from "@mui/material";
import { updateProfileLocale } from "./api/auth";
import {
  fetchCapsule,
  fetchCapsuleBootstrap,
} from "./api/capsules";
import { useI18n } from "./i18n/useI18n";
import { createAppTheme } from "./theme";
import AppPresentation from "./app/AppPresentation";
import { applyCapsuleStateToApp } from "./app/capsuleStateActions";
import { buildDraftSnapshotFromState } from "./app/capsuleState";
import { buildAppViewState, resolveThemeMode, toggleStringSelection } from "./app/appViewState";
import { buildAppPresentationModel } from "./app/appPresentationModel";
import { resolveAppErrorMessage } from "./app/errorMessages";
import { normalizeProfileSettings } from "./app/profileSettings";
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
import { useAppState } from "./app/useAppState";
import type {
  CapsuleBootstrapResponse,
  CapsuleDraft,
  CapsuleMeta,
  CapsuleWardrobeData,
  OutfitSetSnapshot,
  WardrobeItem,
  WardrobeSnapshot
} from "./app/appTypes";

async function retry(fn, attempts = 3, delayMs = 120) {
  let lastError;
  for (let index = 0; index < attempts; index += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (index < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}

function App() {
  const isLarge = useMediaQuery("(min-width:900px)");
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
  const { t, locale, setLocale } = useI18n();
  const navigation = useAppNavigation();
  const profileOptions = useProfileOptions();
  const { activeCapsuleId, activeCapsuleMeta, capsuleEventsAbortRef, capsuleList, capsuleSidebarActionsRef, code, currentView, email, hasPendingAdditionalItems, hasProfile, isCheckingSession, isContentOperationLoading, isDownloadingWardrobePdf, isLoadingItems, isMountedRef, isPartialRegenerationLoading, isSignOutConfirmOpen, isWardrobePending, manualWardrobeRegenerationCapsuleIdRef, onboardingStep, partialRegenerationPendingUrls, pendingImageSetIndexes, pendingNotificationKindRef, pendingRegenerationUrlsRef, profileCreated, profileItems, profileOutfitSets, regenerationBaseItemsRef, selectedAudience, selectedColor, selectedFormalityLevel, selectedOccasions, selectedPattern, selectedRegenerationUrls, selectedSeason, selectedStyle, selectedText, sessionInitialized, setActiveCapsuleId, setActiveCapsuleMeta, setCapsuleList, setCode, setCurrentView, setEmail, setHasPendingAdditionalItems, setHasProfile, setIsCheckingSession, setIsContentOperationLoading, setIsDownloadingWardrobePdf, setIsLoadingItems, setIsPartialRegenerationLoading, setIsSignOutConfirmOpen, setIsWardrobePending, setOnboardingStep, setPartialRegenerationPendingUrls, setPendingImageSetIndexes, setProfileCreated, setProfileItems, setProfileOutfitSets, setSelectedAudience, setSelectedColor, setSelectedFormalityLevel, setSelectedOccasions, setSelectedPattern, setSelectedRegenerationUrls, setSelectedSeason, setSelectedStyle, setSelectedText, setSessionInitialized, setSettingsProfile, setStatus, setStep, setUser, settingsProfile, status, step, user } = useAppState();
  const { appRoute, searchInitialQuery, searchAutoOpenProductDetail, pendingShareId, clearShareRoute: clearNavigationShareRoute, navigateApp, resetNavigation } = navigation;
  const { styleOptions, occasionOptions, orderedSeasonOptions, audienceOptions, patternOptions, ensureOptionsLoaded, preloadOnboardingOptions, resetProfileOptions } = profileOptions;

  const cardPadding = useMemo(() => (isLarge ? 5 : 3), [isLarge]);
  const resolvedThemeMode = resolveThemeMode(settingsProfile.theme, prefersDarkMode);
  const appTheme = useMemo(() => createAppTheme(resolvedThemeMode), [resolvedThemeMode]);
  const notifications = useAppNotifications(t, settingsProfile.llm);
  const { notificationPrompt, closeNotificationPrompt, openPendingNotificationPrompt, requestBrowserNotificationPermission, sendReadyNotification } = notifications;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, [isMountedRef]);

  const resolveErrorMessage = useCallback(
    (error: { message?: string } | null | undefined) => resolveAppErrorMessage(error, t),
    [t]
  );
  const { dismissPasskeyPrompt, handleAddPasskeyFromPrompt, maybeShowPasskeyPrompt, passkeyPrompt } = usePasskeyPrompt(resolveErrorMessage, setStatus);
  const shareRouteOptions = useMemo(() => ({ clearNavigationShareRoute, hasProfile, isMountedRef, pendingShareId, profileCreated, resolveErrorMessage, sessionInitialized, setStatus, user }), [clearNavigationShareRoute, hasProfile, isMountedRef, pendingShareId, profileCreated, resolveErrorMessage, sessionInitialized, setStatus, user]);
  const { clearShareRoute, isShareDialogOpen, isShareLoading, setIsShareLoading, shareMetadata } = useShareRoute(shareRouteOptions);

  const startPendingNotificationFlow = (kind: string, llm = settingsProfile.llm) => {
    pendingNotificationKindRef.current = kind;
    openPendingNotificationPrompt(llm);
  };

  const clearWardrobeProgressState = () => { stopCapsuleEventStream(); setSelectedRegenerationUrls([]); pendingRegenerationUrlsRef.current = []; regenerationBaseItemsRef.current = []; manualWardrobeRegenerationCapsuleIdRef.current = ""; pendingNotificationKindRef.current = ""; closeNotificationPrompt(); setPartialRegenerationPendingUrls([]); setPendingImageSetIndexes([]); setIsPartialRegenerationLoading(false); setIsWardrobePending(false); setHasPendingAdditionalItems(false); setIsLoadingItems(false); };

  const applyCapsuleState = (capsule: CapsuleMeta | null | undefined, { capsules = null as CapsuleMeta[] | null } = {}) => { applyCapsuleStateToApp({ clearWardrobeProgressState, setActiveCapsuleId, setActiveCapsuleMeta, setCapsuleList, setPendingImageSetIndexes, setProfileItems, setProfileOutfitSets, setSelectedAudience, setSelectedColor, setSelectedFormalityLevel, setSelectedOccasions, setSelectedPattern, setSelectedSeason, setSelectedStyle, setSelectedText }, capsule, { capsules }); };

  const buildCurrentDraftSnapshot = ({ wardrobe, rejectedUrls = null }: { wardrobe?: CapsuleWardrobeData | { items: WardrobeItem[] | null; outfitSets: OutfitSetSnapshot[] } | null; rejectedUrls?: string[] | null; } = {}): CapsuleDraft => buildDraftSnapshotFromState({ activeCapsuleMeta, profileItems, profileOutfitSets, rejectedUrls, selectedAudience, selectedColor, selectedFormalityLevel, selectedOccasions, selectedPattern, selectedSeason, selectedStyle, selectedText, wardrobe });

  const restoreCapsuleSnapshot = async (capsuleId: string | undefined, snapshot: WardrobeSnapshot | undefined, { shouldResumeEvents = false }: { shouldResumeEvents?: boolean } = {}) => { if (!snapshot) return; await applyWardrobeSnapshot(snapshot, capsuleId); if (snapshot.status === "pending" && shouldResumeEvents) startCapsuleEventStream(capsuleId); };

  const bootstrapCapsules = async (email = user?.email) => { const result = await fetchCapsuleBootstrap() as CapsuleBootstrapResponse; const normalizedProfile = normalizeProfileSettings(result.profile, email); setSettingsProfile(normalizedProfile); if (normalizedProfile.locale) setLocale(normalizedProfile.locale); applyCapsuleState(result.activeCapsule, { capsules: result.capsules || [] }); await restoreCapsuleSnapshot(result.activeCapsule?.id, result.activeSnapshot, { shouldResumeEvents: true }); return normalizedProfile; };

  useSessionBootstrap({ bootstrapCapsules, ensureOptionsLoaded, preloadOnboardingOptions, setHasProfile, setIsCheckingSession, setProfileCreated, setSessionInitialized, setSettingsProfile, setUser });

  const resetOnboardingSelections = () => { setSelectedFormalityLevel(""); setSelectedStyle(null); setSelectedOccasions([]); setSelectedSeason([]); setSelectedAudience(""); setSelectedColor(null); setSelectedPattern("solid"); setSelectedText(""); };

  const resetSessionState = () => { setUser(null); setHasProfile(false); setProfileCreated(false); setSettingsProfile(normalizeProfileSettings()); setCurrentView("main"); setStep("email"); setEmail(""); setCode(""); resetOnboardingSelections(); setOnboardingStep(0); };

  const resetCapsuleState = () => { setProfileItems(null); setProfileOutfitSets([]); setPendingImageSetIndexes([]); setActiveCapsuleId(""); setActiveCapsuleMeta(null); setCapsuleList([]); setIsLoadingItems(false); setIsDownloadingWardrobePdf(false); setSelectedRegenerationUrls([]); setPartialRegenerationPendingUrls([]); setIsPartialRegenerationLoading(false); setIsWardrobePending(false); setHasPendingAdditionalItems(false); pendingRegenerationUrlsRef.current = []; regenerationBaseItemsRef.current = []; manualWardrobeRegenerationCapsuleIdRef.current = ""; pendingNotificationKindRef.current = ""; };

  const sessionActionContext = { bootstrapCapsules, closeNotificationPrompt, code, email, ensureOptionsLoaded, locale, maybeShowPasskeyPrompt, preloadOnboardingOptions, resetCapsuleState, resetNavigation, resetOnboardingSelections, resetProfileOptions, resetSessionState, resolveErrorMessage, retry, setCode, setHasProfile, setIsSignOutConfirmOpen, setOnboardingStep, setProfileCreated, setSettingsProfile, setStatus, setStep, setUser };

  const toggleSelection = toggleStringSelection;

  const refreshCapsuleListForApp = async () => {
    await refreshCapsuleList(getAppActionContext());
  };

  const { hasBrandedPanelHeader, hasFilterChanges, isContentBusy, isMainScreenView, isSearchView, isSignInView, isStatisticsView } = buildAppViewState({ activeCapsuleMeta, appRoute, buildCurrentDraftSnapshot, currentView, hasProfile, isContentOperationLoading, isDownloadingWardrobePdf, isLoadingItems, isPartialRegenerationLoading, isWardrobePending, pendingImageSetIndexes, profileCreated, user });

  const stopCapsuleEventStream = () => {
    stopWardrobeEventStream(getAppActionContext());
  };

  const applyWardrobeSnapshot = async (snapshot: WardrobeSnapshot | undefined, capsuleId: string | undefined = activeCapsuleId) => { await applyWardrobeSnapshotToApp({ activeCapsuleId, closeNotificationPrompt, fetchCapsule: async (nextCapsuleId) => fetchCapsule(nextCapsuleId) as Promise<{ capsule?: CapsuleMeta | null }>, manualWardrobeRegenerationCapsuleIdRef, pendingNotificationKindRef, pendingRegenerationUrlsRef, refreshCapsuleList: refreshCapsuleListForApp, regenerationBaseItemsRef, sendReadyNotification, setActiveCapsuleMeta, setHasPendingAdditionalItems, setIsLoadingItems, setIsPartialRegenerationLoading, setIsWardrobePending, setPartialRegenerationPendingUrls, setPendingImageSetIndexes, setProfileItems, setProfileOutfitSets, setSelectedRegenerationUrls, setStatus, stopCapsuleEventStream, t }, snapshot, capsuleId); };

  const startCapsuleEventStream = (capsuleId: string | undefined) => {
    return startWardrobeEventStream(getAppActionContext(), capsuleId);
  };

  const getAppActionContext = () => ({ activeCapsuleId, applyCapsuleState, applyWardrobeSnapshot, bootstrapCapsules, buildCurrentDraftSnapshot, capsuleEventsAbortRef, clearShareRoute, closeNotificationPrompt, handleLogout: async () => { await handlers.signOut(); }, isMountedRef, isPartialRegenerationLoading, locale, manualWardrobeRegenerationCapsuleIdRef, onboardingStep, pendingShareId, pendingNotificationKindRef, pendingRegenerationUrlsRef, profileItems, regenerationBaseItemsRef, resolveErrorMessage, selectedAudience, selectedFormalityLevel, selectedOccasions, selectedRegenerationUrls, selectedSeason, setActiveCapsuleMeta, setCapsuleList, setCurrentView, setHasPendingAdditionalItems, setHasProfile, setIsContentOperationLoading, setIsDownloadingWardrobePdf, setIsLoadingItems, setIsPartialRegenerationLoading, setIsShareLoading, setIsWardrobePending, setLocale, setOnboardingStep, setPartialRegenerationPendingUrls, setPendingImageSetIndexes, setProfileCreated, setProfileItems, setProfileOutfitSets, setSelectedRegenerationUrls, setSettingsProfile, setStatus, settingsProfile, shareMetadata, startCapsuleEventStream, startPendingNotificationFlow, t, user });

  const handlers = useAppHandlers({ activeCapsuleId, capsuleSidebarActionsRef, getAppActionContext, navigateApp, pendingShareId, setCurrentView, setIsSignOutConfirmOpen, setSelectedRegenerationUrls, shareMetadata, sessionActionContext });

  useEffect(() => { pendingRegenerationUrlsRef.current = partialRegenerationPendingUrls; }, [partialRegenerationPendingUrls, pendingRegenerationUrlsRef]);

  useEffect(() => () => { if (capsuleEventsAbortRef.current) { capsuleEventsAbortRef.current.abort(); capsuleEventsAbortRef.current = null; } pendingNotificationKindRef.current = ""; }, [capsuleEventsAbortRef, pendingNotificationKindRef]);

  useEffect(() => { if (!sessionInitialized || !user || !(hasProfile || profileCreated) || !settingsProfile.locale || locale === settingsProfile.locale) return; updateProfileLocale(locale).then(() => { if (isMountedRef.current) setSettingsProfile((current) => ({ ...current, locale })); }).catch(() => {}); }, [locale, settingsProfile.locale, sessionInitialized, user, hasProfile, profileCreated, isMountedRef, setSettingsProfile]);

  return <AppPresentation model={buildAppPresentationModel({
    actions: { ...handlers, onAddPasskey: () => { void handleAddPasskeyFromPrompt(); }, onClearError: () => setStatus((current) => ({ ...current, error: "" })), onClearShareRoute: clearShareRoute, onCloseSignOutConfirm: () => setIsSignOutConfirmOpen(false), onDismissPasskey: dismissPasskeyPrompt, onImportSharedCapsule: () => { void handlers.handleImportSharedCapsule(); }, onLogout: () => { void handlers.signOut(); }, onRequestNotificationPermission: () => { void requestBrowserNotificationPermission(); }, onSaveSettings: handlers.handleSaveSettings, openCapsuleActions: (event, capsule) => { capsuleSidebarActionsRef.current?.openCapsuleActions(event, capsule); }, openSearchDialog: () => capsuleSidebarActionsRef.current?.openSearchDialog() },
    handlers: { onApplyCapsuleFilters: handlers.handleApplyCapsuleFilters, onBackOnboarding: handlers.handleBackOnboarding, onBackToMain: handlers.handleBackToMain, onCancelRegenerationSelection: handlers.handleCancelRegenerationSelection, onCreateCapsule: handlers.handleCreateCapsule, onCreateCapsuleFromSidebar: handlers.handleCreateCapsuleFromSidebar, onDeleteCapsule: handlers.handleDeleteCapsule, onDeleteOutfitSetImage: handlers.handleDeleteOutfitSetImage, onDeleteProfile: handlers.handleDeleteProfile, onDownloadWardrobePdf: handlers.handleDownloadWardrobePdf, onDuplicateCapsule: handlers.handleDuplicateCapsule, onFinishOnboarding: handlers.handleFinishOnboarding, onGenerateOutfitSetImage: handlers.handleGenerateOutfitSetImage, onGoogleCredential: handlers.handleGoogleCredential, onNavigateApp: handlers.handleNavigateApp, onNextOnboarding: handlers.handleNextOnboarding, onOpenCapsule: handlers.handleOpenCapsule, onOpenCapsuleFromSidebar: handlers.handleOpenCapsuleFromSidebar, onPasskeySignIn: handlers.handlePasskeySignIn, onRefreshWardrobe: handlers.handleRefreshWardrobe, onRegenerateSelectedItems: handlers.handleRegenerateSelectedItems, onRenameCapsule: handlers.handleRenameCapsule, onRequestCode: handlers.handleRequestCode, onRequestSignOut: handlers.handleRequestSignOut, onResetEmail: handlers.resetToEmail, onResetProfileFilters: handlers.handleResetProfileFilters, onRevertCapsule: handlers.handleRevertCapsule, onSaveCapsule: handlers.handleSaveCapsule, onSaveProfile: handlers.handleSaveProfile, onSearchCapsules: handlers.handleSearchCapsules, onShareCapsule: handlers.handleShareCapsule, onToggleRegenerationSelection: handlers.handleToggleRegenerationSelection, onVerifyCode: handlers.handleVerifyCode, registerCapsuleSidebarActions: handlers.registerCapsuleSidebarActions },
    layout: { activeCapsuleId, activeCapsuleMeta, appRoute, capsuleList, cardPadding, currentView, hasBrandedPanelHeader, isContentBusy, isLarge, isMainScreenView, isSearchView, isSignInView, isStatisticsView, sessionInitialized, settingsProfile, t, user },
    notifications: { notificationOpen: notificationPrompt.open, passkeyPrompt }, options: { audienceOptions, occasionOptions, orderedSeasonOptions, patternOptions, styleOptions }, session: { code, email, hasProfile, isCheckingSession, profileCreated, status, step }, share: { isShareDialogOpen, isShareLoading, isSignOutConfirmOpen, shareMetadata }, theme: appTheme,
    view: { hasFilterChanges, hasPendingAdditionalItems, isDownloadingWardrobePdf, isLoadingItems, isPartialRegenerationLoading, isSigningOut: status.loading, onboardingStep, partialRegenerationPendingUrls, pendingImageSetIndexes, profileItems, profileOutfitSets, searchAutoOpenProductDetail, searchInitialQuery, selectedAudience, selectedColor, selectedFormalityLevel, selectedOccasions, selectedPattern, selectedRegenerationUrls, selectedSeason, selectedStyle, selectedText, setCode, setEmail, setSelectedAudience, setSelectedColor, setSelectedFormalityLevel, setSelectedOccasions, setSelectedPattern, setSelectedSeason, setSelectedStyle, setSelectedText, toggleSelection }
  })} />;
}

export default App;
