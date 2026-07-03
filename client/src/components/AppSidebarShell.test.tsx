import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import type { ComponentProps } from "react";
import { LocaleProvider } from "../i18n/LocaleProvider";

const mediaQueryMock = vi.hoisted(() => vi.fn());

vi.mock("@mui/material/useMediaQuery", () => ({
  default: mediaQueryMock,
}));

import AppSidebarShell from "./AppSidebarShell";

const theme = createTheme();

function setScrollMetrics(
  element: HTMLElement,
  {
    clientHeight,
    scrollHeight,
    scrollTop = 0,
  }: { clientHeight: number; scrollHeight: number; scrollTop?: number },
) {
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    value: clientHeight,
  });
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    value: scrollHeight,
  });
  element.scrollTop = scrollTop;
}

function renderShell(
  props: Partial<ComponentProps<typeof AppSidebarShell>> = {},
  {
    layoutMode = "medium",
  }: { layoutMode?: "overlay" | "medium" | "large" } = {},
) {
  const { children = <div>content</div>, ...shellProps } = props;

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
            llm: "openai:gpt-5.5",
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
          sidebarBodyContent={({
            isSidebarCollapsed,
            isOverlaySidebar,
            desktopSidebarExpandedWidth,
            expandCollapsedSidebar,
          }) =>
            isSidebarCollapsed && !isOverlaySidebar ? (
              <button
                type="button"
                data-testid="shell-expand-hitbox"
                data-expanded-width={desktopSidebarExpandedWidth}
                onClick={expandCollapsedSidebar}
              >
                expand
              </button>
            ) : (
              <div>sidebar-body</div>
            )
          }
          {...shellProps}
        >
          {children}
        </AppSidebarShell>
      </LocaleProvider>
    </ThemeProvider>,
  );
}

