import { useCallback, useMemo } from "react";
import { useMediaQuery } from "@mui/material";
import { useI18n } from "../i18n/useI18n";
import { createAppTheme } from "../theme";
import { buildAppActionContext } from "./buildAppActionContext";
import { buildAppControllerModel } from "./buildAppControllerModel";
import { buildAppSessionActionContext } from "./buildAppSessionActionContext";
import {
  buildAppViewState,
  resolveThemeMode,
  toggleStringSelection,
} from "./appViewState";
import { resolveAppErrorMessage } from "./errorMessages";
import {
  useAppControllerOperations,
  type AppControllerOperations,
} from "./useAppControllerOperations";
import { useAppHandlers } from "./useAppHandlers";
import { useAppLifecycleEffects } from "./useAppLifecycleEffects";
import { useAppNavigation } from "./useAppNavigation";
import { useAppNotifications } from "./useAppNotifications";
import { useAppState } from "./useAppState";
import { usePasskeyPrompt } from "./usePasskeyPrompt";
import { useProfileOptions } from "./useProfileOptions";
import { useSessionBootstrap } from "./useSessionBootstrap";
import { useShareRoute } from "./useShareRoute";
import { retry } from "./retry";

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
  useSessionBootstrapForApp({ appState, operations, profileOptions });
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
  operations.getAppActionContext = () =>
    buildAppActionContext({
      appState,
      applyCapsuleState: operations.applyCapsuleState,
      applyWardrobeSnapshot: operations.applyWardrobeSnapshot,
      bootstrapCapsules: operations.bootstrapCapsules,
      buildCurrentDraftSnapshot: operations.buildCurrentDraftSnapshot,
      clearShareRoute: shareRoute.clearShareRoute,
      closeNotificationPrompt: notifications.closeNotificationPrompt,
      handlers,
      locale,
      pendingShareId: navigation.pendingShareId,
      resolveErrorMessage,
      setIsShareLoading: shareRoute.setIsShareLoading,
      setLocale,
      shareMetadata: shareRoute.shareMetadata,
      startCapsuleEventStream: operations.startCapsuleEventStream,
      startPendingNotificationFlow: operations.startPendingNotificationFlow,
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
  operations,
  profileOptions,
}: {
  appState: ReturnType<typeof useAppState>;
  operations: AppControllerOperations;
  profileOptions: ReturnType<typeof useProfileOptions>;
}) {
  useSessionBootstrap({
    bootstrapCapsules: operations.bootstrapCapsules,
    ensureOptionsLoaded: profileOptions.ensureOptionsLoaded,
    preloadOnboardingOptions: profileOptions.preloadOnboardingOptions,
    setHasProfile: appState.setHasProfile,
    setIsCheckingSession: appState.setIsCheckingSession,
    setProfileCreated: appState.setProfileCreated,
    setSessionInitialized: appState.setSessionInitialized,
    setSettingsProfile: appState.setSettingsProfile,
    setUser: appState.setUser,
  });
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
    capsuleSidebarActionsRef: appState.capsuleSidebarActionsRef,
    getAppActionContext: operations.getAppActionContext,
    navigateApp: navigation.navigateApp,
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
