import { useCallback, useEffect, useState } from "react";
import type { AppNavigationOptions, AppRoute } from "./appTypes";
import { getAppRoute, getShareIdFromPath } from "./appRouting";

function getNavigationPath(nextApp: Exclude<AppRoute, "share">): string {
  if (nextApp === "myWardrobe") {
    return "/my-wardrobe";
  }

  if (nextApp === "explore") {
    return "/explore";
  }

  return nextApp === "statistics" ? "/statistics" : "/";
}

export function useAppNavigation() {
  const [appRoute, setAppRoute] = useState<AppRoute>(() =>
    typeof window === "undefined"
      ? "capsule"
      : getAppRoute(window.location.pathname),
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

    const handlePopState = () => {
      const nextRoute = getAppRoute(window.location.pathname);
      setAppRoute(nextRoute);
      if (nextRoute !== "explore") {
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
      setAppRoute(getAppRoute(nextPath));
    },
    [],
  );

  const clearShareRoute = useCallback(() => {
    setPendingShareId("");
    if (
      typeof window !== "undefined" &&
      window.location.pathname.startsWith("/share/")
    ) {
      window.history.replaceState({}, "", "/");
    }
    setAppRoute("capsule");
  }, []);

  const resetNavigation = useCallback(() => {
    if (typeof window !== "undefined" && window.location.pathname !== "/") {
      window.history.replaceState({}, "", "/");
    }
    setAppRoute("capsule");
    setSearchInitialQuery("");
    setSearchAutoOpenProductDetail(false);
    setPendingShareId("");
  }, []);

  return {
    appRoute,
    searchInitialQuery,
    searchAutoOpenProductDetail,
    pendingShareId,
    setPendingShareId,
    setAppRoute,
    clearShareRoute,
    navigateApp,
    resetNavigation,
  };
}
