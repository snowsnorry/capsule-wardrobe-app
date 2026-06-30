import { useEffect } from "react";
import { updateProfileLocale } from "../api/auth";
import type { useAppState } from "./useAppState";

type AppState = ReturnType<typeof useAppState>;

export function useAppLifecycleEffects({
  appState,
  locale,
}: {
  appState: AppState;
  locale: string;
}) {
  useEffect(() => {
    appState.isMountedRef.current = true;
    return () => {
      appState.isMountedRef.current = false;
    };
  }, [appState.isMountedRef]);

  useEffect(
    () => () => {
      if (appState.capsuleEventsAbortRef.current) {
        appState.capsuleEventsAbortRef.current.abort();
        appState.capsuleEventsAbortRef.current = null;
      }
      appState.pendingNotificationKindRef.current = "";
    },
    [appState.capsuleEventsAbortRef, appState.pendingNotificationKindRef],
  );

  useEffect(() => {
    appState.pendingRegenerationUrlsRef.current =
      appState.partialRegenerationPendingUrls;
  }, [
    appState.partialRegenerationPendingUrls,
    appState.pendingRegenerationUrlsRef,
  ]);

  useEffect(() => {
    appState.activeCapsuleIdRef.current = appState.activeCapsuleId;
  }, [appState.activeCapsuleId, appState.activeCapsuleIdRef]);

  useEffect(() => {
    appState.activeOutfitIdRef.current = appState.activeOutfitId;
  }, [appState.activeOutfitId, appState.activeOutfitIdRef]);

  useEffect(() => {
    if (
      !appState.sessionInitialized ||
      !appState.user ||
      !(appState.hasProfile || appState.profileCreated) ||
      !appState.settingsProfile.locale ||
      locale === appState.settingsProfile.locale
    )
      return;
    updateProfileLocale(locale)
      .then(() => {
        if (appState.isMountedRef.current)
          appState.setSettingsProfile((current) => ({ ...current, locale }));
      })
      .catch(() => {});
  }, [
    locale,
    appState.settingsProfile.locale,
    appState.sessionInitialized,
    appState.user,
    appState.hasProfile,
    appState.profileCreated,
    appState.isMountedRef,
    appState.setSettingsProfile,
    appState,
  ]);
}
