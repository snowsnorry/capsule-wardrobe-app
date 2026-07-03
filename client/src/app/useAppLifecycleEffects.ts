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
  const {
    activeCapsuleId,
    activeCapsuleIdRef,
    activeOutfitId,
    activeOutfitIdRef,
    capsuleEventsAbortRef,
    hasProfile,
    isMountedRef,
    partialRegenerationPendingUrls,
    pendingNotificationKindRef,
    pendingRegenerationUrlsRef,
    profileCreated,
    sessionInitialized,
    setSettingsProfile,
    settingsProfile,
    user,
  } = appState;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, [isMountedRef]);

  useEffect(
    () => () => {
      if (capsuleEventsAbortRef.current) {
        capsuleEventsAbortRef.current.abort();
        capsuleEventsAbortRef.current = null;
      }
      pendingNotificationKindRef.current = "";
    },
    [capsuleEventsAbortRef, pendingNotificationKindRef],
  );

  useEffect(() => {
    pendingRegenerationUrlsRef.current = partialRegenerationPendingUrls;
  }, [partialRegenerationPendingUrls, pendingRegenerationUrlsRef]);

  useEffect(() => {
    activeCapsuleIdRef.current = activeCapsuleId;
  }, [activeCapsuleId, activeCapsuleIdRef]);

  useEffect(() => {
    activeOutfitIdRef.current = activeOutfitId;
  }, [activeOutfitId, activeOutfitIdRef]);

  useEffect(() => {
    if (
      !sessionInitialized ||
      !user ||
      !(hasProfile || profileCreated) ||
      !settingsProfile.locale ||
      locale === settingsProfile.locale
    )
      return;
    updateProfileLocale(locale)
      .then(() => {
        if (isMountedRef.current)
          setSettingsProfile((current) => ({ ...current, locale }));
      })
      .catch(() => {});
  }, [
    locale,
    settingsProfile.locale,
    sessionInitialized,
    user,
    hasProfile,
    profileCreated,
    isMountedRef,
    setSettingsProfile,
  ]);
}
