function getShellContainerVerticalPadding({
  isFullScreenRoute,
  isMainScreenView,
}: {
  isFullScreenRoute: boolean;
  isMainScreenView: boolean;
}) {
  const fullScreenPadding = { xs: 0, md: "12px" } as const;
  const cardPadding = { xs: 0, md: "24px" } as const;

  if (!isFullScreenRoute) {
    return { pt: cardPadding, pb: cardPadding } as const;
  }

  return {
    pt: fullScreenPadding,
    pb: isMainScreenView ? 0 : fullScreenPadding,
  } as const;
}

export { getShellContainerVerticalPadding };
