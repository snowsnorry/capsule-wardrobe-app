import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import type { ComponentProps } from "react";

vi.mock("../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const value =
        {
          "launcher.capsule": "Capsule",
          "launcher.explore": "Catalog",
          "launcher.myWardrobe": "My Wardrobe",
          "launcher.statistics": "Statistics",
          "capsule.new": "New capsule",
          "capsule.search": "Search capsules",
          "capsule.yourCapsules": "Your capsules",
          "capsule.notSaved": "Not saved",
          "capsule.openCapsuleActions": "Capsule actions {name}",
        }[key] || key;
      return value.replace(/\{(\w+)\}/g, (_match, token: string) =>
        String(params?.[token] ?? `{${token}}`),
      );
    },
  }),
}));

import AppSidebarNavigation from "./AppSidebarNavigation";

const theme = createTheme();

function getTranslateX(transform: string): number {
  const match = transform.match(/translateX\((-?\d+(?:\.\d+)?)px\)/);
  return match ? Number(match[1]) : 0;
}

function renderNavigation(
  props: Partial<ComponentProps<typeof AppSidebarNavigation>> = {},
) {
  return render(
    <ThemeProvider theme={theme}>
      <AppSidebarNavigation
        activeApp="capsule"
        isOverlaySidebar={false}
        isSidebarCollapsed={false}
        desktopSidebarRailWidth={72}
        capsuleList={[{ id: "capsule-1", name: "Modified capsule" }]}
        activeCapsuleId="capsule-1"
        onNavigateApp={vi.fn()}
        onOpenCapsuleActions={vi.fn()}
        capsuleHasUnsavedChanges={() => true}
        {...props}
      />
    </ThemeProvider>,
  );
}

