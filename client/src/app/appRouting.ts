import type { AppRoute } from "./appTypes";

export function getAppRoute(pathname = "/"): AppRoute {
  if (pathname.startsWith("/share/")) {
    return "share";
  }
  if (
    pathname === "/wardrobe" ||
    pathname === "/wardrobe/" ||
    pathname === "/my-wardrobe" ||
    pathname === "/my-wardrobe/"
  ) {
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
