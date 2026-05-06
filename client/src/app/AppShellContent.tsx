import { Suspense, type ReactNode } from "react";
import { Box, Container, IconButton, Paper, Stack, Typography } from "@mui/material";
import FiberManualRecordRoundedIcon from "@mui/icons-material/FiberManualRecordRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import AppSidebarNavigation from "../components/AppSidebarNavigation";
import AppSidebarShell from "../components/AppSidebarShell";
import RoutePanelFallback from "./RoutePanelFallback";
import { getActiveSidebarApp } from "./appRouting";
import type { AppNavigationOptions, AppRoute, CapsuleMeta, ProfileSettings, UserLike } from "./appTypes";
import type { SettingsSavePayload } from "../components/SettingsDialog";

type TranslationFn = (key: string, params?: Record<string, unknown>) => string;

type AppShellContentProps = {
  activeCapsuleId: string;
  activeCapsuleMeta: CapsuleMeta | null;
  appRoute: AppRoute;
  capsuleList: CapsuleMeta[];
  cardPadding: number;
  children: ReactNode;
  currentView: string;
  hasBrandedPanelHeader: boolean;
  isContentBusy: boolean;
  isLarge: boolean;
  isMainScreenView: boolean;
  isSearchView: boolean;
  isSignInView: boolean;
  isStatisticsView: boolean;
  sessionInitialized: boolean;
  settingsProfile: ProfileSettings;
  t: TranslationFn;
  user: UserLike | null;
  onCreateCapsuleFromSidebar: (onComplete?: () => void) => Promise<void>;
  onNavigateApp: (nextApp: Exclude<AppRoute, "share">, options?: AppNavigationOptions) => void;
  onOpenCapsuleFromSidebar: (capsuleId: string, onComplete?: () => void) => Promise<void>;
  onRequestSignOut: () => void;
  onSaveSettings: (nextSettings: SettingsSavePayload) => Promise<void>;
  openCapsuleActions: (event: React.MouseEvent<HTMLElement>, capsule: CapsuleMeta) => void;
  openSearchDialog: () => void;
};

function SuspendedContent({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<RoutePanelFallback />}>
      {children}
    </Suspense>
  );
}

function MarketingPanel({ isLarge, t }: Pick<AppShellContentProps, "isLarge" | "t">) {
  return (
    <Stack spacing={{ xs: 1.9, md: 2.2 }} sx={{ display: { xs: "none", md: "flex" }, pr: { md: 4 } }}>
      <Box
        sx={{
          width: { md: "92%", lg: "100%" },
          maxWidth: { md: 340, lg: 420 },
          ml: { md: -1, lg: -2 },
          mb: { md: -1.4, lg: -1.8 },
          overflow: "hidden",
          position: "relative",
          "&::after": {
            content: '""',
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: `
              radial-gradient(circle at 50% 50%, rgba(252, 251, 249, 0) 62%, rgba(252, 251, 249, 0.07) 84%, rgba(252, 251, 249, 0.14) 100%),
              linear-gradient(to top, rgba(252, 251, 249, 0.08), rgba(252, 251, 249, 0)),
              linear-gradient(to bottom, rgba(252, 251, 249, 0.07), rgba(252, 251, 249, 0)),
              linear-gradient(to right, rgba(252, 251, 249, 0.07), rgba(252, 251, 249, 0)),
              linear-gradient(to left, rgba(252, 251, 249, 0.07), rgba(252, 251, 249, 0))
            `
          }
        }}
      >
        <Box component="picture" sx={{ display: "block" }}>
          <source srcSet="/girl.webp" type="image/webp" />
          <Box
            component="img"
            src="/girl.png"
            alt=""
            aria-hidden="true"
            loading="eager"
            decoding="async"
            {...({ fetchpriority: "high" } as Record<string, string>)}
            sx={{
              display: "block",
              width: "100%",
              height: "auto",
              filter: "saturate(0.96) contrast(0.98)",
              opacity: 0.98,
              transform: "translateZ(0)",
              willChange: "transform",
              backfaceVisibility: "hidden",
              imageRendering: "auto",
              objectFit: "cover",
              mixBlendMode: "multiply"
            }}
          />
        </Box>
      </Box>
      <Typography
        variant={isLarge ? "h2" : "h3"}
        sx={{
          mt: { xs: 0.15, md: 0.1 },
          maxWidth: { xs: "14ch", md: "20ch" },
          fontSize: { xs: "1.46rem", sm: "1.7rem", md: "2rem", lg: "2.28rem" },
          lineHeight: { xs: 1.2, md: 1.16 },
          letterSpacing: "-0.015em",
          fontWeight: 600
        }}
      >
        {t("marketingHeadline")}
      </Typography>
    </Stack>
  );
}

