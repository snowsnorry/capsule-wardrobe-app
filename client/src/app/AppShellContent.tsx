import { memo, Suspense, type ReactNode } from "react";
import { Box, Container, Paper, Stack, Typography } from "@mui/material";
import RoutePanelFallback from "./RoutePanelFallback";
import AppSidebarPanel from "./AppShellSidebarPanel";
import { getShellContainerVerticalPadding } from "./AppShellContentLayout";
import { isFullScreenAppShellRoute } from "./AppShellRouteLayout";
import type { AppShellContentProps } from "./AppShellContentTypes";

export type { AppShellContentProps } from "./AppShellContentTypes";

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

function AppShellContent(props: AppShellContentProps) {
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

export default memo(AppShellContent);
