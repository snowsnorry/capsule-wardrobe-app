import type { AppRoute, CapsuleRouteMode, OutfitRouteMode } from "./appTypes";

export type AppRouteState = {
  appRoute: AppRoute;
  capsuleRouteId: string;
  capsuleRouteMode: CapsuleRouteMode;
  outfitRouteId: string;
  outfitRouteMode: OutfitRouteMode;
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

export function getOutfitRouteState(
  pathname = "/",
): Pick<AppRouteState, "outfitRouteId" | "outfitRouteMode"> {
  if (pathname === "/outfit" || pathname === "/outfit/") {
    return { outfitRouteId: "", outfitRouteMode: "create" };
  }

  const match = pathname.match(/^\/outfit\/([^/?#]+)\/?$/);
  if (match?.[1]) {
    return {
      outfitRouteId: decodePathSegment(match[1]),
      outfitRouteMode: "open",
    };
  }

  return { outfitRouteId: "", outfitRouteMode: "empty" };
}

export function getAppRoute(pathname = "/"): AppRoute {
  if (pathname.startsWith("/share/")) {
    return "share";
  }
  if (pathname === "/personal-items" || pathname === "/personal-items/") {
    return "wardrobe";
  }
  if (pathname === "/outfit" || pathname.startsWith("/outfit/")) {
    return "outfit";
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
  const outfitState =
    appRoute === "outfit"
      ? getOutfitRouteState(pathname)
      : { outfitRouteId: "", outfitRouteMode: "empty" as const };

  return {
    appRoute,
    ...capsuleState,
    ...outfitState,
  };
}

export function getShareIdFromPath(pathname = "") {
  const match = pathname.match(/^\/share\/([^/?#]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : "";
}

export function getActiveSidebarApp(
  appRoute: AppRoute,
): "capsule" | "outfit" | "explore" | "wardrobe" | "statistics" {
  if (
    appRoute === "outfit" ||
    appRoute === "explore" ||
    appRoute === "wardrobe" ||
    appRoute === "statistics"
  ) {
    return appRoute;
  }

  return "capsule";
}
