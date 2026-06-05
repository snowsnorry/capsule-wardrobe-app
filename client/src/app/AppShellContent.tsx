import { Suspense, useCallback, useRef, type ReactNode } from "react";
import { Box, Container, Paper, Stack, Typography } from "@mui/material";
import AppShellCapsuleActionMenu from "./AppShellCapsuleActionMenu";
import AppShellSidebarNavigationBody from "./AppShellSidebarNavigationBody";
import AppSidebarShell from "../components/AppSidebarShell";
import RoutePanelFallback from "./RoutePanelFallback";
import AppShellMobileHeader from "./AppShellMobileHeader";
import { SearchDialog } from "../screens/mainScreen/MainScreenUtilityDialogs";
import { getShellContainerVerticalPadding } from "./AppShellContentLayout";
import {
  getSidebarShellTestId,
  isFullScreenAppShellRoute,
} from "./AppShellRouteLayout";
import { getActiveSidebarApp } from "./appRouting";
import { usePersonalItemsCount } from "./personalItemsCount";
import { useSidebarCapsuleSearch } from "./useSidebarCapsuleSearch";
import type { AppShellCapsuleActionMenuController } from "./AppShellCapsuleActionMenu";
import type {
  AppNavigationOptions,
  AppRoute,
  CapsuleMeta,
  CapsulePagination,
  ProfileSettings,
  UserLike,
} from "./appTypes";
import type { SettingsSavePayload } from "../components/SettingsDialog";

type TranslationFn = (key: string, params?: Record<string, unknown>) => string;

type AppShellContentProps = {
  activeCapsuleId: string;
  activeCapsuleMeta: CapsuleMeta | null;
  appRoute: AppRoute;
  capsuleRouteId: string;
  capsuleList: CapsuleMeta[];
  capsulePagination: CapsulePagination;
  cardPadding: number;
  children: ReactNode;
  currentView: string;
  hasBrandedPanelHeader: boolean;
  isContentBusy: boolean;
  isLarge: boolean;
  isMainScreenView: boolean;
  isWardrobeView: boolean;
  isSearchView: boolean;
  isSignInView: boolean;
  isStatisticsView: boolean;
  sessionInitialized: boolean;
  settingsProfile: ProfileSettings;
  t: TranslationFn;
  user: UserLike | null;
  onCreateCapsuleFromSidebar: (onComplete?: () => void) => Promise<void>;
  onDeleteCapsule: (capsuleId?: string) => Promise<void>;
  onDeleteProfile: () => Promise<void>;
  onDownloadWardrobePdf: (capsuleId?: string) => Promise<void>;
  onDuplicateCapsule: (name: string, capsuleId?: string) => Promise<void>;
  onNavigateApp: (
    nextApp: Exclude<AppRoute, "share">,
    options?: AppNavigationOptions,
  ) => void;
  onLoadMoreCapsules: () => Promise<void>;
  onOpenCapsuleFromSidebar: (
    capsuleId: string,
    onComplete?: () => void,
  ) => Promise<void>;
  onRenameCapsule: (name: string, capsuleId?: string) => Promise<void>;
  onRevertCapsule: (capsuleId?: string) => Promise<void>;
  onSaveCapsule: (capsuleId?: string) => Promise<void>;
  onSearchCapsules: (query: string) => Promise<CapsuleMeta[]> | CapsuleMeta[];
  onShareCapsule: (capsuleId?: string) => Promise<{
    url?: string;
    expiresAt?: string | Date;
    blockedReason?: "personal_uploaded_items";
  } | void>;
  onRequestSignOut: () => void;
  onSaveSettings: (nextSettings: SettingsSavePayload) => Promise<void>;
  openSearchDialog: () => void;
};

function getUserEmail(user: UserLike | null) {
  return user?.email || "";
}

function SuspendedContent({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RoutePanelFallback />}>{children}</Suspense>;
}

function getHighlightedCapsuleId(
  activeSidebarApp: ReturnType<typeof getActiveSidebarApp>,
  props: AppShellContentProps,
) {
  return activeSidebarApp === "capsule" &&
    props.capsuleRouteId &&
    props.capsuleRouteId === props.activeCapsuleMeta?.id
    ? props.capsuleRouteId
    : "";
}

function MarketingPanel({
  isLarge,
  t,
}: Pick<AppShellContentProps, "isLarge" | "t">) {
  return (
    <Stack
      spacing={{ xs: 1.9, md: 2.2 }}
      sx={{ display: { xs: "none", md: "flex" }, pr: { md: 4 } }}
    >
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
            background: "var(--cw-gradient-marketing-image-fade)",
          },
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
              mixBlendMode: "multiply",
            }}
          />
        </Box>
      </Box>
      <Typography
        variant={isLarge ? "h2" : "h3"}
        sx={{
          mt: { xs: 0.15, md: 0.1 },
          maxWidth: { xs: "14ch", md: "20ch" },
          fontWeight: 700,
        }}
      >
        {t("marketingHeadline")}
      </Typography>
    </Stack>
  );
}

