import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";
import { createAppTheme } from "../theme";
import { notifyPersonalItemsChanged } from "./personalItemsCount";

const myWardrobeApi = vi.hoisted(() => ({
  fetchMyWardrobeItems: vi.fn(() =>
    Promise.resolve({
      items: [{ id: "item-1" }, { id: "item-2" }, { id: "item-3" }],
    }),
  ),
}));

vi.mock("../api/myWardrobe", () => myWardrobeApi);

vi.mock("../components/AppSidebarNavigation", () => ({
  default: ({
    activeCapsuleId,
    capsuleHasUnsavedChanges,
    onCreateCapsule,
    onCreateOutfit,
    onSearchCapsules,
    onSearchOutfits,
    onOpenCapsule,
    onOpenOutfit,
    onLoadMoreOutfits,
    onOpenCapsuleActions,
    onOpenOutfitActions,
    personalItemsCount,
    outfitHasUnsavedChanges,
  }: {
    activeCapsuleId: string;
    capsuleHasUnsavedChanges: (capsule: { status?: string }) => boolean;
    onCreateCapsule: () => void;
    onCreateOutfit: () => void;
    onSearchCapsules: () => void;
    onSearchOutfits: () => void;
    onOpenCapsule: (capsuleId: string) => void;
    onOpenOutfit: (outfitId: string) => void;
    onLoadMoreOutfits: () => void;
    onOpenCapsuleActions: (
      event: React.MouseEvent<HTMLElement>,
      capsule: {
        id: string;
        name: string;
        saved?: unknown;
        status: string;
      },
    ) => void;
    onOpenOutfitActions: (
      event: React.MouseEvent<HTMLElement>,
      outfit: {
        id: string;
        name: string;
        saved?: unknown;
        status: string;
      },
    ) => void;
    personalItemsCount?: number | null;
    outfitHasUnsavedChanges: (outfit: { status?: string }) => boolean;
  }) => (
    <div>
      <button type="button" onClick={onCreateCapsule}>
        create capsule
      </button>
      <button type="button" onClick={onCreateOutfit}>
        create outfit
      </button>
      <button type="button" onClick={() => onOpenCapsule("capsule-2")}>
        open capsule
      </button>
      <button type="button" onClick={() => onOpenOutfit("outfit-2")}>
        open outfit
      </button>
      <button type="button" onClick={onLoadMoreOutfits}>
        load more outfits
      </button>
      <button type="button" onClick={onSearchCapsules}>
        search capsules
      </button>
      <button type="button" onClick={onSearchOutfits}>
        search outfits
      </button>
      <button
        type="button"
        onClick={(event) =>
          onOpenCapsuleActions(event, {
            id: "capsule-2",
            name: "Travel",
            saved: { data: { wardrobe: { items: [{ id: "item-1" }] } } },
            status: "modified",
          })
        }
      >
        open capsule actions
      </button>
      <button
        type="button"
        onClick={(event) =>
          onOpenCapsuleActions(event, {
            id: "capsule-1",
            name: "Stale active name",
            saved: { data: { wardrobe: { items: [{ id: "item-2" }] } } },
            status: "saved",
          })
        }
      >
        open active capsule actions
      </button>
      <button
        type="button"
        onClick={(event) =>
          onOpenOutfitActions(event, {
            id: "outfit-2",
            name: "Travel outfit",
            saved: { items: [] },
            status: "modified",
          })
        }
      >
        open outfit actions
      </button>
      <span data-testid="sidebar-active-capsule">{activeCapsuleId}</span>
      <span data-testid="sidebar-personal-items-count">
        {personalItemsCount ?? ""}
      </span>
      <span data-testid="unsaved-capsule">
        {String(capsuleHasUnsavedChanges({ status: "modified" }))}
      </span>
      <span data-testid="saved-capsule">
        {String(capsuleHasUnsavedChanges({ status: "saved" }))}
      </span>
      <span data-testid="unsaved-outfit">
        {String(outfitHasUnsavedChanges({ status: "new" }))}
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
  myWardrobeApi.fetchMyWardrobeItems.mockClear();
});

function createProps(
  overrides: Partial<AppShellContentProps> = {},
): AppShellContentProps {
  return {
    activeCapsuleId: "capsule-1",
    activeCapsuleMeta: { id: "capsule-1", name: "Spring", status: "saved" },
    appRoute: "explore",
    capsuleRouteId: "",
    capsuleList: [],
    capsulePagination: { limit: 10, offset: 0, total: 0, hasMore: false },
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
        "wardrobe.title": "Personal items",
        "wardrobe.newOutfit": "New outfit",
        "search.title": "Catalog: Explore",
        "statistics.title": "Catalog: Statistics",
        "appShell.toggleSidebar": "Toggle sidebar",
      })[key] ?? key,
    user: { email: "person@example.com" },
    onCreateCapsuleFromSidebar: vi.fn(() => Promise.resolve()),
    onCreateOutfitFromSidebar: vi.fn(() => Promise.resolve()),
    onDeleteCapsule: vi.fn(() => Promise.resolve()),
    onDeleteOutfit: vi.fn(() => Promise.resolve()),
    onDeleteProfile: vi.fn(() => Promise.resolve()),
    onDownloadOutfitPdf: vi.fn(() => Promise.resolve()),
    onDownloadWardrobePdf: vi.fn(() => Promise.resolve()),
    onDuplicateCapsule: vi.fn(() => Promise.resolve()),
    onDuplicateOutfit: vi.fn(() => Promise.resolve()),
    onNavigateApp: vi.fn(),
    onLoadMoreCapsules: vi.fn(() => Promise.resolve()),
    onLoadMoreOutfits: vi.fn(() => Promise.resolve()),
    onOpenCapsuleFromSidebar: vi.fn(() => Promise.resolve()),
    onOpenOutfitFromSidebar: vi.fn(() => Promise.resolve()),
    onRenameCapsule: vi.fn(() => Promise.resolve()),
    onRenameOutfit: vi.fn(() => Promise.resolve()),
    onRevertCapsule: vi.fn(() => Promise.resolve()),
    onRevertOutfit: vi.fn(() => Promise.resolve()),
    onSaveCapsule: vi.fn(() => Promise.resolve()),
    onSaveOutfit: vi.fn(() => Promise.resolve()),
    onSearchCapsules: vi.fn(() =>
      Promise.resolve([{ id: "capsule-7", name: "Search result" }]),
    ),
    onSearchOutfits: vi.fn(() =>
      Promise.resolve([{ id: "outfit-7", name: "Outfit result" }]),
    ),
    onShareCapsule: vi.fn(() =>
      Promise.resolve({ url: "https://client.example/share/capsule-2" }),
    ),
    onRequestSignOut: vi.fn(),
    onSaveSettings: vi.fn(() => Promise.resolve()),
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
  test("renders the marketing panel when the session has no user", () => {
    renderShellContent({
      user: null,
      isSearchView: false,
      t: (key: string) =>
        ({
          marketingHeadline: "Build better wardrobes",
        })[key] ?? key,
    });

    expect(screen.getByText("Build better wardrobes")).toBeInTheDocument();
  });

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
    expect(screen.getByText("Personal items")).toBeInTheDocument();
  });

  test("shows the outfit title in the mobile shell header", () => {
    renderShellContent({
      activeOutfitMeta: {
        id: "outfit-1",
        name: "Test outfit",
        status: "modified",
      },
      appRoute: "outfit",
      outfitRouteId: "outfit-1",
      isMainScreenView: true,
      isSearchView: false,
    });

    const header = screen.getByTestId("app-shell-mobile-header");
    expect(header).toHaveTextContent("Test outfit");
    expect(
      screen.getByRole("button", { name: "Toggle sidebar" }),
    ).toBeInTheDocument();
  });

  test("opens capsule search over the current route without navigating", async () => {
    const onNavigateApp = vi.fn();
    const onOpenCapsuleFromSidebar = vi.fn(() => Promise.resolve());
    const onSearchCapsules = vi.fn(() =>
      Promise.resolve([{ id: "capsule-7", name: "Search result" }]),
    );
    renderShellContent({
      appRoute: "wardrobe",
      isWardrobeView: true,
      isSearchView: false,
      onNavigateApp,
      onOpenCapsuleFromSidebar,
      onSearchCapsules,
    });

    fireEvent.click(screen.getByRole("button", { name: "search capsules" }));

    expect(onNavigateApp).not.toHaveBeenCalled();
    expect(screen.getByText("route content")).toBeInTheDocument();
    await waitFor(() => expect(onSearchCapsules).toHaveBeenCalledWith(""));
    expect(await screen.findByText("Search result")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Search result"));

    expect(onOpenCapsuleFromSidebar).toHaveBeenCalledWith("capsule-7");
  });

  test("opens sidebar capsule row actions on non-capsule routes", async () => {
    const user = userEvent.setup();
    const onDownloadWardrobePdf = vi.fn(() => Promise.resolve());
    const onDeleteCapsule = vi.fn(() => Promise.resolve());
    const onDuplicateCapsule = vi.fn(() => Promise.resolve());
    const onRenameCapsule = vi.fn(() => Promise.resolve());
    const onRevertCapsule = vi.fn(() => Promise.resolve());
    const onSaveCapsule = vi.fn(() => Promise.resolve());
    const onShareCapsule = vi.fn(() =>
      Promise.resolve({ url: "https://client.example/share/capsule-2" }),
    );
    renderShellContent({
      appRoute: "wardrobe",
      isWardrobeView: true,
      isSearchView: false,
      onDeleteCapsule,
      onDownloadWardrobePdf,
      onDuplicateCapsule,
      onRenameCapsule,
      onRevertCapsule,
      onSaveCapsule,
      onShareCapsule,
    });

    const openActions = () =>
      fireEvent.click(
        screen.getByRole("button", { name: "open capsule actions" }),
      );

    openActions();
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Export as PDF" }),
    );

    expect(onDownloadWardrobePdf).toHaveBeenCalledWith("capsule-2");

    openActions();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Rename" }));
    const renameInput = await screen.findByRole("textbox", {
      name: "Rename capsule",
    });
    await user.clear(renameInput);
    await user.type(renameInput, "Travel renamed");
    await user.click(screen.getByRole("button", { name: "OK" }));
    await waitFor(() =>
      expect(onRenameCapsule).toHaveBeenCalledWith(
        "Travel renamed",
        "capsule-2",
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    openActions();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Save" }));
    expect(onSaveCapsule).toHaveBeenCalledWith("capsule-2");

    openActions();
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Save as..." }),
    );
    const saveAsInput = await screen.findByRole("textbox", {
      name: "Save as",
    });
    await user.clear(saveAsInput);
    await user.type(saveAsInput, "Travel copy");
    await user.click(screen.getByRole("button", { name: "OK" }));
    await waitFor(() =>
      expect(onDuplicateCapsule).toHaveBeenCalledWith(
        "Travel copy",
        "capsule-2",
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    openActions();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Revert" }));
    fireEvent.click(await screen.findByRole("button", { name: "Revert" }));
    await waitFor(() =>
      expect(onRevertCapsule).toHaveBeenCalledWith("capsule-2"),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    openActions();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Share" }));
    await waitFor(() =>
      expect(onShareCapsule).toHaveBeenCalledWith("capsule-2"),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Close" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    openActions();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(onDeleteCapsule).toHaveBeenCalledWith("capsule-2"),
    );
  });

  test("uses current active capsule metadata for sidebar row actions", async () => {
    const user = userEvent.setup();
    renderShellContent({
      appRoute: "wardrobe",
      isWardrobeView: true,
      isSearchView: false,
      activeCapsuleMeta: {
        id: "capsule-1",
        name: "Spring",
        status: "saved",
      },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "open active capsule actions" }),
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Rename" }));

    expect(
      await screen.findByRole("textbox", { name: "Rename capsule" }),
    ).toHaveValue("Spring");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
  });

  test("passes the loaded personal items count to the sidebar", async () => {
    renderShellContent();

    await waitFor(() =>
      expect(
        screen.getByTestId("sidebar-personal-items-count"),
      ).toHaveTextContent("3"),
    );
    expect(myWardrobeApi.fetchMyWardrobeItems).toHaveBeenCalledWith();
  });

  test("refreshes the personal items count after wardrobe mutations", async () => {
    myWardrobeApi.fetchMyWardrobeItems
      .mockResolvedValueOnce({
        items: [{ id: "item-1" }, { id: "item-2" }, { id: "item-3" }],
      })
      .mockResolvedValueOnce({
        items: [
          { id: "item-1" },
          { id: "item-2" },
          { id: "item-3" },
          { id: "item-4" },
        ],
      });
    renderShellContent();

    await waitFor(() =>
      expect(
        screen.getByTestId("sidebar-personal-items-count"),
      ).toHaveTextContent("3"),
    );

    notifyPersonalItemsChanged();

    await waitFor(() =>
      expect(
        screen.getByTestId("sidebar-personal-items-count"),
      ).toHaveTextContent("4"),
    );
    expect(myWardrobeApi.fetchMyWardrobeItems).toHaveBeenLastCalledWith({
      force: true,
    });
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
      capsuleRouteId: "capsule-1",
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
    expect(screen.getByTestId("sidebar-active-capsule")).toHaveTextContent(
      "capsule-1",
    );
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

  test("wires sidebar outfit actions and search over the current route", async () => {
    const onCreateOutfitFromSidebar = vi.fn(() => Promise.resolve());
    const onOpenOutfitFromSidebar = vi.fn(() => Promise.resolve());
    const onSearchOutfits = vi.fn(() =>
      Promise.resolve([{ id: "outfit-7", name: "Outfit result" }]),
    );
    renderShellContent({
      appRoute: "outfit",
      activeOutfitMeta: {
        id: "outfit-1",
        name: "Weekend",
        status: "modified",
      },
      outfitRouteId: "outfit-1",
      isMainScreenView: true,
      isSearchView: false,
      onCreateOutfitFromSidebar,
      onOpenOutfitFromSidebar,
      onSearchOutfits,
    });

    expect(screen.getByTestId("unsaved-outfit")).toHaveTextContent("true");

    fireEvent.click(screen.getByRole("button", { name: "create outfit" }));
    fireEvent.click(screen.getByRole("button", { name: "open outfit" }));
    fireEvent.click(screen.getByRole("button", { name: "search outfits" }));

    expect(onCreateOutfitFromSidebar).toHaveBeenCalledWith(
      expect.any(Function),
    );
    expect(onOpenOutfitFromSidebar).toHaveBeenCalledWith(
      "outfit-2",
      expect.any(Function),
    );
    await waitFor(() => expect(onSearchOutfits).toHaveBeenCalledWith(""));
    expect(await screen.findByText("Outfit result")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Outfit result"));

    expect(onOpenOutfitFromSidebar).toHaveBeenCalledWith("outfit-7");
  });

  test("falls back safely when optional outfit sidebar handlers are absent", async () => {
    const user = userEvent.setup();
    renderShellContent({
      appRoute: "outfit",
      activeOutfitMeta: {
        id: "outfit-1",
        name: "Weekend",
        status: "modified",
      },
      outfitRouteId: "outfit-1",
      isMainScreenView: true,
      isSearchView: false,
      onCreateOutfitFromSidebar: undefined,
      onDeleteOutfit: undefined,
      onDownloadOutfitPdf: undefined,
      onDuplicateOutfit: undefined,
      onLoadMoreOutfits: undefined,
      onOpenOutfitFromSidebar: undefined,
      onRenameOutfit: undefined,
      onRevertOutfit: undefined,
      onSaveOutfit: undefined,
      onSearchOutfits: undefined,
    });

    fireEvent.click(screen.getByRole("button", { name: "create outfit" }));
    fireEvent.click(screen.getByRole("button", { name: "load more outfits" }));
    fireEvent.click(screen.getByRole("button", { name: "open outfit" }));

    const openActions = async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "open outfit actions" }),
      );
    };

    await openActions();
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Export as PDF" }),
    );

    await openActions();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Save" }));

    await openActions();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Rename" }));
    const renameInput = await screen.findByRole("textbox", { name: /Rename/ });
    await user.clear(renameInput);
    await user.type(renameInput, "Renamed");
    await user.click(screen.getByRole("button", { name: "OK" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    await openActions();
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Save as..." }),
    );
    const saveAsInput = await screen.findByRole("textbox", {
      name: /Save.*as/,
    });
    await user.clear(saveAsInput);
    await user.type(saveAsInput, "Copy");
    await user.click(screen.getByRole("button", { name: "OK" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    await openActions();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Revert" }));
    fireEvent.click(await screen.findByRole("button", { name: "Revert" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    await openActions();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  test("does not highlight a stale capsule outside the matching capsule URL", () => {
    renderShellContent({
      appRoute: "explore",
      activeCapsuleId: "capsule-1",
      activeCapsuleMeta: {
        id: "capsule-1",
        name: "Travel",
        status: "modified",
      },
      capsuleRouteId: "",
    });

    expect(screen.getByTestId("sidebar-active-capsule")).toHaveTextContent("");
  });

  test("highlights route-matched capsule metadata before active id catches up", () => {
    renderShellContent({
      appRoute: "capsule",
      activeCapsuleId: "",
      activeCapsuleMeta: {
        id: "capsule-15",
        name: "Search result",
        status: "saved",
      },
      capsuleRouteId: "capsule-15",
      isMainScreenView: true,
      isSearchView: false,
    });

    expect(screen.getByTestId("sidebar-active-capsule")).toHaveTextContent(
      "capsule-15",
    );
  });
});
