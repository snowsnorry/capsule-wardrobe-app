import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import type { ComponentProps } from "react";

vi.mock("../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => ({
      "launcher.capsule": "Capsule",
      "launcher.explore": "Explore",
      "launcher.statistics": "Statistics",
      "capsule.new": "New capsule",
      "capsule.search": "Search capsules",
      "capsule.yourCapsules": "Your capsules",
      "capsule.notSaved": "Not saved"
    }[key] || key)
  })
}));

import AppSidebarNavigation from "./AppSidebarNavigation";

const theme = createTheme();

function renderNavigation(props: Partial<ComponentProps<typeof AppSidebarNavigation>> = {}) {
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
    </ThemeProvider>
  );
}

describe("AppSidebarNavigation", () => {
  afterEach(() => {
    cleanup();
  });

  test("keeps the desktop capsule action out of the row width until hover or focus", () => {
    const { container } = renderNavigation();

    const rowAction = screen.getByRole("button", { name: "Capsule actions Modified capsule" });
    const unsavedDot = container.querySelector(".capsule-row-unsaved-dot");

    expect(unsavedDot).toBeVisible();
    expect(rowAction).not.toBeVisible();
    expect(getComputedStyle(rowAction).width).toBe("0px");
  });

  test("shows the capsule name tooltip when hovering a capsule row", async () => {
    const user = userEvent.setup();
    renderNavigation();

    await user.hover(screen.getByRole("button", { name: "Modified capsule" }));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Modified capsule");
  });

  test("keeps the mobile capsule action and unsaved dot visible together", () => {
    const { container } = renderNavigation({ isOverlaySidebar: true });

    const rowAction = screen.getByRole("button", { name: "Capsule actions Modified capsule" });
    const unsavedDot = container.querySelector(".capsule-row-unsaved-dot");

    expect(unsavedDot).toBeVisible();
    expect(rowAction).toBeVisible();
    expect(getComputedStyle(rowAction).width).toBe("32px");
  });

  test("extends the new and search capsule hover area left without moving content", () => {
    renderNavigation();

    const capsuleRow = screen.getByRole("button", { name: "Modified capsule" });

    for (const button of [
      screen.getByRole("button", { name: "New capsule" }),
      screen.getByRole("button", { name: "Search capsules" })
    ]) {
      expect(getComputedStyle(button).marginLeft).toBe("-12px");
      expect(getComputedStyle(button).paddingLeft).toBe("12px");
      expect(getComputedStyle(button).borderRadius).toBe(getComputedStyle(capsuleRow).borderRadius);
    }
  });

  test("uses the default unsaved-change predicate when none is supplied", () => {
    const { container } = renderNavigation({
      capsuleHasUnsavedChanges: undefined
    });

    expect(container.querySelector(".capsule-row-unsaved-dot")).not.toBeInTheDocument();
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
      onExpandedAction
    });

    await user.click(screen.getByRole("button", { name: "Explore" }));
    await user.click(screen.getByRole("button", { name: "New capsule" }));
    await user.click(screen.getByRole("button", { name: "Search capsules" }));
    await user.click(screen.getByRole("button", { name: "Modified capsule" }));
    await user.click(screen.getByRole("button", { name: "Capsule actions Modified capsule" }));

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
      </ThemeProvider>
    );

    expect(screen.getByRole("button", { name: "expand" })).toBeInTheDocument();
  });
});