describe("AppSidebarNavigation", () => {
  afterEach(() => {
    cleanup();
  });

  test("keeps the desktop capsule action out of the row width until hover or focus", () => {
    const { container } = renderNavigation();

    const rowAction = screen.getByRole("button", {
      name: "Capsule actions Modified capsule",
    });
    const unsavedDot = container.querySelector(".capsule-row-unsaved-dot");

    expect(unsavedDot).toBeVisible();
    expect(rowAction).not.toBeVisible();
    expect(getComputedStyle(rowAction).width).toBe("0px");
  });

  test("shows the capsule name tooltip when hovering a capsule row", async () => {
    const user = userEvent.setup();
    renderNavigation();

    await user.hover(screen.getByRole("button", { name: "Modified capsule" }));

    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Modified capsule",
    );
  });

  test("keeps the mobile capsule action and unsaved dot visible together", () => {
    const { container } = renderNavigation({ isOverlaySidebar: true });

    const rowAction = screen.getByRole("button", {
      name: "Capsule actions Modified capsule",
    });
    const unsavedDot = container.querySelector(".capsule-row-unsaved-dot");

    expect(unsavedDot).toBeVisible();
    expect(rowAction).toBeVisible();
    expect(getComputedStyle(rowAction).width).toBe("32px");
  });

  test("insets the active capsule highlight without clipping or moving content", () => {
    renderNavigation();

    const topLevelCapsule = screen.getByRole("button", { name: "Capsule" });
    const capsuleRow = screen.getByRole("button", { name: "Modified capsule" });
    const capsuleChildren = screen.getByTestId("capsule-sidebar-children");
    const capsuleContent = capsuleChildren.firstElementChild;
    const capsuleSectionLabel = screen.getByText("Your capsules").parentElement;

    expect(capsuleContent).not.toBeNull();
    expect(getComputedStyle(capsuleContent as Element).paddingLeft).toBe(
      "12px",
    );
    expect(capsuleSectionLabel).not.toBeNull();
    expect(getComputedStyle(capsuleSectionLabel as Element).paddingLeft).toBe(
      "10px",
    );
    expect(getComputedStyle(capsuleRow).borderRadius).toBe("8px");
    expect(getComputedStyle(capsuleRow).marginLeft).toBe("0px");
    expect(getComputedStyle(capsuleRow).paddingLeft).toBe("36px");
    expect(getComputedStyle(capsuleRow).paddingRight).toBe("12px");

    for (const button of [
      screen.getByRole("button", { name: "New capsule" }),
      screen.getByRole("button", { name: "Search capsules" }),
    ]) {
      const iconRail = button.querySelector(".capsule-primary-action-icon");

      expect(iconRail).not.toBeNull();
      expect(getComputedStyle(button).width).toBe("100%");
      expect(getComputedStyle(button).marginLeft).toBe("0px");
      expect(getComputedStyle(button).paddingLeft).toBe("0px");
      expect(getComputedStyle(button).borderRadius).toBe(
        getComputedStyle(topLevelCapsule).borderRadius,
      );
      expect(getComputedStyle(iconRail as Element).width).toBe("60px");
      expect(getComputedStyle(iconRail as Element).transform).toBe(
        "translateX(-6px)",
      );
    }
  });

  test("aligns expanded top-level icon centers with the collapsed rail", () => {
    const desktopSidebarRailWidth = 72;
    const expandedSidebarPadding = 12;
    const { rerender } = renderNavigation({
      desktopSidebarRailWidth,
      activeApp: "explore",
    });

    const expandedExploreIconRail = screen.getByRole("button", {
      name: "Catalog",
    }).firstElementChild;

    expect(expandedExploreIconRail).not.toBeNull();
    const expandedStyle = getComputedStyle(expandedExploreIconRail as Element);
    const expandedIconCenter =
      expandedSidebarPadding +
      Number.parseFloat(expandedStyle.width) / 2 +
      getTranslateX(expandedStyle.transform);

    rerender(
      <ThemeProvider theme={theme}>
        <AppSidebarNavigation
          activeApp="explore"
          isOverlaySidebar={false}
          isSidebarCollapsed
          desktopSidebarRailWidth={desktopSidebarRailWidth}
          capsuleList={[]}
          onNavigateApp={vi.fn()}
        />
      </ThemeProvider>,
    );

    const collapsedExploreIconRail = screen.getByRole("button", {
      name: "Catalog",
    }).firstElementChild;

    expect(collapsedExploreIconRail).not.toBeNull();
    const collapsedStyle = getComputedStyle(
      collapsedExploreIconRail as Element,
    );
    const collapsedIconCenter =
      Number.parseFloat(collapsedStyle.width) / 2 +
      getTranslateX(collapsedStyle.transform);

    expect(expandedIconCenter).toBe(collapsedIconCenter);
    expect(collapsedIconCenter).toBe(desktopSidebarRailWidth / 2);
  });

  test("uses the default unsaved-change predicate when none is supplied", () => {
    const { container } = renderNavigation({
      capsuleHasUnsavedChanges: undefined,
    });

    expect(
      container.querySelector(".capsule-row-unsaved-dot"),
    ).not.toBeInTheDocument();
  });

  test("wires navigation and capsule callbacks in expanded and collapsed modes", async () => {
    const user = userEvent.setup();
    const onNavigateApp = vi.fn();
    const onCreateCapsule = vi.fn();
    const onSearchCapsules = vi.fn();
    const onOpenCapsule = vi.fn();
    const onOpenCapsuleActions = vi.fn();
    const onExpandedAction = vi.fn();

    const { rerender } = renderNavigation({
      onNavigateApp,
      onCreateCapsule,
      onSearchCapsules,
      onOpenCapsule,
      onOpenCapsuleActions,
      onExpandedAction,
    });

    await user.click(screen.getByRole("button", { name: "My Wardrobe" }));
    await user.click(screen.getByRole("button", { name: "Catalog" }));
    await user.click(screen.getByRole("button", { name: "New capsule" }));
    await user.click(screen.getByRole("button", { name: "Search capsules" }));
    await user.click(screen.getByRole("button", { name: "Modified capsule" }));
    await user.click(
      screen.getByRole("button", { name: "Capsule actions Modified capsule" }),
    );

    expect(onNavigateApp).toHaveBeenCalledWith("myWardrobe");
    expect(onNavigateApp).toHaveBeenCalledWith("explore");
    expect(onExpandedAction).toHaveBeenCalled();
    expect(onCreateCapsule).toHaveBeenCalled();
    expect(onSearchCapsules).toHaveBeenCalled();
    expect(onOpenCapsule).toHaveBeenCalledWith("capsule-1");
    expect(onOpenCapsuleActions).toHaveBeenCalled();

    rerender(
      <ThemeProvider theme={theme}>
        <AppSidebarNavigation
          activeApp="explore"
          isOverlaySidebar={false}
          isSidebarCollapsed
          desktopSidebarRailWidth={72}
          capsuleList={[]}
          onNavigateApp={onNavigateApp}
          collapsedExpandHitbox={<button type="button">expand</button>}
        />
      </ThemeProvider>,
    );

    expect(screen.getByRole("button", { name: "expand" })).toBeInTheDocument();
  });
});
