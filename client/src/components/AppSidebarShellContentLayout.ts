import type {
  AppSidebarShellContext,
  AppSidebarShellContentMaxWidth,
} from "./AppSidebarShellTypes";

function getContentSurfaceWidthSx({
  contentWidth,
  desktopContentMaxWidth,
  isOverlaySidebar,
}: {
  contentWidth: "bounded" | "fill";
  desktopContentMaxWidth: AppSidebarShellContentMaxWidth;
  isOverlaySidebar: boolean;
}) {
  if (isOverlaySidebar || contentWidth === "fill") {
    return { flex: "1 1 auto", width: "100%", maxWidth: "none" } as const;
  }

  const contentSurfaceWidth = `${desktopContentMaxWidth.default}px`;
  const wideContentSurfaceWidth = `${desktopContentMaxWidth.wide ?? desktopContentMaxWidth.default}px`;
  const ultraWideContentSurfaceWidth = `${desktopContentMaxWidth.ultraWide ?? desktopContentMaxWidth.wide ?? desktopContentMaxWidth.default}px`;

  return {
    width: `min(100%, ${contentSurfaceWidth})`,
    maxWidth: contentSurfaceWidth,
    "@media (min-width: 2100px)": {
      width: `min(100%, ${wideContentSurfaceWidth})`,
      maxWidth: wideContentSurfaceWidth,
    },
    "@media (min-width: 2400px)": {
      width: `min(100%, ${ultraWideContentSurfaceWidth})`,
      maxWidth: ultraWideContentSurfaceWidth,
    },
  } as const;
}

function getShellMainLayout({
  contentAlignment,
  desktopContentEndGap,
  desktopContentGap,
  context,
}: {
  contentAlignment: "center" | "start";
  desktopContentEndGap?: number;
  desktopContentGap?: number;
  context: AppSidebarShellContext;
}) {
  const {
    isOverlaySidebar,
    isLargeDesktopSidebar,
    desktopSidebarWidth,
    desktopContentInset,
    desktopSidebarGap,
  } = context;
  const resolvedGap = desktopContentGap ?? desktopSidebarGap;
  const resolvedEndGap = desktopContentEndGap ?? resolvedGap;
  const contentInset =
    desktopContentGap === undefined
      ? desktopContentInset
      : desktopSidebarWidth + resolvedGap;

  return {
    dataAlignment: isOverlaySidebar
      ? "overlay"
      : contentAlignment === "center"
        ? "centered"
        : "start",
    justifyContent: isOverlaySidebar ? "stretch" : contentAlignment,
    marginRight: isOverlaySidebar ? 0 : `${resolvedEndGap}px`,
    paddingLeft: isOverlaySidebar ? 0 : `${contentInset}px`,
    sidebarMode: isOverlaySidebar
      ? "overlay"
      : isLargeDesktopSidebar
        ? "desktop-large"
        : "desktop-medium",
    transition: isOverlaySidebar ? undefined : "padding-left 240ms ease",
  } as const;
}

function getShellMainStackSx({
  contentOverflow,
  left,
  usesFillPlainSurface,
}: {
  contentOverflow: "hidden" | "visible";
  left: string | 0;
  usesFillPlainSurface: boolean;
}) {
  return {
    position: usesFillPlainSurface ? "fixed" : "relative",
    top: usesFillPlainSurface ? 0 : undefined,
    right: usesFillPlainSurface ? 0 : undefined,
    bottom: usesFillPlainSurface ? 0 : undefined,
    left: usesFillPlainSurface ? left : undefined,
    width: usesFillPlainSurface ? "auto" : "100%",
    height: usesFillPlainSurface ? "auto" : "100%",
    minHeight: 0,
    overflow: contentOverflow,
  } as const;
}

function getShellMainFrameSx({
  contentOverflow,
  justifyContent,
  marginRight,
  paddingLeft,
  transition,
  usesFillPlainSurface,
}: {
  contentOverflow: "hidden" | "visible";
  justifyContent: "center" | "start" | "stretch";
  marginRight: string | 0;
  paddingLeft: string | 0;
  transition?: string;
  usesFillPlainSurface: boolean;
}) {
  return {
    flex: 1,
    width: "100%",
    minHeight: 0,
    overflow: contentOverflow,
    pl: usesFillPlainSurface ? 0 : paddingLeft,
    mr: usesFillPlainSurface ? 0 : marginRight,
    mt: usesFillPlainSurface ? 0 : { xs: 0, md: 0.5 },
    mb: usesFillPlainSurface ? 0 : { xs: 0, md: 0.5 },
    boxSizing: "border-box",
    display: "flex",
    justifyContent,
    transition,
  } as const;
}

export {
  getContentSurfaceWidthSx,
  getShellMainFrameSx,
  getShellMainLayout,
  getShellMainStackSx,
};
