import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import type {
  AppNavigationOptions,
  AppRoute,
  CapsuleNavigationOptions,
} from "./appTypes";
import { getAppRouteState, getShareIdFromPath } from "./appRouting";

const DEFAULT_APP_PATH = "/personal-items";

function getNavigationPath(nextApp: Exclude<AppRoute, "share">): string {
  if (nextApp === "wardrobe") {
    return DEFAULT_APP_PATH;
  }

  if (nextApp === "explore") {
    return "/explore";
  }

  if (nextApp === "outfit") {
    return "/outfit";
  }

  return nextApp === "statistics" ? "/statistics" : DEFAULT_APP_PATH;
}

function redirectEmptyPath() {
  if (typeof window === "undefined") {
    return DEFAULT_APP_PATH;
  }

  if (window.location.pathname !== "/") {
    return window.location.pathname;
  }

  window.history.replaceState(
    {},
    "",
    `${DEFAULT_APP_PATH}${window.location.search}`,
  );
  return DEFAULT_APP_PATH;
}

export function useAppNavigation() {
  const navigationState = useNavigationRouteState();
  const pathNavigation = usePathNavigation(navigationState);
  const appNavigation = useAppRouteNavigation(navigationState);
  const entityNavigation = useEntityNavigation(pathNavigation.navigateToPath);

  return {
    appRoute: navigationState.routeState.appRoute,
    capsuleRouteId: navigationState.routeState.capsuleRouteId,
    capsuleRouteMode: navigationState.routeState.capsuleRouteMode,
    outfitRouteId: navigationState.routeState.outfitRouteId,
    outfitRouteMode: navigationState.routeState.outfitRouteMode,
    searchInitialQuery: navigationState.searchInitialQuery,
    searchAutoOpenProductDetail: navigationState.searchAutoOpenProductDetail,
    pendingShareId: navigationState.pendingShareId,
    setPendingShareId: navigationState.setPendingShareId,
    setAppRoute: (appRoute: AppRoute) =>
      navigationState.setRouteState((current) => ({ ...current, appRoute })),
    clearShareRoute: pathNavigation.clearShareRoute,
    navigateCapsule: entityNavigation.navigateCapsule,
    navigateOutfit: entityNavigation.navigateOutfit,
    navigateApp: appNavigation.navigateApp,
    navigateNewCapsule: entityNavigation.navigateNewCapsule,
    navigateNewOutfit: entityNavigation.navigateNewOutfit,
    resetNavigation: pathNavigation.resetNavigation,
  };
}

function useNavigationRouteState() {
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

  useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const nextPath = redirectEmptyPath();
    setRouteState(getAppRouteState(nextPath));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    setRouteState(getAppRouteState(redirectEmptyPath()));

    const handlePopState = () => {
      const nextRoute = getAppRouteState(redirectEmptyPath());
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

  return {
    pendingShareId,
    routeState,
    searchAutoOpenProductDetail,
    searchInitialQuery,
    setPendingShareId,
    setRouteState,
    setSearchAutoOpenProductDetail,
    setSearchInitialQuery,
  };
}

type NavigationRouteState = ReturnType<typeof useNavigationRouteState>;

function useAppRouteNavigation(navigationState: NavigationRouteState) {
  const {
    setRouteState,
    setSearchAutoOpenProductDetail,
    setSearchInitialQuery,
  } = navigationState;
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
    [setRouteState, setSearchAutoOpenProductDetail, setSearchInitialQuery],
  );

  return { navigateApp };
}

function usePathNavigation(navigationState: NavigationRouteState) {
  const {
    setPendingShareId,
    setRouteState,
    setSearchAutoOpenProductDetail,
    setSearchInitialQuery,
  } = navigationState;
  const navigateToPath = useCallback(
    (path: string, replace = false) => {
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
    },
    [setRouteState, setSearchAutoOpenProductDetail, setSearchInitialQuery],
  );

  const clearShareRoute = useCallback(() => {
    setPendingShareId("");
    if (
      typeof window !== "undefined" &&
      window.location.pathname.startsWith("/share/")
    ) {
      window.history.replaceState({}, "", DEFAULT_APP_PATH);
    }
    setRouteState(getAppRouteState(DEFAULT_APP_PATH));
  }, [setPendingShareId, setRouteState]);

  const resetNavigation = useCallback(() => {
    if (
      typeof window !== "undefined" &&
      window.location.pathname !== DEFAULT_APP_PATH
    ) {
      window.history.replaceState({}, "", DEFAULT_APP_PATH);
    }
    setRouteState(getAppRouteState(DEFAULT_APP_PATH));
    setSearchInitialQuery("");
    setSearchAutoOpenProductDetail(false);
    setPendingShareId("");
  }, [
    setPendingShareId,
    setRouteState,
    setSearchAutoOpenProductDetail,
    setSearchInitialQuery,
  ]);

  return { clearShareRoute, navigateToPath, resetNavigation };
}

function useEntityNavigation(
  navigateToPath: (path: string, replace?: boolean) => void,
) {
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

  const navigateOutfit = useCallback(
    (outfitId: string, options: CapsuleNavigationOptions = {}) => {
      const normalizedId = String(outfitId || "").trim();
      if (!normalizedId) {
        return;
      }
      navigateToPath(
        `/outfit/${encodeURIComponent(normalizedId)}`,
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

  const navigateNewOutfit = useCallback(
    (options: CapsuleNavigationOptions = {}) => {
      navigateToPath("/outfit", options.replace);
    },
    [navigateToPath],
  );

  return {
    navigateCapsule,
    navigateOutfit,
    navigateNewCapsule,
    navigateNewOutfit,
  };
}
