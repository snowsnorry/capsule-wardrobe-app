import { afterEach, describe, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import type { ComponentProps } from "react";

vi.mock("../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const value =
        {
          "launcher.capsule": "Capsules",
          "launcher.wardrobe": "Personal items",
          "sidebar.catalog": "Catalog",
          "sidebar.explore": "Explore",
          "sidebar.outfits": "Outfits",
          "sidebar.showMore": "Show {count} more",
          "sidebar.statistics": "Statistics",
          "wardrobe.searchOutfits": "Search outfits",
          "wardrobe.newOutfit": "New outfit",
          "capsule.new": "New capsule",
          "capsule.pin": "Pin capsule",
          "capsule.search": "Search capsules",
          "capsule.unpin": "Unpin capsule",
          "capsule.notSaved": "Not saved",
          "capsule.openCapsuleActions": "Capsule actions {name}",
          "outfit.pin": "Pin outfit",
          "outfit.unpin": "Unpin outfit",
        }[key] || key;
      return value.replace(/\{(\w+)\}/g, (_match, token: string) =>
        String(params?.[token] ?? `{${token}}`),
      );
    },
  }),
}));

import AppSidebarNavigation from "./AppSidebarNavigation";

const theme = createTheme();

function createCapsules(count: number) {
  return Array.from({ length: count }, (_item, index) => {
    const number = index + 1;
    return {
      id: `capsule-${number}`,
      name: `Capsule ${number}`,
      updatedAt: `2026-06-${String(30 - index).padStart(2, "0")}T00:00:00.000Z`,
      status: number === 1 ? "modified" : "saved",
    };
  });
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
        personalItemsCount={6}
        capsuleList={createCapsules(10)}
        capsulePagination={{
          limit: 10,
          offset: 0,
          total: 15,
          hasMore: true,
        }}
        activeCapsuleId="capsule-1"
        activeCapsule={createCapsules(1)[0]}
        onNavigateApp={vi.fn()}
        onLoadMoreCapsules={vi.fn()}
        onCreateCapsule={vi.fn()}
        onSearchCapsules={vi.fn()}
        onOpenCapsule={vi.fn()}
        onOpenCapsuleActions={vi.fn()}
        capsuleHasUnsavedChanges={(capsule) => capsule.status === "modified"}
        {...props}
      />
    </ThemeProvider>,
  );
}

function setElementSize(
  element: Element,
  size: { clientWidth: number; scrollWidth: number },
) {
  Object.defineProperties(element, {
    clientWidth: { configurable: true, value: size.clientWidth },
    scrollWidth: { configurable: true, value: size.scrollWidth },
  });
}

