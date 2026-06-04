export type AppShellRouteLayoutFlags = {
  isMainScreenView: boolean;
  isWardrobeView: boolean;
  isSearchView: boolean;
  isStatisticsView: boolean;
};

export function isFullScreenAppShellRoute(
  flags: AppShellRouteLayoutFlags,
): boolean {
  return (
    flags.isMainScreenView ||
    flags.isWardrobeView ||
    flags.isSearchView ||
    flags.isStatisticsView
  );
}

export function getSidebarShellTestId({
  isWardrobeView,
  isSearchView,
  isStatisticsView,
}: Pick<
  AppShellRouteLayoutFlags,
  "isWardrobeView" | "isSearchView" | "isStatisticsView"
>): string {
  if (isSearchView) {
    return "search-screen-shell";
  }

  if (isWardrobeView) {
    return "wardrobe-screen-shell";
  }

  return isStatisticsView ? "statistics-screen-shell" : "main-screen-shell";
}
