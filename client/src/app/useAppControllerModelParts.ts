import { useMemo } from "react";
import { buildAppControllerModel } from "./buildAppControllerModel";
import { buildAppSessionActionContext } from "./buildAppSessionActionContext";
import { buildAppViewState, toggleStringSelection } from "./appViewState";
import { retry } from "./retry";
import { useAppHandlers } from "./useAppHandlers";
import { useCapsuleRouteSync } from "./useCapsuleRouteSync";
import { useOutfitRouteSync } from "./useOutfitRouteSync";
import { useSessionBootstrap } from "./useSessionBootstrap";
import { useShareRoute } from "./useShareRoute";
import type { AppControllerOperations } from "./appControllerOperations";
import type { useAppNavigation } from "./useAppNavigation";
import type { useAppNotifications } from "./useAppNotifications";
import type { useAppState } from "./useAppState";
import type { usePasskeyPrompt } from "./usePasskeyPrompt";
import type { useProfileOptions } from "./useProfileOptions";
import type { JobTrackerState } from "./useActiveSidebarJobs";

type AppState = ReturnType<typeof useAppState>;
type AppNavigation = ReturnType<typeof useAppNavigation>;
type AppNotifications = ReturnType<typeof useAppNotifications>;
type AppPasskeys = ReturnType<typeof usePasskeyPrompt>;
type AppProfileOptions = ReturnType<typeof useProfileOptions>;
type ResolveErrorMessage = (
  error: { message?: string } | null | undefined,
) => string;
type TranslationFn = (key: string, params?: Record<string, unknown>) => string;

export function useShareRouteForApp({
  appState,
  navigation,
  resolveErrorMessage,
}: {
  appState: AppState;
  navigation: AppNavigation;
  resolveErrorMessage: ResolveErrorMessage;
}) {
  return useShareRoute(
    useShareRouteOptions({
      appState,
      navigation,
      resolveErrorMessage,
    }),
  );
}

function useShareRouteOptions({
  appState,
  navigation,
  resolveErrorMessage,
}: {
  appState: AppState;
  navigation: AppNavigation;
  resolveErrorMessage: ResolveErrorMessage;
}) {
  return useMemo(
    () => ({
      clearNavigationShareRoute: navigation.clearShareRoute,
      hasProfile: appState.hasProfile,
      isMountedRef: appState.isMountedRef,
      pendingShareId: navigation.pendingShareId,
      profileCreated: appState.profileCreated,
      resolveErrorMessage,
      sessionInitialized: appState.sessionInitialized,
      setStatus: appState.setStatus,
      user: appState.user,
    }),
    [appState, navigation, resolveErrorMessage],
  );
}

export function useSessionBootstrapForApp({
  appState,
  locale,
  operations,
  profileOptions,
}: {
  appState: AppState;
  locale: string;
  operations: AppControllerOperations;
  profileOptions: AppProfileOptions;
}) {
  useSessionBootstrap({
    bootstrapCapsules: operations.bootstrapCapsules,
    ensureOptionsLoaded: profileOptions.ensureOptionsLoaded,
    locale,
    setHasProfile: appState.setHasProfile,
    setIsCheckingSession: appState.setIsCheckingSession,
    setProfileCreated: appState.setProfileCreated,
    setSessionInitialized: appState.setSessionInitialized,
    setSettingsProfile: appState.setSettingsProfile,
    setUser: appState.setUser,
  });
}

export function useSessionActionContextForApp({
  appState,
  locale,
  navigation,
  notifications,
  operations,
  passkeys,
  profileOptions,
  resolveErrorMessage,
}: {
  appState: AppState;
  locale: string;
  navigation: AppNavigation;
  notifications: AppNotifications;
  operations: AppControllerOperations;
  passkeys: AppPasskeys;
  profileOptions: AppProfileOptions;
  resolveErrorMessage: ResolveErrorMessage;
}) {
  return buildAppSessionActionContext({
    appState,
    bootstrapCapsules: operations.bootstrapCapsules,
    closeNotificationPrompt: notifications.closeNotificationPrompt,
    locale,
    maybeShowPasskeyPrompt: passkeys.maybeShowPasskeyPrompt,
    profileOptions,
    resetNavigation: navigation.resetNavigation,
    resolveErrorMessage,
    retry,
  }).sessionActionContext;
}

export function useHandlersForApp({
  appState,
  navigation,
  operations,
  sessionActionContext,
  shareRoute,
}: {
  appState: AppState;
  navigation: AppNavigation;
  operations: AppControllerOperations;
  sessionActionContext: ReturnType<typeof useSessionActionContextForApp>;
  shareRoute: ReturnType<typeof useShareRouteForApp>;
}) {
  return useAppHandlers({
    activeCapsuleId: appState.activeCapsuleId,
    activeOutfitId: appState.activeOutfitId,
    capsuleSidebarActionsRef: appState.capsuleSidebarActionsRef,
    outfitSidebarActionsRef: appState.outfitSidebarActionsRef,
    getAppActionContext: operations.getAppActionContext,
    navigateCapsule: navigation.navigateCapsule,
    navigateOutfit: navigation.navigateOutfit,
    navigateApp: navigation.navigateApp,
    navigateNewCapsule: navigation.navigateNewCapsule,
    navigateNewOutfit: navigation.navigateNewOutfit,
    pendingShareId: navigation.pendingShareId,
    setCurrentView: appState.setCurrentView,
    setIsSignOutConfirmOpen: appState.setIsSignOutConfirmOpen,
    setSelectedRegenerationUrls: appState.setSelectedRegenerationUrls,
    shareMetadata: shareRoute.shareMetadata,
    sessionActionContext,
  });
}

