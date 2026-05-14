export type AppShellRouteLayoutFlags = {
  isMainScreenView: boolean;
  isMyWardrobeView: boolean;
  isSearchView: boolean;
  isStatisticsView: boolean;
};

export function isFullScreenAppShellRoute(
  flags: AppShellRouteLayoutFlags,
): boolean {
  return (
    flags.isMainScreenView ||
    flags.isMyWardrobeView ||
    flags.isSearchView ||
    flags.isStatisticsView
  );
}

export function getSidebarShellTestId({
  isMyWardrobeView,
  isSearchView,
  isStatisticsView,
}: Pick<
  AppShellRouteLayoutFlags,
  "isMyWardrobeView" | "isSearchView" | "isStatisticsView"
>): string {
  if (isSearchView) {
    return "search-screen-shell";
  }

  if (isMyWardrobeView) {
    return "my-wardrobe-screen-shell";
  }

  return isStatisticsView ? "statistics-screen-shell" : "main-screen-shell";
}
