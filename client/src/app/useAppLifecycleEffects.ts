import { useEffect } from "react";
import { fetchAppBootstrap } from "../api/appBootstrap";
import { updateProfileLocale } from "../api/auth";
import { addPersonalItemsChangedListener } from "./personalItemsCount";
import type { useAppState } from "./useAppState";

type AppState = ReturnType<typeof useAppState>;

function getPersonalItemsCountFromBootstrap(response: unknown) {
  const count = (response as { wardrobeCount?: unknown })?.wardrobeCount;
  return typeof count === "number" && Number.isFinite(count) ? count : null;
}

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

  usePersonalItemsCountRefreshEffect(appState);
}

function usePersonalItemsCountRefreshEffect(appState: AppState) {
  const {
    hasProfile,
    profileCreated,
    sessionInitialized,
    setPersonalItemsCount,
    user,
  } = appState;

  useEffect(() => {
    if (!sessionInitialized || !user || !(hasProfile || profileCreated)) {
      return undefined;
    }

    let isActive = true;
    const refreshPersonalItemsCount = () => {
      void fetchAppBootstrap()
        .then((response) => {
          if (isActive) {
            setPersonalItemsCount(getPersonalItemsCountFromBootstrap(response));
          }
        })
        .catch(() => {
          if (isActive) {
            setPersonalItemsCount(null);
          }
        });
    };

    const removeListener = addPersonalItemsChangedListener(
      refreshPersonalItemsCount,
    );
    return () => {
      isActive = false;
      removeListener();
    };
  }, [
    hasProfile,
    profileCreated,
    sessionInitialized,
    setPersonalItemsCount,
    user,
  ]);
}