describe("AppSidebarShell", () => {
  beforeEach(() => {
    mediaQueryMock.mockReset();
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("renders overlay, medium desktop, and large desktop modes", () => {
    renderShell({}, { layoutMode: "overlay" });
    expect(screen.getByTestId("app-sidebar-shell")).toHaveAttribute(
      "data-sidebar-mode",
      "overlay",
    );
    expect(screen.getByTestId("app-sidebar-shell")).toHaveAttribute(
      "data-content-alignment",
      "overlay",
    );

    cleanup();
    renderShell({}, { layoutMode: "medium" });
    expect(screen.getByTestId("app-sidebar-shell")).toHaveAttribute(
      "data-sidebar-mode",
      "desktop-medium",
    );
    expect(screen.getByTestId("app-sidebar-shell")).toHaveAttribute(
      "data-content-alignment",
      "centered",
    );

    cleanup();
    renderShell({}, { layoutMode: "large" });
    expect(screen.getByTestId("app-sidebar-shell")).toHaveAttribute(
      "data-sidebar-mode",
      "desktop-large",
    );
    expect(screen.getByTestId("app-sidebar-shell")).toHaveAttribute(
      "data-content-alignment",
      "centered",
    );
  });

  test("opens overlay sidebar, supports collapsing, and opens user settings menu", async () => {
    const user = userEvent.setup();
    const onSignOut = vi.fn();

    renderShell({ onSignOut }, { layoutMode: "overlay" });

    await user.click(screen.getByRole("button", { name: "open-sidebar" }));
    expect(
      screen.getByRole("button", { name: "Collapse sidebar" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Collapse sidebar" }),
      ).not.toBeInTheDocument();
    });
  });

  test("opens user menu, settings dialog, and sign out action on desktop", async () => {
    const user = userEvent.setup();
    const onSignOut = vi.fn();

    renderShell({ onSignOut });

    expect(screen.getByText("Capsule Wardrobe")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Toggle sidebar" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(screen.queryByText("Capsule Wardrobe")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Toggle sidebar" }),
    ).toBeInTheDocument();

    await user.click(screen.getByTestId("shell-expand-hitbox"));
    expect(screen.getByText("Capsule Wardrobe")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Collapse sidebar" }),
    ).toBeInTheDocument();

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

  test("keeps the selected settings section across unrelated shell rerenders", async () => {
    const user = userEvent.setup();
    const settingsProfile = {
      fullname: "Person Example",
      email: "person@example.com",
      locale: "en",
      theme: "system",
      llm: "openai:gpt-5.5",
      imageLlm: "openai:gpt-image-2",
    };
    const renderUi = (contentLabel: string) => (
      <ThemeProvider theme={theme}>
        <LocaleProvider>
          <AppSidebarShell
            shellTestId="app-sidebar-shell"
            currentApp="explore"
            userEmail="person@example.com"
            userName="Person Example"
            settingsProfile={{ ...settingsProfile }}
            onSaveSettings={vi.fn(() => Promise.resolve())}
            sidebarBodyContent={() => <div>sidebar-body</div>}
          >
            <div>{contentLabel}</div>
          </AppSidebarShell>
        </LocaleProvider>
      </ThemeProvider>
    );

    const view = render(renderUi("content one"));

    await user.click(screen.getByRole("button", { name: "Open user menu" }));
    await user.click(screen.getByText("Settings"));
    const settingsDialog = await screen.findByRole("dialog", {
      name: "Settings",
    });
    await user.click(
      within(settingsDialog).getByRole("button", { name: "Account" }),
    );
    expect(
      within(settingsDialog).getByRole("button", { name: "Remove account" }),
    ).toBeInTheDocument();

    view.rerender(renderUi("content two"));

    const rerenderedDialog = screen.getByRole("dialog", { name: "Settings" });
    expect(
      within(rerenderedDialog).getByRole("button", {
        name: "Remove account",
      }),
    ).toBeInTheDocument();
    expect(within(rerenderedDialog).getByLabelText("Name")).toHaveValue(
      "Person Example",
    );
  });

  test("localizes shell-only accessibility labels in Russian", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("locale", "ru");

    renderShell();

    expect(
      screen.getByRole("button", { name: "Свернуть боковую панель" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Открыть меню пользователя" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Свернуть боковую панель" }),
    );

    expect(
      screen.getByRole("button", { name: "Переключить боковую панель" }),
    ).toBeInTheDocument();
  });

  test("keeps desktop collapsed state consistent across remounts", async () => {
    const user = userEvent.setup();

    const initial = renderShell();
    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(window.localStorage.getItem("capsule.appSidebarCollapsed")).toBe(
      "true",
    );

    initial.unmount();
    renderShell();
    expect(
      screen.queryByRole("button", { name: "Collapse sidebar" }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("shell-expand-hitbox")).toBeInTheDocument();

    await user.click(screen.getByTestId("shell-expand-hitbox"));
    expect(window.localStorage.getItem("capsule.appSidebarCollapsed")).toBe(
      "false",
    );
    expect(
      screen.getByRole("button", { name: "Collapse sidebar" }),
    ).toBeInTheDocument();
  });

  test("keeps sidebar usable when collapsed state storage is unavailable", async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation((key) => {
      if (key === "capsule.appSidebarCollapsed") {
        throw new Error("storage blocked");
      }
      return null;
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key) => {
      if (key === "capsule.appSidebarCollapsed") {
        throw new Error("storage blocked");
      }
    });

    renderShell();

    expect(
      screen.getByRole("button", { name: "Collapse sidebar" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(screen.getByTestId("shell-expand-hitbox")).toBeInTheDocument();
  });

  test("uses transform and clipping for desktop sidebar motion", async () => {
    const user = userEvent.setup();

    renderShell();

    const shell = screen.getByTestId("app-sidebar-shell");
    const motionFrame = screen.getByTestId("app-sidebar-shell-motion-frame");
    const sidebarSurface = screen.getByTestId("app-sidebar-surface");

    expect(shell).toHaveAttribute("data-sidebar-mode", "desktop-medium");
    expect(getComputedStyle(motionFrame).transition).not.toContain(
      "padding-left",
    );
    expect(getComputedStyle(sidebarSurface).transition).not.toContain("width");
    expect(getComputedStyle(sidebarSurface).transition).toContain("clip-path");

    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    expect(screen.getByTestId("shell-expand-hitbox")).toHaveAttribute(
      "data-expanded-width",
      "296",
    );
    expect(getComputedStyle(motionFrame).transition).not.toContain(
      "padding-left",
    );
    expect(getComputedStyle(sidebarSurface).transition).not.toContain("width");
    expect(document.head.textContent).toContain("prefers-reduced-motion");
  });

  test("delegates desktop sidebar wheel to the primary route scroll target", () => {
    renderShell({
      children: (
        <div data-app-primary-scroll-target="true">primary content</div>
      ),
    });
    const scrollTarget = screen.getByText("primary content");
    setScrollMetrics(scrollTarget, { clientHeight: 100, scrollHeight: 500 });

    const wheelEvent = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: 80,
    });

    screen.getByText("sidebar-body").dispatchEvent(wheelEvent);

    expect(scrollTarget.scrollTop).toBe(80);
    expect(wheelEvent.defaultPrevented).toBe(true);
  });

  test("keeps wheel inside a scrollable desktop sidebar region", () => {
    renderShell({
      children: (
        <div data-app-primary-scroll-target="true">primary content</div>
      ),
      sidebarBodyContent: () => (
        <div data-testid="sidebar-scroll-region" style={{ overflowY: "auto" }}>
          <button type="button">sidebar item</button>
        </div>
      ),
    });
    const scrollTarget = screen.getByText("primary content");
    const sidebarScrollRegion = screen.getByTestId("sidebar-scroll-region");
    setScrollMetrics(scrollTarget, { clientHeight: 100, scrollHeight: 500 });
    setScrollMetrics(sidebarScrollRegion, {
      clientHeight: 100,
      scrollHeight: 500,
    });

    fireEvent.wheel(screen.getByRole("button", { name: "sidebar item" }), {
      deltaY: 80,
    });

    expect(scrollTarget.scrollTop).toBe(0);
  });
});