function SidebarHeader(props: Pick<AppShellContentProps, "activeCapsuleMeta" | "appRoute" | "isContentBusy" | "t"> & {
  openSidebar: () => void;
}) {
  const activeSidebarApp = getActiveSidebarApp(props.appRoute);
  return (
    <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: 2, pt: 1.5, pb: 1 }}>
      <IconButton
        aria-label="Toggle sidebar"
        onClick={props.openSidebar}
        disabled={activeSidebarApp === "capsule" && props.isContentBusy}
        sx={{ ml: -1, flexShrink: 0 }}
      >
        <MenuRoundedIcon />
      </IconButton>
      {activeSidebarApp === "capsule" ? (
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0, flex: "0 1 auto" }}>
          <Typography variant="h6" noWrap sx={{ minWidth: 0 }}>
            {props.activeCapsuleMeta?.name || `<${props.t("capsule.new")}>`}
          </Typography>
          {props.activeCapsuleMeta?.status === "new" || props.activeCapsuleMeta?.status === "modified" ? (
            <FiberManualRecordRoundedIcon sx={{ fontSize: 10, color: "#2f8f58", flexShrink: 0 }} />
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
}

function AppSidebarPanel(props: AppShellContentProps) {
  const activeSidebarApp = getActiveSidebarApp(props.appRoute);
  return (
    <AppSidebarShell
      shellTestId={props.isSearchView ? "search-screen-shell" : props.isStatisticsView ? "statistics-screen-shell" : "main-screen-shell"}
      currentApp={activeSidebarApp}
      contentSurface="plain"
      userEmail={props.user?.email || ""}
      userName={props.settingsProfile.fullname}
      settingsProfile={props.settingsProfile}
      onSaveSettings={props.onSaveSettings}
      onSignOut={props.onRequestSignOut}
      headerContent={({ isOverlaySidebar, openSidebar }) => (
        isOverlaySidebar ? <SidebarHeader {...props} openSidebar={openSidebar} /> : null
      )}
      sidebarBodyContent={({ isOverlaySidebar, isSidebarCollapsed, desktopSidebarRailWidth, expandCollapsedSidebar, closeSidebar }) => (
        <AppSidebarNavigation
          activeApp={activeSidebarApp}
          isOverlaySidebar={isOverlaySidebar}
          isSidebarCollapsed={isSidebarCollapsed}
          desktopSidebarRailWidth={desktopSidebarRailWidth}
          isInteractionDisabled={activeSidebarApp === "capsule" && props.isContentBusy}
          capsuleList={props.capsuleList}
          activeCapsuleId={props.activeCapsuleId}
          onNavigateApp={props.onNavigateApp}
          onCreateCapsule={async () => {
            await props.onCreateCapsuleFromSidebar(isOverlaySidebar ? closeSidebar : undefined);
          }}
          onSearchCapsules={props.openSearchDialog}
          onOpenCapsule={(capsuleId) => {
            void props.onOpenCapsuleFromSidebar(capsuleId, isOverlaySidebar ? closeSidebar : undefined);
          }}
          onOpenCapsuleActions={props.openCapsuleActions}
          capsuleHasUnsavedChanges={(capsule) => capsule?.status === "new" || capsule?.status === "modified"}
          onExpandedAction={isOverlaySidebar ? closeSidebar : undefined}
          collapsedExpandHitbox={(
            <Box
              data-testid="collapsed-sidebar-expand-hitbox"
              onClick={expandCollapsedSidebar}
              sx={{ flex: 1, minHeight: 0, cursor: "pointer" }}
            />
          )}
        />
      )}
    >
      <SuspendedContent>{props.children}</SuspendedContent>
    </AppSidebarShell>
  );
}

function CardPanel(props: Pick<AppShellContentProps, "cardPadding" | "children" | "hasBrandedPanelHeader" | "isSignInView">) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: props.cardPadding,
        pt: props.hasBrandedPanelHeader ? { xs: 3, md: 3.25 } : undefined,
        minHeight: 0,
        height: props.isSignInView ? { xs: "100%", md: "532px" } : "100%",
        borderRadius: { xs: 0, md: "22px" },
        display: "flex",
        flexDirection: "column",
        overflow: "hidden"
      }}
    >
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          height: "100%",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-y"
        }}
      >
        <SuspendedContent>{props.children}</SuspendedContent>
      </Box>
    </Paper>
  );
}

export default function AppShellContent(props: AppShellContentProps) {
  const isFullScreenRoute = props.isMainScreenView || props.isSearchView || props.isStatisticsView;
  return (
    <Box
      sx={{
        height: "100vh",
        display: "flex",
        alignItems: "stretch",
        backgroundColor: "background.default",
        position: "relative",
        overflow: "hidden",
        "&::before": { display: "none" },
        "&::after": { display: "none" }
      }}
    >
      <Container
        disableGutters={isFullScreenRoute}
        maxWidth={isFullScreenRoute ? false : "lg"}
        sx={{
          position: "relative",
          zIndex: 1,
          display: "grid",
          gap: { xs: 3, md: 6 },
          gridTemplateColumns: props.user ? "1fr" : { xs: "1fr", md: "1.2fr 1fr" },
          alignItems: "center",
          py: isFullScreenRoute ? { xs: 0, md: "12px" } : { xs: 0, md: "24px" },
          px: isFullScreenRoute ? 0 : { xs: 0, md: 3 },
          maxWidth: isFullScreenRoute ? "none" : undefined,
          minHeight: "100vh",
          height: "100%",
          boxSizing: "border-box"
        }}
      >
        {!props.sessionInitialized ? null : !props.user ? <MarketingPanel isLarge={props.isLarge} t={props.t} /> : null}
        {!props.sessionInitialized ? null : isFullScreenRoute ? <AppSidebarPanel {...props} /> : <CardPanel {...props} />}
      </Container>
    </Box>
  );
}
