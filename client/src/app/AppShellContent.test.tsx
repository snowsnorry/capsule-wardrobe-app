import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { createAppTheme } from "../theme";

vi.mock("../components/AppSidebarNavigation", () => ({
  default: ({
    capsuleHasUnsavedChanges,
    onCreateCapsule,
    onOpenCapsule,
  }: {
    capsuleHasUnsavedChanges: (capsule: { status?: string }) => boolean;
    onCreateCapsule: () => void;
    onOpenCapsule: (capsuleId: string) => void;
  }) => (
    <div>
      <button type="button" onClick={onCreateCapsule}>
        create capsule
      </button>
      <button type="button" onClick={() => onOpenCapsule("capsule-2")}>
        open capsule
      </button>
      <span data-testid="unsaved-capsule">
        {String(capsuleHasUnsavedChanges({ status: "modified" }))}
      </span>
      <span data-testid="saved-capsule">
        {String(capsuleHasUnsavedChanges({ status: "saved" }))}
      </span>
    </div>
  ),
}));

vi.mock("../components/AppSidebarShell", () => ({
  default: ({
    children,
    contentAlignment,
    contentWidth,
    desktopContentEndGap,
    desktopContentGap,
    headerContent,
    shellTestId,
    sidebarBodyContent,
  }: {
    children?: ReactNode;
    contentAlignment?: string;
    contentWidth?: string;
    desktopContentEndGap?: number;
    desktopContentGap?: number;
    headerContent?: (input: {
      isOverlaySidebar: boolean;
      openSidebar: () => void;
    }) => ReactNode;
    shellTestId?: string;
    sidebarBodyContent?: (input: {
      closeSidebar: () => void;
      desktopSidebarRailWidth: number;
      expandCollapsedSidebar: () => void;
      isOverlaySidebar: boolean;
      isSidebarCollapsed: boolean;
    }) => ReactNode;
  }) => (
    <div
      data-testid="app-sidebar-shell"
      data-content-alignment={contentAlignment}
      data-content-width={contentWidth}
      data-desktop-content-end-gap={desktopContentEndGap}
      data-desktop-content-gap={desktopContentGap}
      data-shell-test-id={shellTestId}
    >
      {headerContent?.({ isOverlaySidebar: false, openSidebar: vi.fn() })}
      {headerContent?.({ isOverlaySidebar: true, openSidebar: vi.fn() })}
      {sidebarBodyContent?.({
        closeSidebar: vi.fn(),
        desktopSidebarRailWidth: 64,
        expandCollapsedSidebar: vi.fn(),
        isOverlaySidebar: true,
        isSidebarCollapsed: false,
      })}
      {children}
    </div>
  ),
}));

import AppShellContent from "./AppShellContent";

type AppShellContentProps = ComponentProps<typeof AppShellContent>;

const theme = createAppTheme("light");

afterEach(() => {
  cleanup();
});

function createProps(
  overrides: Partial<AppShellContentProps> = {},
): AppShellContentProps {
  return {
    activeCapsuleId: "capsule-1",
    activeCapsuleMeta: { id: "capsule-1", name: "Spring", status: "saved" },
    appRoute: "explore",
    capsuleList: [],
    cardPadding: 3,
    children: <div>route content</div>,
    currentView: "main",
    hasBrandedPanelHeader: false,
    isContentBusy: false,
    isLarge: false,
    isMainScreenView: false,
    isWardrobeView: false,
    isSearchView: true,
    isSignInView: false,
    isStatisticsView: false,
    sessionInitialized: true,
    settingsProfile: {
      fullname: "Person Example",
      email: "person@example.com",
      locale: "en",
      theme: "system",
      llm: "openai:gpt-5.5",
      imageLlm: "openai:gpt-image-2",
    },
    t: (key: string) =>
      ({
        "wardrobe.title": "Wardrobe",
        "search.title": "Catalog: Explore",
        "statistics.title": "Catalog: Statistics",
        "appShell.toggleSidebar": "Toggle sidebar",
      })[key] ?? key,
    user: { email: "person@example.com" },
    onCreateCapsuleFromSidebar: vi.fn(() => Promise.resolve()),
    onDeleteProfile: vi.fn(() => Promise.resolve()),
    onNavigateApp: vi.fn(),
    onOpenCapsuleFromSidebar: vi.fn(() => Promise.resolve()),
    onRequestSignOut: vi.fn(),
    onSaveSettings: vi.fn(() => Promise.resolve()),
    openCapsuleActions: vi.fn(),
    openSearchDialog: vi.fn(),
    ...overrides,
  };
}

