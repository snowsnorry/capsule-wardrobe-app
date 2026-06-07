/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef } from "react";
import { createNewOutfit, openOutfit } from "./outfitActions";
import type { AppActionContext } from "./actionContext";
import type {
  AppRoute,
  OutfitMeta,
  OutfitRouteMode,
  StatusState,
} from "./appTypes";

type OutfitRouteSyncOptions = {
  activeOutfitId: string;
  activeOutfitMeta: OutfitMeta | null;
  appRoute: AppRoute;
  clearActiveOutfitState: () => void;
  getAppActionContext: () => AppActionContext;
  hasUsableProfile: boolean;
  isContentOperationLoading: boolean;
  navigateOutfit: (outfitId: string, options?: { replace?: boolean }) => void;
  outfitRouteId: string;
  outfitRouteMode: OutfitRouteMode;
  resolveErrorMessage: (
    error: { message?: string } | null | undefined,
  ) => string;
  sessionInitialized: boolean;
  setStatus: (status: StatusState) => void;
  userEmail: string;
};

export function useOutfitRouteSync(options: OutfitRouteSyncOptions) {
  const activeSyncKeyRef = useRef("");
  const completedCreateKeyRef = useRef("");
  const failedCreateKeyRef = useRef("");
  const failedOpenKeyRef = useRef("");
  const latestRouteKeyRef = useRef("");

  useEffect(() => {
    if (!canSyncOutfitRoute(options)) {
      if (!options.isContentOperationLoading || !activeSyncKeyRef.current) {
        latestRouteKeyRef.current = "";
      }
      return;
    }

    const refs = {
      activeSyncKeyRef,
      completedCreateKeyRef,
      failedCreateKeyRef,
      failedOpenKeyRef,
      latestRouteKeyRef,
    };
    const routeId = options.outfitRouteId.trim();
    if (options.outfitRouteMode === "open" && routeId) {
      syncOpenOutfitRoute(options, refs, routeId);
      return;
    }
    if (options.outfitRouteMode === "create") {
      syncCreateOutfitRoute(options, refs);
      return;
    }
    syncEmptyOutfitRoute(options, refs);
  }, [
    options.activeOutfitId,
    options.activeOutfitMeta,
    options.appRoute,
    options.clearActiveOutfitState,
    options.getAppActionContext,
    options.hasUsableProfile,
    options.isContentOperationLoading,
    options.navigateOutfit,
    options.outfitRouteId,
    options.outfitRouteMode,
    options.resolveErrorMessage,
    options.sessionInitialized,
    options.setStatus,
    options.userEmail,
  ]);
}

function canSyncOutfitRoute({
  appRoute,
  hasUsableProfile,
  isContentOperationLoading,
  sessionInitialized,
  userEmail,
}: OutfitRouteSyncOptions) {
  return Boolean(
    sessionInitialized &&
    userEmail &&
    hasUsableProfile &&
    appRoute === "outfit" &&
    !isContentOperationLoading,
  );
}

function syncOpenOutfitRoute(
  options: OutfitRouteSyncOptions,
  refs: Record<string, { current: string }>,
  routeId: string,
) {
  const syncKey = `open:${options.userEmail}:${routeId}`;
  refs.latestRouteKeyRef.current = syncKey;
  if (
    options.activeOutfitId === routeId &&
    options.activeOutfitMeta?.id === routeId
  ) {
    refs.activeSyncKeyRef.current = "";
    return;
  }
  if (
    refs.activeSyncKeyRef.current === syncKey ||
    refs.failedOpenKeyRef.current === syncKey
  ) {
    return;
  }

  refs.activeSyncKeyRef.current = syncKey;
  options.clearActiveOutfitState();
  void openOutfit(options.getAppActionContext(), routeId)
    .catch((error) => {
      if (refs.latestRouteKeyRef.current !== syncKey) return;
      refs.failedOpenKeyRef.current = syncKey;
      options.clearActiveOutfitState();
      options.setStatus({
        loading: false,
        error: options.resolveErrorMessage(error),
        infoKey: "",
        infoParams: null,
      });
    })
    .finally(() => {
      if (refs.activeSyncKeyRef.current === syncKey) {
        refs.activeSyncKeyRef.current = "";
      }
    });
}

function syncCreateOutfitRoute(
  options: OutfitRouteSyncOptions,
  refs: Record<string, { current: string }>,
) {
  const createKey = `create:${options.userEmail}`;
  refs.latestRouteKeyRef.current = createKey;
  if (
    refs.activeSyncKeyRef.current === createKey ||
    refs.failedCreateKeyRef.current === createKey ||
    refs.completedCreateKeyRef.current === createKey
  ) {
    return;
  }

  refs.activeSyncKeyRef.current = createKey;
  options.clearActiveOutfitState();
  void createNewOutfit(options.getAppActionContext())
    .then((outfit) => {
      if (refs.latestRouteKeyRef.current !== createKey) return;
      refs.failedCreateKeyRef.current = "";
      refs.completedCreateKeyRef.current = createKey;
      const outfitId = String(outfit?.id || "").trim();
      if (outfitId) options.navigateOutfit(outfitId, { replace: true });
    })
    .catch((error) => {
      if (refs.latestRouteKeyRef.current !== createKey) return;
      refs.failedCreateKeyRef.current = createKey;
      options.clearActiveOutfitState();
      options.setStatus({
        loading: false,
        error: options.resolveErrorMessage(error),
        infoKey: "",
        infoParams: null,
      });
    })
    .finally(() => {
      if (refs.activeSyncKeyRef.current === createKey) {
        refs.activeSyncKeyRef.current = "";
      }
    });
}

function syncEmptyOutfitRoute(
  options: OutfitRouteSyncOptions,
  refs: Record<string, { current: string }>,
) {
  refs.latestRouteKeyRef.current = "";
  refs.completedCreateKeyRef.current = "";
  refs.failedCreateKeyRef.current = "";
  refs.failedOpenKeyRef.current = "";
  if (options.activeOutfitId || options.activeOutfitMeta) {
    options.clearActiveOutfitState();
  }
}
