function getShellContainerVerticalPadding({
  isFullScreenRoute,
  isMainScreenView,
  isMyWardrobeView,
  isSearchView,
  isStatisticsView,
}: {
  isFullScreenRoute: boolean;
  isMainScreenView: boolean;
  isMyWardrobeView: boolean;
  isSearchView: boolean;
  isStatisticsView: boolean;
}) {
  const fullScreenPadding = { xs: 0, md: "12px" } as const;
  const cardPadding = { xs: 0, md: "24px" } as const;

  if (!isFullScreenRoute) {
    return { pt: cardPadding, pb: cardPadding } as const;
  }

  return {
    pt: fullScreenPadding,
    pb:
      isMainScreenView || isMyWardrobeView || isSearchView || isStatisticsView
        ? 0
        : fullScreenPadding,
  } as const;
}

export { getShellContainerVerticalPadding };