describe("AppSidebarNavigation", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the flat two-level navigation with section disclosure headers", () => {
    renderNavigation();
    const navigationList = screen.getByTestId("sidebar-navigation-list");
    const topLevelLabels = ["Personal items", "Outfits", "Capsules", "Catalog"];

    for (const label of topLevelLabels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(
      screen.getByRole("button", { name: "Personal items, 6" }),
    ).not.toHaveAttribute("aria-expanded");
    expect(screen.getByRole("button", { name: "Outfits" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: "Capsules" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: "Catalog" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Personal items, 6" }),
    ).not.toHaveClass("sidebar-top-level-quiet-hover");
    for (const label of ["Outfits", "Capsules", "Catalog"]) {
      expect(screen.getByRole("button", { name: label })).toHaveClass(
        "sidebar-top-level-quiet-hover",
      );
    }
    expect(screen.getByRole("button", { name: "Explore" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Statistics" }),
    ).toBeInTheDocument();
    expect(
      navigationList.querySelector(
        '[data-testid="KeyboardArrowDownRoundedIcon"]',
      ),
    ).toBeNull();

    const navigationText = navigationList.textContent || "";
    expect(navigationText.indexOf("Personal items")).toBeLessThan(
      navigationText.indexOf("Outfits"),
    );
    expect(navigationText.indexOf("Outfits")).toBeLessThan(
      navigationText.indexOf("Capsules"),
    );
    expect(navigationText.indexOf("Capsules")).toBeLessThan(
      navigationText.indexOf("Catalog"),
    );
  });

  test("aligns iconless second-level labels on the top-level label axis", () => {
    renderNavigation();

    const topLevelIconRail =
      screen.getByText("Capsules").previousElementSibling;
    const exploreRow = screen.getByRole("button", { name: "Explore" });
    const capsuleRow = screen.getByRole("button", { name: "Capsule 1" });
    const showMoreRow = screen.getByRole("button", { name: "Show 5 more" });

    expect(topLevelIconRail).not.toBeNull();
    expect(getComputedStyle(topLevelIconRail as Element).width).toBe("40px");
    expect(getComputedStyle(exploreRow).marginLeft).toBe("0px");
    expect(getComputedStyle(exploreRow).paddingLeft).toBe("40px");
    expect(getComputedStyle(capsuleRow).marginLeft).toBe("0px");
    expect(getComputedStyle(capsuleRow).paddingLeft).toBe("40px");
    expect(getComputedStyle(showMoreRow).marginLeft).toBe("0px");
    expect(getComputedStyle(showMoreRow).paddingLeft).toBe("40px");
    expect(exploreRow.querySelector("svg")).toBeNull();
    expect(capsuleRow.querySelector(".MuiListItemText-root")).toHaveTextContent(
      "Capsule 1",
    );
  });

  test("sorts pinned capsule rows above unpinned rows inside their group", () => {
    renderNavigation({
      activeCapsuleId: "capsule-pinned-new",
      activeCapsule: {
        id: "capsule-pinned-new",
        name: "Pinned new",
        pin: true,
        updatedAt: "2026-06-03T00:00:00.000Z",
        status: "saved",
      },
      capsuleList: [
        {
          id: "capsule-unpinned",
          name: "Unpinned latest",
          pin: false,
          updatedAt: "2026-06-04T00:00:00.000Z",
          status: "saved",
        },
        {
          id: "capsule-pinned-old",
          name: "Pinned old",
          pin: true,
          updatedAt: "2026-06-01T00:00:00.000Z",
          status: "saved",
        },
        {
          id: "capsule-pinned-new",
          name: "Pinned new",
          pin: true,
          updatedAt: "2026-06-03T00:00:00.000Z",
          status: "saved",
        },
      ],
      capsulePagination: {
        limit: 10,
        offset: 0,
        total: 3,
        hasMore: false,
      },
    });

    const navigationText =
      screen.getByTestId("sidebar-navigation-list").textContent || "";
    expect(navigationText.indexOf("Pinned new")).toBeLessThan(
      navigationText.indexOf("Pinned old"),
    );
    expect(navigationText.indexOf("Pinned old")).toBeLessThan(
      navigationText.indexOf("Unpinned latest"),
    );
  });

  test("pins capsule rows without triggering row open", () => {
    const onOpenCapsule = vi.fn();
    const onSetCapsulePin = vi.fn();
    renderNavigation({ onOpenCapsule, onSetCapsulePin });

    fireEvent.click(screen.getAllByRole("button", { name: "Pin capsule" })[0]);

    expect(onSetCapsulePin).toHaveBeenCalledWith("capsule-1", true);
    expect(onOpenCapsule).not.toHaveBeenCalled();

    cleanup();
    renderNavigation({
      capsuleList: [{ ...createCapsules(1)[0], pin: true }],
      activeCapsule: { ...createCapsules(1)[0], pin: true },
      onOpenCapsule,
      onSetCapsulePin,
    });

    fireEvent.click(screen.getByRole("button", { name: "Unpin capsule" }));

    expect(onSetCapsulePin).toHaveBeenLastCalledWith("capsule-1", false);
    expect(onOpenCapsule).not.toHaveBeenCalled();
  });

  test("shows capsule name tooltip only from the label, not the pin control", async () => {
    renderNavigation({ onSetCapsulePin: vi.fn() });

    fireEvent.mouseOver(
      screen.getAllByRole("button", { name: "Pin capsule" })[0],
    );

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Pin capsule");
    expect(screen.getAllByText("Capsule 1")).toHaveLength(1);
  });

  test("shows capsule name tooltip only when the label is truncated", async () => {
    renderNavigation();

    const label = screen.getByText("Capsule 1");

    setElementSize(label, { clientWidth: 120, scrollWidth: 120 });
    fireEvent.mouseEnter(label);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    setElementSize(label, { clientWidth: 64, scrollWidth: 160 });
    fireEvent.mouseEnter(label);

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Capsule 1");

    fireEvent.mouseLeave(label);

    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });
  });

  test("keeps capsule unsaved dot and hover menu mutually exclusive", () => {
    renderNavigation();

    const capsuleRow = screen.getByRole("button", { name: "Capsule 1" });
    const unsavedDot = capsuleRow.querySelector(".capsule-row-unsaved-dot");
    const actionsSlot = capsuleRow.querySelector(".capsule-row-actions-slot");
    const textRoot = capsuleRow.querySelector(".MuiListItemText-root");
    const injectedStyles = document.head.innerHTML;

    expect(unsavedDot).not.toBeNull();
    expect(actionsSlot).not.toBeNull();
    expect(textRoot).not.toBeNull();
    expect(getComputedStyle(textRoot as Element).paddingRight).toBe("0px");
    expect(getComputedStyle(unsavedDot as Element).opacity).toBe("1");
    expect(getComputedStyle(actionsSlot as Element).opacity).toBe("0");
    expect(injectedStyles).toContain(":hover .capsule-row-unsaved-dot");
    expect(injectedStyles).toContain(
      ":focus-within .capsule-row-unsaved-dot{opacity:0;width:0;margin-right:0px;}",
    );
    expect(injectedStyles).toContain(":hover .capsule-row-text");
    expect(injectedStyles).toContain(
      ":focus-within .capsule-row-text{padding-right:32px;}",
    );
    expect(injectedStyles).toContain(":hover .capsule-row-actions-slot");
    expect(injectedStyles).toContain(
      ":focus-within .capsule-row-actions-slot{opacity:1;width:32px;",
    );
    expect(injectedStyles).toContain("pointer-events:auto;}");
  });

  test("keeps outfit actions visible and enabled", () => {
    renderNavigation();

    expect(
      screen.getByRole("button", { name: "Search outfits" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "New outfit" })).toBeEnabled();
  });

  test("shows disclosure indicators on expandable top-level icons", async () => {
    const user = userEvent.setup();
    renderNavigation();

    const personalItemsHeader = screen.getByRole("button", {
      name: "Personal items, 6",
    });
    const outfitsHeader = screen.getByRole("button", { name: "Outfits" });
    const capsulesHeader = screen.getByRole("button", { name: "Capsules" });
    const catalogHeader = screen.getByRole("button", { name: "Catalog" });

    expect(
      personalItemsHeader.querySelector(".sidebar-top-level-disclosure-badge"),
    ).toBeNull();
    for (const header of [outfitsHeader, capsulesHeader, catalogHeader]) {
      expect(
        header.querySelector(".sidebar-top-level-disclosure-badge"),
      ).toHaveAttribute("data-disclosure-state", "expanded");
      expect(
        header.querySelector(".sidebar-top-level-collapsed-indicator"),
      ).toBeNull();
    }

    await user.click(capsulesHeader);

    expect(capsulesHeader).toHaveAttribute("aria-expanded", "false");
    expect(
      capsulesHeader.querySelector(".sidebar-top-level-disclosure-badge"),
    ).toHaveAttribute("data-disclosure-state", "collapsed");
    expect(
      capsulesHeader.querySelector(".sidebar-top-level-collapsed-indicator"),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "New capsule" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Search capsules" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Capsule 1" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Show 5 more" }),
    ).not.toBeInTheDocument();

    await user.click(capsulesHeader);

    expect(capsulesHeader).toHaveAttribute("aria-expanded", "true");
    expect(
      capsulesHeader.querySelector(".sidebar-top-level-disclosure-badge"),
    ).toHaveAttribute("data-disclosure-state", "expanded");
    expect(screen.getByRole("button", { name: "New capsule" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Capsule 1" })).toBeVisible();

    await user.click(catalogHeader);

    expect(catalogHeader).toHaveAttribute("aria-expanded", "false");
    expect(
      catalogHeader.querySelector(".sidebar-top-level-disclosure-badge"),
    ).toHaveAttribute("data-disclosure-state", "collapsed");
    expect(
      catalogHeader.querySelector(".sidebar-top-level-collapsed-indicator"),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Explore" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Statistics" }),
    ).not.toBeInTheDocument();

    await user.click(catalogHeader);

    expect(catalogHeader).toHaveAttribute("aria-expanded", "true");
    expect(
      catalogHeader.querySelector(".sidebar-top-level-disclosure-badge"),
    ).toHaveAttribute("data-disclosure-state", "expanded");
    expect(screen.getByRole("button", { name: "Explore" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Statistics" })).toBeVisible();

    await user.click(outfitsHeader);

    expect(outfitsHeader).toHaveAttribute("aria-expanded", "false");
    expect(
      outfitsHeader.querySelector(".sidebar-top-level-disclosure-badge"),
    ).toHaveAttribute("data-disclosure-state", "collapsed");
    expect(
      outfitsHeader.querySelector(".sidebar-top-level-collapsed-indicator"),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Search outfits" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "New outfit" }),
    ).not.toBeInTheDocument();

    await user.click(outfitsHeader);

    expect(outfitsHeader).toHaveAttribute("aria-expanded", "true");
    expect(
      outfitsHeader.querySelector(".sidebar-top-level-disclosure-badge"),
    ).toHaveAttribute("data-disclosure-state", "expanded");
    expect(
      screen.getByRole("button", { name: "Search outfits" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "New outfit" })).toBeEnabled();
  });

  test("shows personal item count and gives the active row the second-level selected background", () => {
    renderNavigation({
      activeApp: "wardrobe",
      personalItemsCount: 248,
    });

    const personalItemsRow = screen.getByRole("button", {
      name: "Personal items, 248",
    });
    const countBadge = personalItemsRow.querySelector(
      ".sidebar-top-level-count-badge",
    );
    const activeCapsuleRow = screen.getByRole("button", { name: "Capsule 1" });

    expect(countBadge).not.toBeNull();
    expect(countBadge).toHaveTextContent("248");
    expect(getComputedStyle(personalItemsRow).backgroundColor).toBe(
      getComputedStyle(activeCapsuleRow).backgroundColor,
    );
    expect(
      getComputedStyle(screen.getByText("Personal items")).marginRight,
    ).toBe("8px");
    expect(getComputedStyle(countBadge as Element).marginRight).toBe("6px");
    expect(getComputedStyle(countBadge as Element).backgroundColor).toBe(
      "rgba(25, 118, 210, 0.14)",
    );
    expect(getComputedStyle(countBadge as Element).color).toBe(
      "rgb(25, 118, 210)",
    );
  });

  test("aligns top-level new action with the capsule row menu position", () => {
    renderNavigation();

    const newCapsuleButton = screen.getByRole("button", {
      name: "New capsule",
    });
    const topLevelActions = newCapsuleButton.closest(
      ".sidebar-top-level-actions",
    );

    expect(topLevelActions).not.toBeNull();
    expect(getComputedStyle(topLevelActions as Element).marginRight).toBe(
      "0px",
    );
    expect(getComputedStyle(newCapsuleButton).width).toBe("32px");
  });

  test("keeps capsule search action above the disclosure row and does not collapse on action click", async () => {
    const user = userEvent.setup();
    const onSearchCapsules = vi.fn();
    renderNavigation({ onSearchCapsules });

    const capsulesHeader = screen.getByRole("button", { name: "Capsules" });
    const searchButton = screen.getByRole("button", {
      name: "Search capsules",
    });
    const topLevelActions = searchButton.closest(".sidebar-top-level-actions");

    expect(topLevelActions).not.toBeNull();
    expect(getComputedStyle(topLevelActions as Element).position).toBe(
      "relative",
    );
    expect(getComputedStyle(topLevelActions as Element).zIndex).toBe("1");

    await user.click(searchButton);

    expect(onSearchCapsules).toHaveBeenCalledTimes(1);
    expect(capsulesHeader).toHaveAttribute("aria-expanded", "true");
  });

  test("wires personal items, catalog, capsule actions, and capsule rows", async () => {
    const user = userEvent.setup();
    const onNavigateApp = vi.fn();
    const onCreateCapsule = vi.fn();
    const onSearchCapsules = vi.fn();
    const onOpenCapsule = vi.fn();
    const onOpenCapsuleActions = vi.fn();
    renderNavigation({
      onNavigateApp,
      onCreateCapsule,
      onSearchCapsules,
      onOpenCapsule,
      onOpenCapsuleActions,
    });

    await user.click(screen.getByRole("button", { name: "Personal items, 6" }));
    await user.click(screen.getByRole("button", { name: "Explore" }));
    await user.click(screen.getByRole("button", { name: "Statistics" }));
    await user.click(screen.getByRole("button", { name: "New capsule" }));
    await user.click(screen.getByRole("button", { name: "Search capsules" }));
    await user.click(screen.getByRole("button", { name: "Capsule 1" }));
    await user.click(
      screen.getByRole("button", { name: "Capsule actions Capsule 1" }),
    );

    expect(onNavigateApp).toHaveBeenCalledWith("wardrobe");
    expect(onNavigateApp).toHaveBeenCalledWith("explore");
    expect(onNavigateApp).toHaveBeenCalledWith("statistics");
    expect(onCreateCapsule).toHaveBeenCalled();
    expect(onSearchCapsules).toHaveBeenCalled();
    expect(onOpenCapsule).toHaveBeenCalledWith("capsule-1");
    expect(onOpenCapsuleActions).toHaveBeenCalled();
  });

  test("loads more capsule rows and hides show more when all loaded rows are visible", async () => {
    const user = userEvent.setup();
    const onLoadMoreCapsules = vi.fn();
    const { rerender } = renderNavigation({ onLoadMoreCapsules });

    expect(screen.getByRole("button", { name: "Show 5 more" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Capsule 11" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show 5 more" }));

    expect(onLoadMoreCapsules).toHaveBeenCalled();

    rerender(
      <ThemeProvider theme={theme}>
        <AppSidebarNavigation
          activeApp="capsule"
          isOverlaySidebar={false}
          isSidebarCollapsed={false}
          desktopSidebarRailWidth={72}
          personalItemsCount={6}
          capsuleList={createCapsules(15)}
          capsulePagination={{
            limit: 10,
            offset: 10,
            total: 15,
            hasMore: false,
          }}
          activeCapsuleId="capsule-1"
          activeCapsule={createCapsules(1)[0]}
          onNavigateApp={vi.fn()}
          onOpenCapsuleActions={vi.fn()}
        />
      </ThemeProvider>,
    );

    expect(screen.getByRole("button", { name: "Capsule 11" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Show \d+ more/ }),
    ).not.toBeInTheDocument();
  });

  test("appends an active capsule outside the loaded range until its page is visible", () => {
    const activeCapsule = {
      id: "capsule-15",
      name: "Capsule 15",
      updatedAt: "2026-05-01T00:00:00.000Z",
      status: "saved",
    };
    const { rerender } = renderNavigation({
      activeCapsuleId: "capsule-15",
      activeCapsule,
    });

    expect(screen.getByTestId("sidebar-active-capsule-divider")).toBeVisible();
    expect(screen.getByRole("button", { name: "Capsule 15" })).toHaveClass(
      "Mui-selected",
    );
    expect(screen.getByRole("button", { name: "Show 4 more" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Show 5 more" }),
    ).not.toBeInTheDocument();

    rerender(
      <ThemeProvider theme={theme}>
        <AppSidebarNavigation
          activeApp="capsule"
          isOverlaySidebar={false}
          isSidebarCollapsed={false}
          desktopSidebarRailWidth={72}
          personalItemsCount={6}
          capsuleList={createCapsules(15)}
          capsulePagination={{
            limit: 10,
            offset: 10,
            total: 15,
            hasMore: false,
          }}
          activeCapsuleId="capsule-15"
          activeCapsule={activeCapsule}
          onNavigateApp={vi.fn()}
          onOpenCapsuleActions={vi.fn()}
        />
      </ThemeProvider>,
    );

    expect(
      screen.queryByTestId("sidebar-active-capsule-divider"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Capsule 15" })).toHaveClass(
      "Mui-selected",
    );
  });

  test("recalculates show more when the displayed capsule row count changes", () => {
    const activeCapsule = {
      id: "capsule-15",
      name: "Capsule 15",
      updatedAt: "2026-05-01T00:00:00.000Z",
      status: "saved",
    };
    const { rerender } = renderNavigation({
      activeCapsuleId: "capsule-15",
      activeCapsule,
    });

    expect(screen.getByRole("button", { name: "Show 4 more" })).toBeVisible();

    rerender(
      <ThemeProvider theme={theme}>
        <AppSidebarNavigation
          activeApp="capsule"
          isOverlaySidebar={false}
          isSidebarCollapsed={false}
          desktopSidebarRailWidth={72}
          personalItemsCount={6}
          capsuleList={createCapsules(11)}
          capsulePagination={{
            limit: 10,
            offset: 0,
            total: 15,
            hasMore: true,
          }}
          activeCapsuleId="capsule-15"
          activeCapsule={activeCapsule}
          onNavigateApp={vi.fn()}
          onLoadMoreCapsules={vi.fn()}
          onOpenCapsuleActions={vi.fn()}
        />
      </ThemeProvider>,
    );

    expect(screen.getByRole("button", { name: "Show 3 more" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Show 4 more" }),
    ).not.toBeInTheDocument();
  });

  test("collapsed desktop keeps only the top-level rail and expand hitbox", () => {
    renderNavigation({
      activeApp: "explore",
      isSidebarCollapsed: true,
      collapsedExpandHitbox: <button type="button">expand</button>,
    });

    expect(screen.getByText("Catalog")).not.toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Explore" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Search capsules" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "expand" })).toBeInTheDocument();
  });
});