function renderShellContent(props: Partial<AppShellContentProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <AppShellContent {...createProps(props)} />
    </ThemeProvider>,
  );
}

describe("AppShellContent", () => {
  test("uses capsule-like fill layout for the search route", () => {
    renderShellContent();

    const shell = screen.getByTestId("app-sidebar-shell");
    expect(shell).toHaveAttribute("data-content-alignment", "start");
    expect(shell).toHaveAttribute("data-content-width", "fill");
    expect(shell).toHaveAttribute("data-desktop-content-gap", "32");
    expect(shell).toHaveAttribute("data-desktop-content-end-gap", "0");
    expect(shell).toHaveAttribute("data-shell-test-id", "search-screen-shell");
    expect(screen.getByText("Catalog: Explore")).toBeInTheDocument();
    expect(screen.getByTestId("app-shell-mobile-header")).toHaveStyle({
      backgroundColor: "rgb(255, 253, 249)",
    });
    expect(screen.getByText("route content")).toBeInTheDocument();
  });

  test("uses capsule-like fill layout for the statistics route", () => {
    renderShellContent({
      appRoute: "statistics",
      isSearchView: false,
      isStatisticsView: true,
    });

    const shell = screen.getByTestId("app-sidebar-shell");
    expect(shell).toHaveAttribute("data-content-alignment", "start");
    expect(shell).toHaveAttribute("data-content-width", "fill");
    expect(shell).toHaveAttribute("data-desktop-content-gap", "32");
    expect(shell).toHaveAttribute("data-desktop-content-end-gap", "0");
    expect(shell).toHaveAttribute(
      "data-shell-test-id",
      "statistics-screen-shell",
    );
    expect(screen.getByText("Catalog: Statistics")).toBeInTheDocument();
    expect(screen.getByText("route content")).toBeInTheDocument();
  });

  test("uses capsule-like fill layout for the wardrobe route", () => {
    renderShellContent({
      appRoute: "wardrobe",
      isWardrobeView: true,
      isSearchView: false,
    });

    const shell = screen.getByTestId("app-sidebar-shell");
    expect(shell).toHaveAttribute("data-content-alignment", "start");
    expect(shell).toHaveAttribute("data-content-width", "fill");
    expect(shell).toHaveAttribute("data-desktop-content-gap", "32");
    expect(shell).toHaveAttribute("data-desktop-content-end-gap", "0");
    expect(shell).toHaveAttribute(
      "data-shell-test-id",
      "wardrobe-screen-shell",
    );
    expect(screen.getByText("Wardrobe")).toBeInTheDocument();
  });

  test("wires sidebar capsule header and capsule navigation actions", () => {
    const onCreateCapsuleFromSidebar = vi.fn(() => Promise.resolve());
    const onOpenCapsuleFromSidebar = vi.fn(() => Promise.resolve());
    renderShellContent({
      appRoute: "capsule",
      activeCapsuleMeta: {
        id: "capsule-1",
        name: "Travel",
        status: "modified",
      },
      isContentBusy: true,
      isMainScreenView: true,
      isSearchView: false,
      onCreateCapsuleFromSidebar,
      onOpenCapsuleFromSidebar,
    });

    expect(
      screen.getByRole("button", { name: "Toggle sidebar" }),
    ).toBeDisabled();
    expect(screen.getByText("Travel")).toBeInTheDocument();
    expect(screen.getByTestId("unsaved-capsule")).toHaveTextContent("true");
    expect(screen.getByTestId("saved-capsule")).toHaveTextContent("false");

    fireEvent.click(screen.getByRole("button", { name: "create capsule" }));
    fireEvent.click(screen.getByRole("button", { name: "open capsule" }));

    expect(onCreateCapsuleFromSidebar).toHaveBeenCalledTimes(1);
    expect(onOpenCapsuleFromSidebar).toHaveBeenCalledWith(
      "capsule-2",
      expect.any(Function),
    );
  });
});