export function useRouteSyncForApp({
  appState,
  navigation,
  operations,
  resolveErrorMessage,
}: {
  appState: AppState;
  navigation: AppNavigation;
  operations: AppControllerOperations;
  resolveErrorMessage: ResolveErrorMessage;
}) {
  useCapsuleRouteSync(
    buildCapsuleRouteSyncOptions({
      appState,
      navigation,
      operations,
      resolveErrorMessage,
    }),
  );
  useOutfitRouteSync(
    buildOutfitRouteSyncOptions({
      appState,
      navigation,
      operations,
      resolveErrorMessage,
    }),
  );
}

function buildCapsuleRouteSyncOptions({
  appState,
  navigation,
  operations,
  resolveErrorMessage,
}: {
  appState: AppState;
  navigation: AppNavigation;
  operations: AppControllerOperations;
  resolveErrorMessage: ResolveErrorMessage;
}) {
  return {
    activeCapsuleId: appState.activeCapsuleId,
    activeCapsuleMeta: appState.activeCapsuleMeta,
    appRoute: navigation.appRoute,
    capsuleRouteId: navigation.capsuleRouteId,
    capsuleRouteMode: navigation.capsuleRouteMode,
    clearActiveCapsuleState: operations.clearActiveCapsuleState,
    getAppActionContext: operations.getAppActionContext,
    hasUsableProfile: appState.hasProfile || appState.profileCreated,
    isContentOperationLoading: appState.isContentOperationLoading,
    navigateCapsule: navigation.navigateCapsule,
    pendingShareId: navigation.pendingShareId,
    resolveErrorMessage,
    sessionInitialized: appState.sessionInitialized,
    setStatus: appState.setStatus,
    userEmail: appState.user?.email || "",
  };
}

function buildOutfitRouteSyncOptions({
  appState,
  navigation,
  operations,
  resolveErrorMessage,
}: {
  appState: AppState;
  navigation: AppNavigation;
  operations: AppControllerOperations;
  resolveErrorMessage: ResolveErrorMessage;
}) {
  return {
    activeOutfitId: appState.activeOutfitId,
    activeOutfitMeta: appState.activeOutfitMeta,
    appRoute: navigation.appRoute,
    clearActiveOutfitState: operations.clearActiveOutfitState,
    getAppActionContext: operations.getAppActionContext,
    hasUsableProfile: appState.hasProfile || appState.profileCreated,
    isContentOperationLoading: appState.isContentOperationLoading,
    navigateOutfit: navigation.navigateOutfit,
    outfitRouteId: navigation.outfitRouteId,
    outfitRouteMode: navigation.outfitRouteMode,
    resolveErrorMessage,
    sessionInitialized: appState.sessionInitialized,
    setStatus: appState.setStatus,
    userEmail: appState.user?.email || "",
  };
}

export function buildViewState(
  state: AppState,
  appRoute: AppNavigation["appRoute"],
  operations: AppControllerOperations,
) {
  return buildAppViewState({
    activeCapsuleMeta: state.activeCapsuleMeta,
    appRoute,
    buildCurrentDraftSnapshot: operations.buildCurrentDraftSnapshot,
    currentView: state.currentView,
    hasProfile: state.hasProfile,
    isContentOperationLoading: state.isContentOperationLoading,
    isCapsuleReportPending: state.isCapsuleReportPending,
    isDownloadingWardrobePdf: state.isDownloadingWardrobePdf,
    isLoadingItems: state.isLoadingItems,
    isOutfitImagePending: state.isOutfitImagePending,
    isOutfitReportPending: state.isOutfitReportPending,
    isPartialRegenerationLoading: state.isPartialRegenerationLoading,
    isWardrobePending: state.isWardrobePending,
    pendingImageSetIndexes: state.pendingImageSetIndexes,
    profileCreated: state.profileCreated,
    user: state.user,
  });
}

export function buildControllerModel({
  appState,
  appTheme,
  cardPadding,
  handlers,
  jobTracker,
  isLarge,
  navigation,
  notifications,
  passkeys,
  profileOptions,
  shareRoute,
  t,
  viewState,
}: {
  appState: AppState;
  appTheme: unknown;
  cardPadding: number;
  handlers: ReturnType<typeof useAppHandlers>;
  isLarge: boolean;
  jobTracker: JobTrackerState;
  navigation: AppNavigation;
  notifications: AppNotifications;
  passkeys: AppPasskeys;
  profileOptions: AppProfileOptions;
  shareRoute: ReturnType<typeof useShareRouteForApp>;
  t: TranslationFn;
  viewState: ReturnType<typeof buildAppViewState>;
}) {
  return buildAppControllerModel({
    appState,
    appTheme,
    cardPadding,
    clearShareRoute: shareRoute.clearShareRoute,
    dismissPasskeyPrompt: passkeys.dismissPasskeyPrompt,
    handleAddPasskeyFromPrompt: passkeys.handleAddPasskeyFromPrompt,
    handlers,
    jobTracker,
    navigation,
    notifications,
    profileOptions,
    viewState,
    isLarge,
    isShareDialogOpen: shareRoute.isShareDialogOpen,
    isShareLoading: shareRoute.isShareLoading,
    passkeyPrompt: passkeys.passkeyPrompt,
    requestBrowserNotificationPermission:
      notifications.requestBrowserNotificationPermission,
    setIsSignOutConfirmOpen: appState.setIsSignOutConfirmOpen,
    setStatus: appState.setStatus,
    shareMetadata: shareRoute.shareMetadata,
    t,
    toggleSelection: toggleStringSelection,
  });
}
