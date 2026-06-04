import { useCallback, useEffect, useState } from "react";
import type {
  AppNavigationOptions,
  AppRoute,
  CapsuleNavigationOptions,
} from "./appTypes";
import { getAppRouteState, getShareIdFromPath } from "./appRouting";

function getNavigationPath(nextApp: Exclude<AppRoute, "share">): string {
  if (nextApp === "wardrobe") {
    return "/wardrobe";
  }

  if (nextApp === "explore") {
    return "/explore";
  }

  return nextApp === "statistics" ? "/statistics" : "/";
}

function canonicalizeLegacyWardrobePath() {
  if (
    typeof window === "undefined" ||
    !["/my-wardrobe", "/my-wardrobe/"].includes(window.location.pathname)
  ) {
    return;
  }

  window.history.replaceState(
    {},
    "",
    `/wardrobe${window.location.search}${window.location.hash}`,
  );
}

// eslint-disable-next-line max-lines-per-function
export function useAppNavigation() {
  const [routeState, setRouteState] = useState(() =>
    typeof window === "undefined"
      ? getAppRouteState("/")
      : getAppRouteState(window.location.pathname),
  );
  const [searchInitialQuery, setSearchInitialQuery] = useState("");
  const [searchAutoOpenProductDetail, setSearchAutoOpenProductDetail] =
    useState(false);
  const [pendingShareId, setPendingShareId] = useState(() =>
    typeof window === "undefined"
      ? ""
      : getShareIdFromPath(window.location.pathname),
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    canonicalizeLegacyWardrobePath();
    setRouteState(getAppRouteState(window.location.pathname));

    const handlePopState = () => {
      canonicalizeLegacyWardrobePath();
      const nextRoute = getAppRouteState(window.location.pathname);
      setRouteState(nextRoute);
      const nextApp = nextRoute.appRoute;
      if (nextApp !== "explore") {
        setSearchInitialQuery("");
        setSearchAutoOpenProductDetail(false);
      }
      setPendingShareId(getShareIdFromPath(window.location.pathname));
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const navigateApp = useCallback(
    (
      nextApp: Exclude<AppRoute, "share">,
      options: AppNavigationOptions = {},
    ) => {
      if (typeof window === "undefined") {
        return;
      }
      const nextPath = getNavigationPath(nextApp);
      if (window.location.pathname !== nextPath) {
        window.history.pushState({}, "", nextPath);
      }
      setSearchInitialQuery(
        nextApp === "explore" ? String(options.query || "") : "",
      );
      setSearchAutoOpenProductDetail(
        nextApp === "explore" && Boolean(options.openProductDetail),
      );
      setRouteState(getAppRouteState(nextPath));
    },
    [],
  );

  const navigateToPath = useCallback((path: string, replace = false) => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.location.pathname !== path) {
      if (replace) {
        window.history.replaceState({}, "", path);
      } else {
        window.history.pushState({}, "", path);
      }
    }
    setSearchInitialQuery("");
    setSearchAutoOpenProductDetail(false);
    setRouteState(getAppRouteState(path));
  }, []);

  const navigateCapsule = useCallback(
    (capsuleId: string, options: CapsuleNavigationOptions = {}) => {
      const normalizedId = String(capsuleId || "").trim();
      if (!normalizedId) {
        return;
      }
      navigateToPath(
        `/capsule/${encodeURIComponent(normalizedId)}`,
        options.replace,
      );
    },
    [navigateToPath],
  );

  const navigateNewCapsule = useCallback(
    (options: CapsuleNavigationOptions = {}) => {
      navigateToPath("/capsule", options.replace);
    },
    [navigateToPath],
  );

  const clearShareRoute = useCallback(() => {
    setPendingShareId("");
    if (
      typeof window !== "undefined" &&
      window.location.pathname.startsWith("/share/")
    ) {
      window.history.replaceState({}, "", "/");
    }
    setRouteState(getAppRouteState("/"));
  }, []);

  const resetNavigation = useCallback(() => {
    if (typeof window !== "undefined" && window.location.pathname !== "/") {
      window.history.replaceState({}, "", "/");
    }
    setRouteState(getAppRouteState("/"));
    setSearchInitialQuery("");
    setSearchAutoOpenProductDetail(false);
    setPendingShareId("");
  }, []);

  return {
    appRoute: routeState.appRoute,
    capsuleRouteId: routeState.capsuleRouteId,
    capsuleRouteMode: routeState.capsuleRouteMode,
    searchInitialQuery,
    searchAutoOpenProductDetail,
    pendingShareId,
    setPendingShareId,
    setAppRoute: (appRoute: AppRoute) =>
      setRouteState((current) => ({ ...current, appRoute })),
    clearShareRoute,
    navigateCapsule,
    navigateApp,
    navigateNewCapsule,
    resetNavigation,
  };
}
