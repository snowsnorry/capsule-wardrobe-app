import { createRef } from "react";
import type { MouseEvent, ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import AppShellSidebarNavigationBody from "./AppShellSidebarNavigationBody";
import type { AppShellCapsuleActionMenuController } from "./AppShellCapsuleActionMenu";
import type { AppShellOutfitActionMenuController } from "./AppShellOutfitActionMenu";

vi.mock("../components/AppSidebarNavigation", () => ({
  default: ({
    capsuleHasUnsavedChanges,
    collapsedExpandHitbox,
    onCreateCapsule,
    onCreateOutfit,
    onExpandedAction,
    onOpenCapsule,
    onOpenCapsuleActions,
    onOpenOutfit,
    onOpenOutfitActions,
    outfitHasUnsavedChanges,
  }: {
    capsuleHasUnsavedChanges: (capsule: { status?: string }) => boolean;
    collapsedExpandHitbox: ReactNode;
    onCreateCapsule: () => void;
    onCreateOutfit: () => void;
    onExpandedAction?: () => void;
    onOpenCapsule: (capsuleId: string) => void;
    onOpenCapsuleActions: (
      event: MouseEvent<HTMLElement>,
      capsule: { id: string; status: string },
    ) => void;
    onOpenOutfit: (outfitId: string) => void;
    onOpenOutfitActions: (
      event: MouseEvent<HTMLElement>,
      outfit: { id: string; status: string },
    ) => void;
    outfitHasUnsavedChanges: (outfit: { status?: string }) => boolean;
  }) => (
    <div>
      <button type="button" onClick={onCreateCapsule}>
        create capsule
      </button>
      <button type="button" onClick={onCreateOutfit}>
        create outfit
      </button>
      <button type="button" onClick={() => onOpenCapsule("capsule-1")}>
        open capsule
      </button>
      <button type="button" onClick={() => onOpenOutfit("outfit-1")}>
        open outfit
      </button>
      <button
        type="button"
        onClick={(event) =>
          onOpenCapsuleActions(event, { id: "capsule-1", status: "modified" })
        }
      >
        capsule actions
      </button>
      <button
        type="button"
        onClick={(event) =>
          onOpenOutfitActions(event, { id: "outfit-1", status: "new" })
        }
      >
        outfit actions
      </button>
      <button type="button" onClick={onExpandedAction}>
        expanded action
      </button>
      <span data-testid="capsule-new">
        {String(capsuleHasUnsavedChanges({ status: "new" }))}
      </span>
      <span data-testid="capsule-saved">
        {String(capsuleHasUnsavedChanges({ status: "saved" }))}
      </span>
      <span data-testid="outfit-modified">
        {String(outfitHasUnsavedChanges({ status: "modified" }))}
      </span>
      {collapsedExpandHitbox}
    </div>
  ),
}));

function createProps(overrides = {}) {
  const capsuleActionMenuControllerRef =
    createRef<AppShellCapsuleActionMenuController | null>();
  const outfitActionMenuControllerRef =
    createRef<AppShellOutfitActionMenuController | null>();
  capsuleActionMenuControllerRef.current = { openCapsuleActions: vi.fn() };
  outfitActionMenuControllerRef.current = { openOutfitActions: vi.fn() };

  return {
    activeCapsuleMeta: null,
    activeOutfitMeta: null,
    activeSidebarApp: "capsule" as const,
    capsuleActionMenuControllerRef,
    outfitActionMenuControllerRef,
    capsuleList: [],
    capsulePagination: { limit: 10, offset: 0, total: 0, hasMore: false },
    outfitList: [],
    outfitPagination: { limit: 10, offset: 0, total: 0, hasMore: false },
    closeSidebar: vi.fn(),
    desktopSidebarRailWidth: 64,
    expandCollapsedSidebar: vi.fn(),
    highlightedCapsuleId: "",
    highlightedOutfitId: "",
    isContentBusy: false,
    isOverlaySidebar: true,
    isSidebarCollapsed: false,
    onCreateCapsuleFromSidebar: vi.fn(async () => undefined),
    onCreateOutfitFromSidebar: vi.fn(async () => undefined),
    onLoadMoreCapsules: vi.fn(async () => undefined),
    onLoadMoreOutfits: vi.fn(async () => undefined),
    onNavigateApp: vi.fn(),
    onOpenCapsuleFromSidebar: vi.fn(async () => undefined),
    onOpenOutfitFromSidebar: vi.fn(async () => undefined),
    onSearchCapsules: vi.fn(),
    onSearchOutfits: vi.fn(),
    onSetCapsulePin: vi.fn(async () => undefined),
    onSetOutfitPin: vi.fn(async () => undefined),
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("AppShellSidebarNavigationBody", () => {
  test("wires overlay navigation callbacks and action menu controllers", () => {
    const props = createProps();
    render(<AppShellSidebarNavigationBody {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "create capsule" }));
    fireEvent.click(screen.getByRole("button", { name: "create outfit" }));
    fireEvent.click(screen.getByRole("button", { name: "open capsule" }));
    fireEvent.click(screen.getByRole("button", { name: "open outfit" }));
    fireEvent.click(screen.getByRole("button", { name: "capsule actions" }));
    fireEvent.click(screen.getByRole("button", { name: "outfit actions" }));
    fireEvent.click(screen.getByRole("button", { name: "expanded action" }));
    fireEvent.click(screen.getByTestId("collapsed-sidebar-expand-hitbox"));

    expect(props.onCreateCapsuleFromSidebar).toHaveBeenCalledWith(
      props.closeSidebar,
    );
    expect(props.onCreateOutfitFromSidebar).toHaveBeenCalledWith(
      props.closeSidebar,
    );
    expect(props.onOpenCapsuleFromSidebar).toHaveBeenCalledWith(
      "capsule-1",
      props.closeSidebar,
    );
    expect(props.onOpenOutfitFromSidebar).toHaveBeenCalledWith(
      "outfit-1",
      props.closeSidebar,
    );
    expect(
      props.capsuleActionMenuControllerRef.current?.openCapsuleActions,
    ).toHaveBeenCalledWith(expect.any(Object), {
      id: "capsule-1",
      status: "modified",
    });
    expect(
      props.outfitActionMenuControllerRef.current?.openOutfitActions,
    ).toHaveBeenCalledWith(expect.any(Object), {
      id: "outfit-1",
      status: "new",
    });
    expect(props.closeSidebar).toHaveBeenCalledTimes(1);
    expect(props.expandCollapsedSidebar).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("capsule-new")).toHaveTextContent("true");
    expect(screen.getByTestId("capsule-saved")).toHaveTextContent("false");
    expect(screen.getByTestId("outfit-modified")).toHaveTextContent("true");
  });

  test("does not pass close callbacks for desktop sidebar navigation", () => {
    const props = createProps({ isOverlaySidebar: false });
    render(<AppShellSidebarNavigationBody {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "create capsule" }));
    fireEvent.click(screen.getByRole("button", { name: "create outfit" }));
    fireEvent.click(screen.getByRole("button", { name: "open capsule" }));
    fireEvent.click(screen.getByRole("button", { name: "open outfit" }));
    fireEvent.click(screen.getByRole("button", { name: "expanded action" }));

    expect(props.onCreateCapsuleFromSidebar).toHaveBeenCalledWith(undefined);
    expect(props.onCreateOutfitFromSidebar).toHaveBeenCalledWith(undefined);
    expect(props.onOpenCapsuleFromSidebar).toHaveBeenCalledWith(
      "capsule-1",
      undefined,
    );
    expect(props.onOpenOutfitFromSidebar).toHaveBeenCalledWith(
      "outfit-1",
      undefined,
    );
    expect(props.closeSidebar).not.toHaveBeenCalled();
  });
});
