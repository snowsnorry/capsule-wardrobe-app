import { useEffect, useRef } from "react";
import { createNewCapsule, openCapsule } from "./capsuleActions";
import type { AppActionContext } from "./actionContext";
import type {
  AppRoute,
  CapsuleMeta,
  CapsuleRouteMode,
  StatusState,
} from "./appTypes";
import type { AppControllerOperations } from "./useAppControllerOperations";

type CapsuleRouteSyncOptions = {
  activeCapsuleId: string;
  activeCapsuleMeta: CapsuleMeta | null;
  appRoute: AppRoute;
  capsuleRouteId: string;
  capsuleRouteMode: CapsuleRouteMode;
  getAppActionContext: () => AppActionContext;
  hasUsableProfile: boolean;
  isContentOperationLoading: boolean;
  navigateCapsule: (capsuleId: string, options?: { replace?: boolean }) => void;
  pendingShareId: string;
  resolveErrorMessage: (
    error: { message?: string } | null | undefined,
  ) => string;
  sessionInitialized: boolean;
  setStatus: (status: StatusState) => void;
  userEmail: string;
  clearActiveCapsuleState: AppControllerOperations["clearActiveCapsuleState"];
};

type CapsuleRouteSyncRefs = {
  activeSyncKeyRef: { current: string };
  completedCreateKeyRef: { current: string };
  failedCreateKeyRef: { current: string };
  failedOpenKeyRef: { current: string };
  latestRouteKeyRef: { current: string };
};

export function useCapsuleRouteSync(options: CapsuleRouteSyncOptions) {
  const activeSyncKeyRef = useRef("");
  const completedCreateKeyRef = useRef("");
  const failedCreateKeyRef = useRef("");
  const failedOpenKeyRef = useRef("");
  const latestRouteKeyRef = useRef("");
  const {
    activeCapsuleId,
    activeCapsuleMeta,
    appRoute,
    capsuleRouteId,
    capsuleRouteMode,
    clearActiveCapsuleState,
    getAppActionContext,
    hasUsableProfile,
    isContentOperationLoading,
    navigateCapsule,
    pendingShareId,
    resolveErrorMessage,
    sessionInitialized,
    setStatus,
    userEmail,
  } = options;

  useEffect(() => {
    const effectOptions = {
      activeCapsuleId,
      activeCapsuleMeta,
      appRoute,
      capsuleRouteId,
      capsuleRouteMode,
      clearActiveCapsuleState,
      getAppActionContext,
      hasUsableProfile,
      isContentOperationLoading,
      navigateCapsule,
      pendingShareId,
      resolveErrorMessage,
      sessionInitialized,
      setStatus,
      userEmail,
    };
    const refs = {
      activeSyncKeyRef,
      completedCreateKeyRef,
      failedCreateKeyRef,
      failedOpenKeyRef,
      latestRouteKeyRef,
    };

    if (!canSyncCapsuleRoute(effectOptions)) {
      latestRouteKeyRef.current = "";
      return;
    }

    const routeId = capsuleRouteId.trim();
    if (capsuleRouteMode === "open" && routeId) {
      syncOpenCapsuleRoute(effectOptions, refs, routeId);
      return;
    }

    if (capsuleRouteMode === "create") {
      syncCreateCapsuleRoute(effectOptions, refs);
      return;
    }

    syncEmptyCapsuleRoute(effectOptions, refs);
  }, [
    activeCapsuleId,
    activeCapsuleMeta,
    appRoute,
    capsuleRouteId,
    capsuleRouteMode,
    clearActiveCapsuleState,
    getAppActionContext,
    hasUsableProfile,
    isContentOperationLoading,
    navigateCapsule,
    pendingShareId,
    resolveErrorMessage,
    sessionInitialized,
    setStatus,
    userEmail,
  ]);
}

function canSyncCapsuleRoute({
  appRoute,
  hasUsableProfile,
  isContentOperationLoading,
  pendingShareId,
  sessionInitialized,
  userEmail,
}: CapsuleRouteSyncOptions) {
  return Boolean(
    sessionInitialized &&
    userEmail &&
    hasUsableProfile &&
    appRoute === "capsule" &&
    !pendingShareId &&
    !isContentOperationLoading,
  );
}

function syncOpenCapsuleRoute(
  options: CapsuleRouteSyncOptions,
  refs: CapsuleRouteSyncRefs,
  routeId: string,
) {
  const {
    activeCapsuleId,
    activeCapsuleMeta,
    clearActiveCapsuleState,
    getAppActionContext,
    resolveErrorMessage,
    setStatus,
    userEmail,
  } = options;
  const syncKey = `open:${userEmail}:${routeId}`;
  refs.latestRouteKeyRef.current = syncKey;
  if (activeCapsuleId === routeId && activeCapsuleMeta?.id === routeId) {
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
  clearActiveCapsuleState();
  void openCapsule(getAppActionContext(), routeId)
    .catch((error) => {
      if (refs.latestRouteKeyRef.current !== syncKey) return;
      refs.failedOpenKeyRef.current = syncKey;
      clearActiveCapsuleState();
      setStatus({
        loading: false,
        error: resolveErrorMessage(error),
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

function syncCreateCapsuleRoute(
  options: CapsuleRouteSyncOptions,
  refs: CapsuleRouteSyncRefs,
) {
  const {
    clearActiveCapsuleState,
    getAppActionContext,
    navigateCapsule,
    resolveErrorMessage,
    setStatus,
    userEmail,
  } = options;
  const createKey = `create:${userEmail}`;
  refs.latestRouteKeyRef.current = createKey;
  if (
    refs.activeSyncKeyRef.current === createKey ||
    refs.failedCreateKeyRef.current === createKey ||
    refs.completedCreateKeyRef.current === createKey
  ) {
    return;
  }

  refs.activeSyncKeyRef.current = createKey;
  clearActiveCapsuleState();
  void createNewCapsule(getAppActionContext())
    .then((capsule) => {
      if (refs.latestRouteKeyRef.current !== createKey) return;
      refs.failedCreateKeyRef.current = "";
      refs.completedCreateKeyRef.current = createKey;
      const capsuleId = String(capsule?.id || "").trim();
      if (capsuleId) navigateCapsule(capsuleId, { replace: true });
    })
    .catch((error) => {
      if (refs.latestRouteKeyRef.current !== createKey) return;
      refs.failedCreateKeyRef.current = createKey;
      clearActiveCapsuleState();
      setStatus({
        loading: false,
        error: resolveErrorMessage(error),
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

function syncEmptyCapsuleRoute(
  {
    activeCapsuleId,
    activeCapsuleMeta,
    clearActiveCapsuleState,
  }: CapsuleRouteSyncOptions,
  refs: CapsuleRouteSyncRefs,
) {
  refs.latestRouteKeyRef.current = "";
  refs.completedCreateKeyRef.current = "";
  refs.failedCreateKeyRef.current = "";
  refs.failedOpenKeyRef.current = "";
  if (activeCapsuleId || activeCapsuleMeta) {
    clearActiveCapsuleState();
  }
}