function AppSidebarPanel(props: AppShellContentProps) {
  const activeSidebarApp = getActiveSidebarApp(props.appRoute);
  const userEmail = getUserEmail(props.user);
  const personalItemsCount = usePersonalItemsCount(userEmail);
  const usesCapsuleLayout = isFullScreenAppShellRoute(props);
  const sidebarSearch = useSidebarCapsuleSearch(props.onSearchCapsules);
  const capsuleActionMenuControllerRef =
    useRef<AppShellCapsuleActionMenuController | null>(null);
  const registerCapsuleActionMenuController = useCallback(
    (controller: AppShellCapsuleActionMenuController) => {
      capsuleActionMenuControllerRef.current = controller;
    },
    [],
  );
  const highlightedCapsuleId = getHighlightedCapsuleId(activeSidebarApp, props);

  return (
    <AppSidebarShell
      shellTestId={getSidebarShellTestId(props)}
      currentApp={activeSidebarApp}
      contentSurface="plain"
      contentAlignment={usesCapsuleLayout ? "start" : "center"}
      desktopContentGap={usesCapsuleLayout ? 32 : undefined}
      desktopContentEndGap={usesCapsuleLayout ? 0 : undefined}
      contentWidth={usesCapsuleLayout ? "fill" : "bounded"}
      userEmail={userEmail}
      userName={props.settingsProfile.fullname}
      settingsProfile={props.settingsProfile}
      onRemoveAccount={props.onDeleteProfile}
      onSaveSettings={props.onSaveSettings}
      onSignOut={props.onRequestSignOut}
      headerContent={({ isOverlaySidebar, openSidebar }) =>
        isOverlaySidebar ? (
          <AppShellMobileHeader {...props} openSidebar={openSidebar} />
        ) : null
      }
      sidebarBodyContent={({
        isOverlaySidebar,
        isSidebarCollapsed,
        desktopSidebarRailWidth,
        expandCollapsedSidebar,
        closeSidebar,
      }) => (
        <AppShellSidebarNavigationBody
          activeCapsuleMeta={props.activeCapsuleMeta}
          activeSidebarApp={activeSidebarApp}
          capsuleActionMenuControllerRef={capsuleActionMenuControllerRef}
          capsuleList={props.capsuleList}
          capsulePagination={props.capsulePagination}
          closeSidebar={closeSidebar}
          desktopSidebarRailWidth={desktopSidebarRailWidth}
          expandCollapsedSidebar={expandCollapsedSidebar}
          highlightedCapsuleId={highlightedCapsuleId}
          isContentBusy={props.isContentBusy}
          isOverlaySidebar={isOverlaySidebar}
          isSidebarCollapsed={isSidebarCollapsed}
          onCreateCapsuleFromSidebar={props.onCreateCapsuleFromSidebar}
          onLoadMoreCapsules={props.onLoadMoreCapsules}
          onNavigateApp={props.onNavigateApp}
          onOpenCapsuleFromSidebar={props.onOpenCapsuleFromSidebar}
          onSearchCapsules={sidebarSearch.open}
          personalItemsCount={personalItemsCount}
        />
      )}
    >
      <SuspendedContent>{props.children}</SuspendedContent>
      <AppShellCapsuleActionMenu
        activeCapsuleMeta={props.activeCapsuleMeta}
        disabled={props.isContentBusy}
        isOverlay={!props.isLarge}
        onDeleteCapsule={props.onDeleteCapsule}
        onDownloadWardrobePdf={props.onDownloadWardrobePdf}
        onDuplicateCapsule={props.onDuplicateCapsule}
        onRegisterController={registerCapsuleActionMenuController}
        onRenameCapsule={props.onRenameCapsule}
        onRevertCapsule={props.onRevertCapsule}
        onSaveCapsule={props.onSaveCapsule}
        onShareCapsule={props.onShareCapsule}
      />
      <SearchDialog
        state={sidebarSearch.state}
        disabled={props.isContentBusy}
        isOverlay={!props.isLarge}
        setState={sidebarSearch.setState}
        onOpenCapsule={(capsuleId) => props.onOpenCapsuleFromSidebar(capsuleId)}
      />
    </AppSidebarShell>
  );
}

function CardPanel(
  props: Pick<
    AppShellContentProps,
    "cardPadding" | "children" | "hasBrandedPanelHeader" | "isSignInView"
  >,
) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: props.cardPadding,
        pt: props.hasBrandedPanelHeader ? { xs: 3, md: 3.25 } : undefined,
        minHeight: 0,
        height: props.isSignInView ? { xs: "100%", md: "532px" } : "100%",
        borderRadius: { xs: 0, md: "var(--cw-radius-detail)" },
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          height: "100%",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-y",
        }}
      >
        <SuspendedContent>{props.children}</SuspendedContent>
      </Box>
    </Paper>
  );
}

export default function AppShellContent(props: AppShellContentProps) {
  const isFullScreenRoute = isFullScreenAppShellRoute(props);
  const verticalPadding = getShellContainerVerticalPadding({
    isFullScreenRoute,
    isMainScreenView: props.isMainScreenView,
    isWardrobeView: props.isWardrobeView,
    isSearchView: props.isSearchView,
    isStatisticsView: props.isStatisticsView,
  });

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
        "&::after": { display: "none" },
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
          gridTemplateColumns: props.user
            ? "1fr"
            : { xs: "1fr", md: "1.2fr 1fr" },
          alignItems: "center",
          ...verticalPadding,
          px: isFullScreenRoute ? 0 : { xs: 0, md: 3 },
          maxWidth: isFullScreenRoute ? "none" : undefined,
          minHeight: "100vh",
          height: "100%",
          boxSizing: "border-box",
        }}
      >
        {!props.sessionInitialized ? null : !props.user ? (
          <MarketingPanel isLarge={props.isLarge} t={props.t} />
        ) : null}
        {!props.sessionInitialized ? null : isFullScreenRoute ? (
          <AppSidebarPanel {...props} />
        ) : (
          <CardPanel {...props} />
        )}
      </Container>
    </Box>
  );
}
