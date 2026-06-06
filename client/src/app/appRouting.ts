import type { AppRoute, CapsuleRouteMode } from "./appTypes";

export type AppRouteState = {
  appRoute: AppRoute;
  capsuleRouteId: string;
  capsuleRouteMode: CapsuleRouteMode;
};

function decodePathSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function getCapsuleRouteState(
  pathname = "/",
): Pick<AppRouteState, "capsuleRouteId" | "capsuleRouteMode"> {
  if (pathname === "/capsule" || pathname === "/capsule/") {
    return { capsuleRouteId: "", capsuleRouteMode: "create" };
  }

  const match = pathname.match(/^\/capsule\/([^/?#]+)\/?$/);
  if (match?.[1]) {
    return {
      capsuleRouteId: decodePathSegment(match[1]),
      capsuleRouteMode: "open",
    };
  }

  return { capsuleRouteId: "", capsuleRouteMode: "empty" };
}

export function getAppRoute(pathname = "/"): AppRoute {
  if (pathname.startsWith("/share/")) {
    return "share";
  }
  if (pathname === "/personal-items" || pathname === "/personal-items/") {
    return "wardrobe";
  }
  if (pathname === "/explore" || pathname === "/explore/") {
    return "explore";
  }
  if (pathname === "/statistics" || pathname === "/statistics/") {
    return "statistics";
  }
  return "capsule";
}

export function getAppRouteState(pathname = "/"): AppRouteState {
  const appRoute = getAppRoute(pathname);
  const capsuleState =
    appRoute === "capsule"
      ? getCapsuleRouteState(pathname)
      : { capsuleRouteId: "", capsuleRouteMode: "empty" as const };

  return {
    appRoute,
    ...capsuleState,
  };
}

export function getShareIdFromPath(pathname = "") {
  const match = pathname.match(/^\/share\/([^/?#]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : "";
}

export function getActiveSidebarApp(
  appRoute: AppRoute,
): "capsule" | "explore" | "wardrobe" | "statistics" {
  if (
    appRoute === "explore" ||
    appRoute === "wardrobe" ||
    appRoute === "statistics"
  ) {
    return appRoute;
  }

  return "capsule";
}
