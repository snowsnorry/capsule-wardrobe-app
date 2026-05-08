import { getAppRoute } from "./appRouting";
import type { AppRoute } from "./appTypes";

function importMainScreen() {
  return import("../screens/mainScreen/MainScreen");
}

function shouldPreloadMainScreenForRoute(route: AppRoute) {
  return route === "capsule" || route === "share";
}

function shouldPreloadMainScreenForCurrentPath() {
  if (typeof window === "undefined") return false;
  return shouldPreloadMainScreenForRoute(getAppRoute(window.location.pathname));
}

function preloadMainScreen() {
  void importMainScreen();
}

export {
  importMainScreen,
  preloadMainScreen,
  shouldPreloadMainScreenForCurrentPath,
  shouldPreloadMainScreenForRoute,
};
