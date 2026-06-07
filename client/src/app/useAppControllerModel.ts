/* eslint-disable max-lines, max-lines-per-function */
import { useCallback, useMemo } from "react";
import { useMediaQuery } from "@mui/material";
import { useI18n } from "../i18n/useI18n";
import { createAppTheme } from "../theme";
import { buildAppControllerModel } from "./buildAppControllerModel";
import { buildAppSessionActionContext } from "./buildAppSessionActionContext";
import { connectAppActionContext } from "./connectAppActionContext";
import {
  buildAppViewState,
  resolveThemeMode,
  toggleStringSelection,
} from "./appViewState";
import { resolveAppErrorMessage } from "./errorMessages";
import { useAppControllerOperations } from "./useAppControllerOperations";
import { useAppHandlers } from "./useAppHandlers";
import { useAppLifecycleEffects } from "./useAppLifecycleEffects";
import { useAppNavigation } from "./useAppNavigation";
import { useAppNotifications } from "./useAppNotifications";
import { useAppState } from "./useAppState";
import { useCapsuleRouteSync } from "./useCapsuleRouteSync";
import { useOutfitRouteSync } from "./useOutfitRouteSync";
import { usePasskeyPrompt } from "./usePasskeyPrompt";
import { useProfileOptions } from "./useProfileOptions";
import { useSessionBootstrap } from "./useSessionBootstrap";
import { useShareRoute } from "./useShareRoute";
import { retry } from "./retry";
import type { AppControllerOperations } from "./appControllerOperations";

export function useAppControllerModel() {
  const isLarge = useMediaQuery("(min-width:900px)");
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
  const { t, locale, setLocale } = useI18n();
  const navigation = useAppNavigation();
  const profileOptions = useProfileOptions();
  const appState = useAppState();
  const cardPadding = useMemo(() => (isLarge ? 5 : 3), [isLarge]);
  const appTheme = useAppTheme(appState.settingsProfile.theme, prefersDarkMode);
  const notifications = useAppNotifications(t, appState.settingsProfile.llm);
  const resolveErrorMessage = useCallback(
    (error: { message?: string } | null | undefined) =>
      resolveAppErrorMessage(error, t),
    [t],
  );
  const passkeys = usePasskeyPrompt(resolveErrorMessage, appState.setStatus);
  const shareRoute = useShareRoute(
    useShareRouteOptions({
      appState,
      navigation,
      resolveErrorMessage,
    }),
  );
  const operations = useAppControllerOperations({
    appState,
    locale,
    navigation,
    notifications,
    profileOptions,
    resolveErrorMessage,
    setLocale,
    shareRoute,
    t,
  });
  useSessionBootstrapForApp({ appState, locale, operations, profileOptions });
  const sessionActionContext = useSessionActionContextForApp({
    appState,
    locale,
    navigation,
    notifications,
    operations,
    passkeys,
    profileOptions,
    resolveErrorMessage,
  });
  const handlers = useHandlersForApp({
    appState,
    navigation,
    operations,
    sessionActionContext,
    shareRoute,
  });
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
  connectAppActionContext({
    appState,
    handlers,
    locale,
    navigation,
    notifications,
    operations,
    resolveErrorMessage,
    setLocale,
    shareRoute,
    t,
  });
  useAppLifecycleEffects({ appState, locale });
  return buildControllerModel({
    appState,
    appTheme,
    cardPadding,
    handlers,
    isLarge,
    navigation,
    notifications,
    passkeys,
    profileOptions,
    shareRoute,
    t,
    viewState: buildViewState(appState, navigation.appRoute, operations),
  });
}

function useAppTheme(theme: string, prefersDarkMode: boolean) {
  return useMemo(
    () => createAppTheme(resolveThemeMode(theme, prefersDarkMode)),
    [theme, prefersDarkMode],
  );
}

