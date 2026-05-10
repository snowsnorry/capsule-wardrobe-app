import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";

vi.mock("../components/AppSidebarShell", () => ({
  default: ({
    children,
    contentAlignment,
    contentWidth,
    desktopContentEndGap,
    desktopContentGap,
  }: {
    children?: ReactNode;
    contentAlignment?: string;
    contentWidth?: string;
    desktopContentEndGap?: number;
    desktopContentGap?: number;
  }) => (
    <div
      data-testid="app-sidebar-shell"
      data-content-alignment={contentAlignment}
      data-content-width={contentWidth}
      data-desktop-content-end-gap={desktopContentEndGap}
      data-desktop-content-gap={desktopContentGap}
    >
      {children}
    </div>
  ),
}));

import AppShellContent from "./AppShellContent";

type AppShellContentProps = ComponentProps<typeof AppShellContent>;

const theme = createTheme();

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
    t: (key: string) => key,
    user: { email: "person@example.com" },
    onCreateCapsuleFromSidebar: vi.fn(() => Promise.resolve()),
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
    expect(screen.getByText("route content")).toBeInTheDocument();
  });
});
