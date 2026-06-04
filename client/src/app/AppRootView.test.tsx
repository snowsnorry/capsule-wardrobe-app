import { Suspense, type ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createTheme } from "@mui/material/styles";
import AppRootView from "./AppRootView";
import { createTestProfile, testStatus } from "./testUtils";

vi.mock("./AppShellContent", () => ({
  default: ({ children }: { children: ReactNode }) => (
    <div data-testid="shell">{children}</div>
  ),
}));

vi.mock("./AppDialogs", () => ({
  default: () => <div data-testid="dialogs">dialogs</div>,
}));

vi.mock("./AppSnackbars", () => ({
  default: () => <div data-testid="snackbars">snackbars</div>,
}));

function createRootProps() {
  return {
    dialogs: {
      isShareDialogOpen: false,
      isShareLoading: false,
      shareMetadata: null,
      isSignOutConfirmOpen: false,
      status: testStatus,
      t: (key: string) => key,
      onClearShareRoute: vi.fn(),
      onImportSharedCapsule: vi.fn(),
      onCloseSignOutConfirm: vi.fn(),
      onLogout: vi.fn(),
    },
    routeContent: <div data-testid="route">route</div>,
    shell: {
      activeCapsuleId: "",
      activeCapsuleMeta: null,
      appRoute: "capsule",
      capsuleList: [],
      capsulePagination: { limit: 10, offset: 0, total: 0, hasMore: false },
      cardPadding: 3,
      currentView: "main",
      hasBrandedPanelHeader: false,
      isContentBusy: false,
      isLarge: true,
      isMainScreenView: true,
      isWardrobeView: false,
      isSearchView: false,
      isSignInView: false,
      isStatisticsView: false,
      sessionInitialized: true,
      settingsProfile: createTestProfile(),
      t: (key: string) => key,
      user: { email: "person@example.com" },
      onCreateCapsuleFromSidebar: vi.fn(),
      onDeleteProfile: vi.fn(),
      onLoadMoreCapsules: vi.fn(),
      onNavigateApp: vi.fn(),
      onOpenCapsuleFromSidebar: vi.fn(),
      onRequestSignOut: vi.fn(),
      onSaveSettings: vi.fn(),
      openCapsuleActions: vi.fn(),
      openSearchDialog: vi.fn(),
    },
    snackbars: {
      notificationOpen: false,
      passkeyPrompt: { open: false, loading: false },
      status: testStatus,
      t: (key: string) => key,
      onAddPasskey: vi.fn(),
      onClearError: vi.fn(),
      onDismissPasskey: vi.fn(),
      onRequestNotificationPermission: vi.fn(),
    },
    theme: createTheme(),
  };
}

describe("AppRootView", () => {
  afterEach(cleanup);

  test("renders route content and lazy overlays only when needed", async () => {
    const { rerender } = render(
      <Suspense fallback={null}>
        <AppRootView
          {...(createRootProps() as unknown as Parameters<
            typeof AppRootView
          >[0])}
        />
      </Suspense>,
    );

    expect(screen.getByTestId("route")).toBeInTheDocument();
    expect(screen.queryByTestId("dialogs")).not.toBeInTheDocument();
    expect(screen.queryByTestId("snackbars")).not.toBeInTheDocument();

    const visibleOverlayProps = createRootProps();
    visibleOverlayProps.dialogs.isSignOutConfirmOpen = true;
    visibleOverlayProps.snackbars.status = { ...testStatus, error: "failed" };

    rerender(
      <Suspense fallback={null}>
        <AppRootView
          {...(visibleOverlayProps as unknown as Parameters<
            typeof AppRootView
          >[0])}
        />
      </Suspense>,
    );

    expect(await screen.findByTestId("dialogs")).toBeInTheDocument();
    expect(await screen.findByTestId("snackbars")).toBeInTheDocument();
  });
});
