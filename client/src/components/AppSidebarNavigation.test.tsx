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
          "sidebar.catalog": "Catalog",
          "sidebar.explore": "Explore",
          "sidebar.statistics": "Statistics",
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

  test("keeps reserved desktop capsule action space hidden until hover or focus", () => {
    const { container } = renderNavigation();

    const rowAction = screen.getByRole("button", {
      name: "Capsule actions Modified capsule",
    });
    const unsavedDot = container.querySelector(".capsule-row-unsaved-dot");

    expect(unsavedDot).toBeVisible();
    expect(rowAction).not.toBeVisible();
    expect(getComputedStyle(rowAction).width).toBe("32px");
    expect(getComputedStyle(rowAction).pointerEvents).toBe("none");
    expect(getComputedStyle(rowAction).transition).not.toMatch(
      /(?:^|,\s*)(?:width|padding)\b/,
    );
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
    expect(getComputedStyle(rowAction).transition).not.toMatch(
      /(?:^|,\s*)(?:width|padding)\b/,
    );
  });

  test("insets the active capsule highlight without clipping or moving content", () => {
    renderNavigation();

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
    const capsulePrimaryActions = capsuleSectionLabel?.querySelector(
      ".capsule-primary-actions",
    );
    expect(capsulePrimaryActions).not.toBeNull();
    expect(getComputedStyle(capsulePrimaryActions as Element).marginLeft).toBe(
      "auto",
    );
    expect(getComputedStyle(capsuleRow).borderRadius).toBe(
      "var(--cw-radius-card)",
    );
    expect(getComputedStyle(capsuleRow).marginLeft).toBe("0px");
    expect(getComputedStyle(capsuleRow).paddingLeft).toBe("36px");
    expect(getComputedStyle(capsuleRow).paddingRight).toBe("12px");

    for (const button of [
      screen.getByRole("button", { name: "New capsule" }),
      screen.getByRole("button", { name: "Search capsules" }),
    ]) {
      expect(button.querySelector("svg")).not.toBeNull();
      expect(button.textContent).toBe("");
      expect(getComputedStyle(button).width).toBe("32px");
      expect(getComputedStyle(button).height).toBe("32px");
      expect(getComputedStyle(button).borderRadius).toBe(
        "var(--cw-radius-card)",
      );
    }

    const createCapsuleIcon = screen
      .getByRole("button", { name: "New capsule" })
      .querySelector('[data-testid="IoCreateOutline"]');

    expect(createCapsuleIcon).not.toBeNull();
    expect(createCapsuleIcon).toHaveAttribute("height", "20");
    expect(createCapsuleIcon).toHaveAttribute("width", "20");
  });

  test("uses capsule action labels as tooltips", async () => {
    const user = userEvent.setup();
    renderNavigation({
      onCreateCapsule: vi.fn(),
      onSearchCapsules: vi.fn(),
    });

    await user.hover(screen.getByRole("button", { name: "New capsule" }));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("New capsule");
  });

  test("opens the catalog group through explore and renders iconless child rows", async () => {
    const user = userEvent.setup();
    const onNavigateApp = vi.fn();

    const { rerender } = renderNavigation({ onNavigateApp });

    await user.click(screen.getByRole("button", { name: "Catalog" }));

    expect(onNavigateApp).toHaveBeenCalledWith("explore");

    rerender(
      <ThemeProvider theme={theme}>
        <AppSidebarNavigation
          activeApp="explore"
          isOverlaySidebar={false}
          isSidebarCollapsed={false}
          desktopSidebarRailWidth={72}
          capsuleList={[]}
          onNavigateApp={onNavigateApp}
        />
      </ThemeProvider>,
    );

    const catalogChildren = screen.getByTestId("catalog-sidebar-children");
    const exploreChild = screen.getByRole("button", { name: "Explore" });
    const statisticsChild = screen.getByRole("button", { name: "Statistics" });

    expect(catalogChildren).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByRole("button", { name: "Catalog" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(exploreChild).toHaveClass("Mui-selected");
    expect(statisticsChild).not.toHaveClass("Mui-selected");
    expect(exploreChild.querySelector("svg")).toBeNull();
    expect(statisticsChild.querySelector("svg")).toBeNull();
    expect(getComputedStyle(exploreChild).borderRadius).toBe(
      "var(--cw-radius-card)",
    );
    expect(getComputedStyle(exploreChild).minHeight).toBe("40px");
    expect(getComputedStyle(exploreChild).paddingLeft).toBe("36px");
  });

  test("selects statistics inside the expanded catalog group", async () => {
    const user = userEvent.setup();
    const onNavigateApp = vi.fn();

    renderNavigation({
      activeApp: "statistics",
      onNavigateApp,
    });

    const statisticsChild = screen.getByRole("button", { name: "Statistics" });
    const catalogChildren = screen.getByTestId("catalog-sidebar-children");

    expect(catalogChildren).toHaveAttribute("aria-hidden", "false");
    expect(getComputedStyle(catalogChildren).maxHeight).toBe("none");
    expect(screen.getByRole("button", { name: "Catalog" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: "Explore" })).not.toHaveClass(
      "Mui-selected",
    );
    expect(statisticsChild).toHaveClass("Mui-selected");

    await user.click(statisticsChild);

    expect(onNavigateApp).toHaveBeenCalledWith("statistics");
  });

  test("hides catalog children from the collapsed desktop sidebar", () => {
    renderNavigation({
      activeApp: "explore",
      isSidebarCollapsed: true,
    });

    expect(screen.getByRole("button", { name: "Catalog" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByTestId("catalog-sidebar-children")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(
      screen.queryByRole("button", { name: "Explore" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Statistics" }),
    ).not.toBeInTheDocument();
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

  test("keeps the my wardrobe top-level icon at the standard sidebar size", () => {
    renderNavigation({ activeApp: "myWardrobe" });

    const myWardrobeIcon = screen
      .getByRole("button", { name: "My Wardrobe" })
      .querySelector("svg");

    expect(myWardrobeIcon).not.toBeNull();
    expect(getComputedStyle(myWardrobeIcon as Element).width).toBe("24px");
    expect(getComputedStyle(myWardrobeIcon as Element).height).toBe("24px");
  });

  test("uses the default unsaved-change predicate when none is supplied", () => {
    const { container } = renderNavigation({
      capsuleHasUnsavedChanges: undefined,
    });

    expect(
      container.querySelector(".capsule-row-unsaved-dot"),
    ).not.toBeInTheDocument();
  });

  test("omits capsule row actions when no action handler is supplied", () => {
    renderNavigation({ onOpenCapsuleActions: undefined });

    expect(
      screen.queryByRole("button", {
        name: "Capsule actions Modified capsule",
      }),
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

  test("does not animate layout properties in sidebar navigation groups", () => {
    renderNavigation({ activeApp: "explore" });

    for (const element of [
      screen.getByTestId("catalog-sidebar-group"),
      screen.getByTestId("catalog-sidebar-children"),
      screen.getByTestId("capsule-sidebar-children"),
      screen.getByTestId("sidebar-navigation-divider"),
    ]) {
      expect(getComputedStyle(element).transition).not.toMatch(
        /\b(?:width|height|padding|margin|max-height|grid-template-rows)\b/,
      );
    }
  });
});
