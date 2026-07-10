import { useCallback, useMemo } from "react";
import { useMediaQuery } from "@mui/material";
import { useI18n } from "../i18n/useI18n";
import { createAppTheme } from "../theme";
import { connectAppActionContext } from "./connectAppActionContext";
import { resolveThemeMode } from "./appViewState";
import { resolveAppErrorMessage } from "./errorMessages";
import { useAppControllerOperations } from "./useAppControllerOperations";
import { useAppLifecycleEffects } from "./useAppLifecycleEffects";
import { useAppNavigation } from "./useAppNavigation";
import { useAppNotifications } from "./useAppNotifications";
import { useAppState } from "./useAppState";
import { useJobTracker } from "./useActiveSidebarJobs";
import { useJobEntityReconciliation } from "./useJobEntityReconciliation";
import { usePasskeyPrompt } from "./usePasskeyPrompt";
import { useProfileOptions } from "./useProfileOptions";
import {
  buildControllerModel,
  buildViewState,
  useHandlersForApp,
  useRouteSyncForApp,
  useSessionActionContextForApp,
  useSessionBootstrapForApp,
  useShareRouteForApp,
} from "./useAppControllerModelParts";

export function useAppControllerModel() {
  const isLarge = useMediaQuery("(min-width:900px)");
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
  const { t, locale, setLocale } = useI18n();
  const navigation = useAppNavigation();
  const profileOptions = useProfileOptions();
  const appState = useAppState();
  const jobTracker = useJobTracker(appState.user?.email || "");
  const cardPadding = useMemo(() => (isLarge ? 5 : 3), [isLarge]);
  const appTheme = useAppTheme(appState.settingsProfile.theme, prefersDarkMode);
  const notifications = useAppNotifications(t, appState.settingsProfile.llm);
  const resolveErrorMessage = useCallback(
    (error: { message?: string } | null | undefined) =>
      resolveAppErrorMessage(error, t),
    [t],
  );
  const passkeys = usePasskeyPrompt(resolveErrorMessage, appState.setStatus);
  const shareRoute = useShareRouteForApp({
    appState,
    navigation,
    resolveErrorMessage,
  });
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
  useRouteSyncForApp({ appState, navigation, operations, resolveErrorMessage });
  connectAppActionContext({
    appState,
    handlers,
    jobTracker,
    locale,
    navigation,
    notifications,
    operations,
    resolveErrorMessage,
    setLocale,
    shareRoute,
    t,
  });
  useJobEntityReconciliation({
    appState,
    operations,
    resolveErrorMessage,
    userEmail: appState.user?.email || "",
  });
  useAppLifecycleEffects({ appState, locale });
  return buildControllerModel({
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
    viewState: buildViewState(appState, navigation.appRoute, operations),
  });
}

function useAppTheme(theme: string, prefersDarkMode: boolean) {
  return useMemo(
    () => createAppTheme(resolveThemeMode(theme, prefersDarkMode)),
    [theme, prefersDarkMode],
  );
}
