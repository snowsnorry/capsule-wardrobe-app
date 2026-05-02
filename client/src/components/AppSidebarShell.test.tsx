import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import type { ComponentProps } from "react";
import { LocaleProvider } from "../i18n/LocaleProvider";

const mediaQueryMock = vi.hoisted(() => vi.fn());

vi.mock("@mui/material/useMediaQuery", () => ({
  default: mediaQueryMock
}));

import AppSidebarShell from "./AppSidebarShell";

const theme = createTheme();

function renderShell(
  props: Partial<ComponentProps<typeof AppSidebarShell>> = {},
  { layoutMode = "medium" }: { layoutMode?: "overlay" | "medium" | "large" } = {}
) {
  mediaQueryMock.mockImplementation((query) => {
    if (String(query).includes("max-width: 1279.95px")) {
      return layoutMode === "overlay";
    }
    if (String(query).includes("min-width: 1680px")) {
      return layoutMode === "large";
    }
    return false;
  });

  return render(
    <ThemeProvider theme={theme}>
      <LocaleProvider>
        <AppSidebarShell
          shellTestId="app-sidebar-shell"
          currentApp="explore"
          userEmail="person@example.com"
          userName="Person Example"
          settingsProfile={{
            fullname: "Person Example",
            email: "person@example.com",
            locale: "en",
            theme: "system",
            llm: "openai:gpt-5.5"
          }}
          onSaveSettings={vi.fn(() => Promise.resolve())}
          onSignOut={vi.fn()}
          headerContent={({ isOverlaySidebar, openSidebar }) => (
            <div>
              {isOverlaySidebar ? (
                <button type="button" onClick={openSidebar}>
                  open-sidebar
                </button>
              ) : null}
              header
            </div>
          )}
          sidebarBodyContent={({ isSidebarCollapsed, isOverlaySidebar, expandCollapsedSidebar }) => (
            isSidebarCollapsed && !isOverlaySidebar ? (
              <button type="button" data-testid="shell-expand-hitbox" onClick={expandCollapsedSidebar}>
                expand
              </button>
            ) : (
              <div>sidebar-body</div>
            )
          )}
          {...props}
        >
          <div>content</div>
        </AppSidebarShell>
      </LocaleProvider>
    </ThemeProvider>
  );
}

describe("AppSidebarShell", () => {
  beforeEach(() => {
    mediaQueryMock.mockReset();
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  test("renders overlay, medium desktop, and large desktop modes", () => {
    renderShell({}, { layoutMode: "overlay" });
    expect(screen.getByTestId("app-sidebar-shell")).toHaveAttribute("data-sidebar-mode", "overlay");
    expect(screen.getByTestId("app-sidebar-shell")).toHaveAttribute("data-content-alignment", "overlay");

    cleanup();
    renderShell({}, { layoutMode: "medium" });
    expect(screen.getByTestId("app-sidebar-shell")).toHaveAttribute("data-sidebar-mode", "desktop-medium");
    expect(screen.getByTestId("app-sidebar-shell")).toHaveAttribute("data-content-alignment", "centered");

    cleanup();
    renderShell({}, { layoutMode: "large" });
    expect(screen.getByTestId("app-sidebar-shell")).toHaveAttribute("data-sidebar-mode", "desktop-large");
    expect(screen.getByTestId("app-sidebar-shell")).toHaveAttribute("data-content-alignment", "centered");
  });

  test("opens overlay sidebar, supports collapsing, and opens user settings menu", async () => {
    const user = userEvent.setup();
    const onSignOut = vi.fn();

    renderShell({ onSignOut }, { layoutMode: "overlay" });

    await user.click(screen.getByRole("button", { name: "open-sidebar" }));
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Collapse sidebar" })).not.toBeInTheDocument();
    });
  });

  test("opens user menu, settings dialog, and sign out action on desktop", async () => {
    const user = userEvent.setup();
    const onSignOut = vi.fn();

    renderShell({ onSignOut });

    expect(screen.getByText("Capsule Wardrobe")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Toggle sidebar" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(screen.queryByText("Capsule Wardrobe")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle sidebar" })).toBeInTheDocument();

    await user.click(screen.getByTestId("shell-expand-hitbox"));
    expect(screen.getByText("Capsule Wardrobe")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open user menu" }));
    await user.click(screen.getByText("Settings"));
    expect(await screen.findByText("Settings")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Open user menu" }));
    await user.click(screen.getByText("Sign out"));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  test("keeps desktop collapsed state consistent across remounts", async () => {
    const user = userEvent.setup();

    const initial = renderShell();
    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(window.localStorage.getItem("capsule.appSidebarCollapsed")).toBe("true");

    initial.unmount();
    renderShell();
    expect(screen.queryByRole("button", { name: "Collapse sidebar" })).not.toBeInTheDocument();
    expect(screen.getByTestId("shell-expand-hitbox")).toBeInTheDocument();

    await user.click(screen.getByTestId("shell-expand-hitbox"));
    expect(window.localStorage.getItem("capsule.appSidebarCollapsed")).toBe("false");
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
  });
});
