import { Suspense, type ReactNode } from "react";
import { Box, Container, Paper, Stack, Typography } from "@mui/material";
import RoutePanelFallback from "./RoutePanelFallback";
import AppSidebarPanel from "./AppShellSidebarPanel";
import { getShellContainerVerticalPadding } from "./AppShellContentLayout";
import { isFullScreenAppShellRoute } from "./AppShellRouteLayout";
import type {
  AppNavigationOptions,
  AppRoute,
  CapsuleMeta,
  CapsulePagination,
  OutfitMeta,
  ProfileSettings,
  UserLike,
} from "./appTypes";
import type { SettingsSavePayload } from "../components/SettingsDialog";

type TranslationFn = (key: string, params?: Record<string, unknown>) => string;

export type AppShellContentProps = {
  activeCapsuleId: string;
  activeCapsuleMeta: CapsuleMeta | null;
  activeOutfitId?: string;
  activeOutfitMeta?: OutfitMeta | null;
  appRoute: AppRoute;
  capsuleRouteId: string;
  outfitRouteId?: string;
  capsuleList: CapsuleMeta[];
  capsulePagination: CapsulePagination;
  outfitList?: OutfitMeta[];
  outfitPagination?: CapsulePagination;
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
  onCreateOutfitFromSidebar?: (onComplete?: () => void) => Promise<void>;
  onDeleteCapsule: (capsuleId?: string) => Promise<void>;
  onDeleteOutfit?: (outfitId?: string) => Promise<void>;
  onDownloadOutfitPdf?: (outfitId?: string) => Promise<void>;
  onDeleteProfile: () => Promise<void>;
  onDownloadWardrobePdf: (capsuleId?: string) => Promise<void>;
  onDuplicateCapsule: (name: string, capsuleId?: string) => Promise<void>;
  onDuplicateOutfit?: (name: string, outfitId?: string) => Promise<void>;
  onNavigateApp: (
    nextApp: Exclude<AppRoute, "share">,
    options?: AppNavigationOptions,
  ) => void;
  onLoadMoreCapsules: () => Promise<void>;
  onLoadMoreOutfits?: () => Promise<void>;
  onOpenCapsuleFromSidebar: (
    capsuleId: string,
    onComplete?: () => void,
  ) => Promise<void>;
  onOpenOutfitFromSidebar?: (
    outfitId: string,
    onComplete?: () => void,
  ) => Promise<void>;
  onRenameCapsule: (name: string, capsuleId?: string) => Promise<void>;
  onRenameOutfit?: (name: string, outfitId?: string) => Promise<void>;
  onRevertCapsule: (capsuleId?: string) => Promise<void>;
  onRevertOutfit?: (outfitId?: string) => Promise<void>;
  onSaveCapsule: (capsuleId?: string) => Promise<void>;
  onSaveOutfit?: (outfitId?: string) => Promise<void>;
  onSearchCapsules: (query: string) => Promise<CapsuleMeta[]> | CapsuleMeta[];
  onSearchOutfits?: (query: string) => Promise<OutfitMeta[]> | OutfitMeta[];
  onShareCapsule: (capsuleId?: string) => Promise<{
    url?: string;
    expiresAt?: string | Date;
    blockedReason?: "personal_uploaded_items";
  } | void>;
  onRequestSignOut: () => void;
  onSaveSettings: (nextSettings: SettingsSavePayload) => Promise<void>;
  openSearchDialog: () => void;
};

function SuspendedContent({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RoutePanelFallback />}>{children}</Suspense>;
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
            fetchPriority="high"
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