function useSessionBootstrapForApp({
  appState,
  locale,
  operations,
  profileOptions,
}: {
  appState: ReturnType<typeof useAppState>;
  locale: string;
  operations: AppControllerOperations;
  profileOptions: ReturnType<typeof useProfileOptions>;
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

function buildCapsuleRouteSyncOptions({
  appState,
  navigation,
  operations,
  resolveErrorMessage,
}: {
  appState: ReturnType<typeof useAppState>;
  navigation: ReturnType<typeof useAppNavigation>;
  operations: AppControllerOperations;
  resolveErrorMessage: (
    error: { message?: string } | null | undefined,
  ) => string;
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
  appState: ReturnType<typeof useAppState>;
  navigation: ReturnType<typeof useAppNavigation>;
  operations: AppControllerOperations;
  resolveErrorMessage: (
    error: { message?: string } | null | undefined,
  ) => string;
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

function useSessionActionContextForApp({
  appState,
  locale,
  navigation,
  notifications,
  operations,
  passkeys,
  profileOptions,
  resolveErrorMessage,
}: {
  appState: ReturnType<typeof useAppState>;
  locale: string;
  navigation: ReturnType<typeof useAppNavigation>;
  notifications: ReturnType<typeof useAppNotifications>;
  operations: AppControllerOperations;
  passkeys: ReturnType<typeof usePasskeyPrompt>;
  profileOptions: ReturnType<typeof useProfileOptions>;
  resolveErrorMessage: (
    error: { message?: string } | null | undefined,
  ) => string;
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

function useHandlersForApp({
  appState,
  navigation,
  operations,
  sessionActionContext,
  shareRoute,
}: {
  appState: ReturnType<typeof useAppState>;
  navigation: ReturnType<typeof useAppNavigation>;
  operations: AppControllerOperations;
  sessionActionContext: ReturnType<typeof useSessionActionContextForApp>;
  shareRoute: ReturnType<typeof useShareRoute>;
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

function useShareRouteOptions({
  appState,
  navigation,
  resolveErrorMessage,
}: {
  appState: ReturnType<typeof useAppState>;
  navigation: ReturnType<typeof useAppNavigation>;
  resolveErrorMessage: (
    error: { message?: string } | null | undefined,
  ) => string;
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

function buildViewState(
  state: ReturnType<typeof useAppState>,
  appRoute: ReturnType<typeof useAppNavigation>["appRoute"],
  operations: AppControllerOperations,
) {
  return buildAppViewState({
    activeCapsuleMeta: state.activeCapsuleMeta,
    appRoute,
    buildCurrentDraftSnapshot: operations.buildCurrentDraftSnapshot,
    currentView: state.currentView,
    hasProfile: state.hasProfile,
    isContentOperationLoading: state.isContentOperationLoading,
    isDownloadingWardrobePdf: state.isDownloadingWardrobePdf,
    isLoadingItems: state.isLoadingItems,
    isPartialRegenerationLoading: state.isPartialRegenerationLoading,
    isWardrobePending: state.isWardrobePending,
    pendingImageSetIndexes: state.pendingImageSetIndexes,
    profileCreated: state.profileCreated,
    user: state.user,
  });
}

function buildControllerModel({
  appState,
  appTheme,
  cardPadding,
  handlers,
  isLarge,
  navigation,
  notifications,
  passkeys,
  profileOptions,
  shareRoute,
  t,
  viewState,
}: {
  appState: ReturnType<typeof useAppState>;
  appTheme: unknown;
  cardPadding: number;
  handlers: ReturnType<typeof useAppHandlers>;
  isLarge: boolean;
  navigation: ReturnType<typeof useAppNavigation>;
  notifications: ReturnType<typeof useAppNotifications>;
  passkeys: ReturnType<typeof usePasskeyPrompt>;
  profileOptions: ReturnType<typeof useProfileOptions>;
  shareRoute: ReturnType<typeof useShareRoute>;
  t: (key: string, params?: Record<string, unknown>) => string;
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
