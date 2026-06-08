import type { MouseEvent } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";
import {
  createMainScreenProps,
  fetchMyWardrobeItemsMock,
  renderWithTheme,
  resetMainScreenTestMocks,
  setMainScreenLayout,
  theme,
} from "./MainScreen.testUtils";
import MainScreen from "./MainScreen";
import type { MainScreenProps } from "./MainScreenTypes";

function renderMainScreen(
  overrides: Partial<MainScreenProps> = {},
  options: {
    layoutMode?: "overlay" | "medium" | "large";
    mobile?: boolean;
  } = {},
) {
  setMainScreenLayout(options.mobile ? "overlay" : options.layoutMode);
  const props = createMainScreenProps(overrides);
  const view = renderWithTheme(<MainScreen {...props} />);
  return { props, ...view };
}

describe("MainScreen", () => {
  beforeEach(() => {
    resetMainScreenTestMocks();
  });

  afterEach(() => {
    cleanup();
  });

  test("renders as inner capsule content without owning the app shell", () => {
    renderMainScreen({}, { layoutMode: "medium" });

    expect(screen.queryByTestId("main-screen-shell")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Regenerate all" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("profile-filters-sidebar")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Open user menu" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Collapse sidebar" }),
    ).not.toBeInTheDocument();
  });

  test("registers capsule sidebar actions and opens search or row menu flows", async () => {
    const user = userEvent.setup();
    const registerCapsuleSidebarActions = vi.fn();

    renderMainScreen({ registerCapsuleSidebarActions });

    const actions = registerCapsuleSidebarActions.mock.calls.at(-1)?.[0];
    expect(actions).toEqual({
      openSearchDialog: expect.any(Function),
      openCapsuleActions: expect.any(Function),
    });

    act(() => {
      actions.openSearchDialog();
    });
    expect(
      await screen.findByPlaceholderText("Search capsules..."),
    ).toBeInTheDocument();

    const anchor = document.createElement("button");
    document.body.appendChild(anchor);
    act(() => {
      actions.openCapsuleActions(
        { currentTarget: anchor } as unknown as MouseEvent<HTMLElement>,
        {
          id: "capsule-1",
          name: "Spring edit",
          status: "saved",
        },
      );
    });
    expect(
      await screen.findByRole("menuitem", { name: "Rename" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Rename" }));
    expect(
      await screen.findByRole("dialog", { name: "Rename capsule" }),
    ).toBeInTheDocument();
  });

  test("shares active and registered sidebar capsules through MainScreen state", async () => {
    const user = userEvent.setup();
    const onShareCapsule = vi.fn((capsuleId?: string) =>
      Promise.resolve({
        url: `https://client.example/share/${capsuleId || "unknown"}`,
        expiresAt: new Date(60_000).toISOString(),
      }),
    );
    const registerCapsuleSidebarActions = vi.fn();
    renderMainScreen({
      activeCapsule: {
        id: "capsule-1",
        name: "Spring edit",
        draft: {
          filters: {},
          data: { wardrobe: { items: [{ url: "https://example.com/1" }] } },
        },
        saved: null,
        status: "new",
      },
      capsuleList: [
        { id: "capsule-1", name: "Spring edit", status: "new" },
        { id: "capsule-2", name: "Summer edit", status: "saved" },
      ],
      onShareCapsule,
      registerCapsuleSidebarActions,
    });

    await user.click(screen.getByRole("button", { name: "Open capsule menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Share" }));
    expect(onShareCapsule).toHaveBeenCalledWith("capsule-1");
    expect(
      await screen.findByRole("link", { name: "Spring edit" }),
    ).toHaveAttribute("href", "https://client.example/share/capsule-1");

    await user.click(screen.getAllByRole("button", { name: "Close" }).at(-1)!);
    const actions = registerCapsuleSidebarActions.mock.calls.at(-1)?.[0];
    const anchor = document.createElement("button");
    document.body.appendChild(anchor);
    act(() => {
      actions.openCapsuleActions(
        { currentTarget: anchor } as unknown as MouseEvent<HTMLElement>,
        {
          id: "capsule-2",
          name: "Summer edit",
          status: "saved",
        },
      );
    });
    await user.click(await screen.findByRole("menuitem", { name: "Share" }));
    expect(onShareCapsule).toHaveBeenCalledWith("capsule-2");
    expect(
      await screen.findByRole("link", { name: "Summer edit" }),
    ).toHaveAttribute("href", "https://client.example/share/capsule-2");
  });

  test("blocks sharing active capsules with uploaded personal wardrobe items before API call", async () => {
    const user = userEvent.setup();
    const onShareCapsule = vi.fn();
    renderMainScreen({
      activeCapsule: {
        id: "capsule-uploaded",
        name: "Private capsule",
        draft: {
          filters: {},
          data: {
            wardrobe: {
              items: [
                {
                  id: "Wuploaded-1",
                  url: "wardrobe://uploaded-1",
                  source: "uploaded",
                  name: "Uploaded shirt",
                  audience: "woman",
                  category: "top",
                  imageUrl: "https://example.com/uploaded.jpg",
                },
              ],
            },
          },
        },
        saved: null,
        status: "new",
      },
      onShareCapsule,
    });

    await user.click(screen.getByRole("button", { name: "Open capsule menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Share" }));

    expect(onShareCapsule).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("dialog", { name: "Can't share this capsule" }),
    ).toBeInTheDocument();
  });

  test("allows sharing catalog items saved through wardrobe and handles server-side personal item blocks", async () => {
    const user = userEvent.setup();
    const onShareCapsule = vi
      .fn()
      .mockResolvedValueOnce({
        url: "https://client.example/share/capsule-catalog",
      })
      .mockResolvedValueOnce({ blockedReason: "personal_uploaded_items" });
    const { rerender } = renderMainScreen({
      activeCapsule: {
        id: "capsule-catalog",
        name: "Catalog wardrobe capsule",
        draft: {
          filters: {},
          data: {
            wardrobe: {
              items: [
                {
                  id: "W7",
                  productId: "catalog-7",
                  source: "from_catalog",
                  url: "https://example.com/catalog-7",
                  name: "Catalog shirt",
                  audience: "woman",
                  category: "top",
                  imageUrl: "https://example.com/catalog-7.jpg",
                },
              ],
            },
          },
        },
        saved: null,
        status: "new",
      },
      onShareCapsule,
    });

    await user.click(screen.getByRole("button", { name: "Open capsule menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Share" }));
    expect(onShareCapsule).toHaveBeenCalledWith("capsule-catalog");
    expect(
      await screen.findByRole("link", { name: "Catalog wardrobe capsule" }),
    ).toHaveAttribute("href", "https://client.example/share/capsule-catalog");

    await user.click(screen.getAllByRole("button", { name: "Close" }).at(-1)!);
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Share capsule" }),
      ).not.toBeInTheDocument();
    });
    rerender(
      <ThemeProvider theme={theme}>
        <MainScreen
          {...createMainScreenProps({
            activeCapsule: {
              id: "capsule-unknown-personal",
              name: "Unknown private capsule",
              draft: {
                filters: {},
                data: {
                  wardrobe: {
                    items: [
                      {
                        id: "catalog-1",
                        url: "https://example.com/catalog-1",
                      },
                    ],
                  },
                },
              },
              saved: null,
              status: "new",
            },
            onShareCapsule,
          })}
        />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Open capsule menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Share" }));
    expect(onShareCapsule).toHaveBeenLastCalledWith("capsule-unknown-personal");
    expect(
      await screen.findByRole("dialog", { name: "Can't share this capsule" }),
    ).toBeInTheDocument();
  });

  test("resets back to All when the selected outfit tab disappears", async () => {
    const user = userEvent.setup();
    const initialProps = createMainScreenProps({
      items: [
        {
          id: "a",
          url: "https://example.com/a",
          name: "Shirt",
          category: "top",
        },
        {
          id: "b",
          url: "https://example.com/b",
          name: "Trousers",
          category: "bottom",
        },
        { id: "c", url: "https://example.com/c", name: "Bag", category: "bag" },
      ],
      outfitSets: [{ itemIds: ["a", "b", "c"] }],
    });
    const view = renderMainScreen(initialProps);

    await user.click(screen.getByRole("tab", { name: "Outfit 1" }));
    expect(
      screen.queryByRole("tab", { selected: true, name: "Outfit 1" }),
    ).toBeInTheDocument();

    view.rerender(
      <ThemeProvider theme={theme}>
        <MainScreen {...initialProps} outfitSets={[]} />
      </ThemeProvider>,
    );

    expect(
      screen.queryByRole("tab", { name: "Outfit 1" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "All" })).not.toBeInTheDocument();
  });

  test("enters and leaves card selection mode through the product menu", async () => {
    const user = userEvent.setup();
    const props = createMainScreenProps({
      items: [
        {
          id: "a",
          url: "https://example.com/a",
          name: "Shirt",
          category: "top",
        },
      ],
      onToggleRegenerationSelection: vi.fn(),
    });
    const view = renderMainScreen(props);

    expect(
      screen.getByTestId("clothing-card-https://example.com/a"),
    ).toHaveAttribute("data-selection-mode", "false");
    await user.click(screen.getByTestId("product-menu-https://example.com/a"));
    await user.click(screen.getByRole("menuitem", { name: "Select" }));

    expect(props.onToggleRegenerationSelection).toHaveBeenCalledWith({
      id: "a",
      url: "https://example.com/a",
      name: "Shirt",
      category: "top",
    });
    expect(
      screen.getByTestId("clothing-card-https://example.com/a"),
    ).toHaveAttribute("data-selection-mode", "true");
    expect(
      screen.queryByTestId("product-menu-https://example.com/a"),
    ).not.toBeInTheDocument();

    view.rerender(
      <ThemeProvider theme={theme}>
        <MainScreen
          {...props}
          selectedRegenerationUrls={["https://example.com/a"]}
        />
      </ThemeProvider>,
    );
    expect(
      screen.getByTestId("clothing-card-https://example.com/a"),
    ).toHaveAttribute("data-selection-mode", "true");

    view.rerender(
      <ThemeProvider theme={theme}>
        <MainScreen {...props} selectedRegenerationUrls={[]} />
      </ThemeProvider>,
    );
    await waitFor(() => {
      expect(
        screen.getByTestId("clothing-card-https://example.com/a"),
      ).toHaveAttribute("data-selection-mode", "false");
    });
  });

  test("coordinates regenerate-all immediate, confirm, and changed-filter flows", async () => {
    const user = userEvent.setup();
    const onRefreshItems = vi.fn();
    const onApplyFilters = vi.fn();

    renderMainScreen({ items: [], onRefreshItems });
    await user.click(screen.getByRole("button", { name: "Regenerate all" }));
    expect(onRefreshItems).toHaveBeenCalledTimes(1);
    cleanup();
    resetMainScreenTestMocks();

    renderMainScreen({
      items: [
        {
          id: "a",
          url: "https://example.com/a",
          name: "Shirt",
          category: "top",
        },
      ],
      onRefreshItems,
    });
    await user.click(screen.getByRole("button", { name: "Regenerate all" }));
    expect(
      screen.getByRole("dialog", { name: "Regenerate capsule?" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Regenerate" }));
    expect(onRefreshItems).toHaveBeenCalledTimes(2);
    cleanup();
    resetMainScreenTestMocks();

    renderMainScreen({
      hasFilterChanges: true,
      items: [
        {
          id: "a",
          url: "https://example.com/a",
          name: "Shirt",
          category: "top",
        },
      ],
      onRefreshItems,
      onApplyFilters,
    });
    await user.click(screen.getByRole("button", { name: "Regenerate all" }));
    expect(
      screen.getByRole("dialog", { name: "Apply updated filters?" }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Apply and regenerate" }),
    );
    expect(onApplyFilters).toHaveBeenCalledTimes(1);
  });

  test("blocks regenerate all in wardrobe-only mode when the wardrobe has no ready items", async () => {
    const onRefreshItems = vi.fn();
    fetchMyWardrobeItemsMock.mockResolvedValue({ items: [] });

    renderMainScreen({
      selectedSourceMode: "wardrobe_only",
      onRefreshItems,
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Regenerate all" }),
      ).toBeDisabled();
    });
    expect(fetchMyWardrobeItemsMock).toHaveBeenCalledWith({ force: true });
    expect(onRefreshItems).not.toHaveBeenCalled();
  });

  test("disables primary controls while content is busy or share link is being created", async () => {
    const user = userEvent.setup();
    let resolveShare:
      | ((result: { url: string; expiresAt: string }) => void)
      | undefined;
    const onShareCapsule = vi.fn(
      () =>
        new Promise<{ url: string; expiresAt: string }>((resolve) => {
          resolveShare = resolve;
        }),
    );

    renderMainScreen({
      onShareCapsule,
      activeCapsule: {
        id: "capsule-1",
        name: "Spring edit",
        draft: {
          filters: {},
          data: { wardrobe: { items: [{ url: "https://example.com/1" }] } },
        },
        saved: null,
        status: "new",
      },
    });

    await user.click(screen.getByRole("button", { name: "Open capsule menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Share" }));

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Regenerate all" }),
    ).toBeDisabled();

    resolveShare?.({
      url: "https://client.example/share/share-1",
      expiresAt: new Date(60_000).toISOString(),
    });
    expect(
      await screen.findByRole("dialog", { name: "Share capsule" }),
    ).toBeInTheDocument();
  });

  test("marks pending outfit images and regenerating cards while content is busy", async () => {
    const user = userEvent.setup();
    renderMainScreen({
      isContentBusy: true,
      items: [
        {
          id: "a",
          url: "https://example.com/a",
          name: "Shirt",
          category: "top",
        },
        {
          id: "b",
          url: "https://example.com/b",
          name: "Trousers",
          category: "bottom",
        },
        {
          id: "c",
          url: "https://example.com/c",
          name: "Bag",
          category: "bag",
        },
      ],
      outfitSets: [
        { itemIds: ["a", "b", "c"], image: "data:image/png;base64,old" },
      ],
    });

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(
      screen.getByTestId("clothing-card-https://example.com/a"),
    ).toHaveAttribute("data-regenerating", "true");

    cleanup();
    resetMainScreenTestMocks();
    renderMainScreen({
      pendingImageSetIndexes: [0],
      items: [
        {
          id: "a",
          url: "https://example.com/a",
          name: "Shirt",
          category: "top",
        },
        {
          id: "b",
          url: "https://example.com/b",
          name: "Trousers",
          category: "bottom",
        },
        {
          id: "c",
          url: "https://example.com/c",
          name: "Bag",
          category: "bag",
        },
      ],
      outfitSets: [
        { itemIds: ["a", "b", "c"], image: "data:image/png;base64,old" },
      ],
    });

    await user.click(screen.getByRole("tab", { name: "Outfit 1" }));
    expect(
      screen.getByTestId("outfit-set-image-placeholder"),
    ).toBeInTheDocument();
  });

  test("opens outfit image dialog, confirms image deletion, and closes sidebar row menus", async () => {
    const user = userEvent.setup();
    const onDeleteOutfitSetImage = vi.fn(() => Promise.resolve());
    const onDeleteCapsule = vi.fn(() => Promise.resolve());
    const registerCapsuleSidebarActions = vi.fn();
    renderMainScreen({
      onDeleteOutfitSetImage,
      onDeleteCapsule,
      registerCapsuleSidebarActions,
      items: [
        {
          id: "a",
          url: "https://example.com/a",
          name: "Shirt",
          category: "top",
        },
        {
          id: "b",
          url: "https://example.com/b",
          name: "Trousers",
          category: "bottom",
        },
        {
          id: "c",
          url: "https://example.com/c",
          name: "Bag",
          category: "bag",
        },
      ],
      outfitSets: [
        { itemIds: ["a", "b", "c"], image: "data:image/png;base64,set" },
      ],
    });

    await user.click(screen.getByRole("tab", { name: "Outfit 1" }));
    const outfitImagePreview = screen.getByRole("button", {
      name: "Open outfit 1 image preview",
    });
    expect(outfitImagePreview).toBeInTheDocument();
    expect(screen.getByTestId("outfit-set-image")).toBeInTheDocument();
    outfitImagePreview.focus();
    expect(outfitImagePreview).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByTestId("outfit-set-image-dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(
        screen.queryByTestId("outfit-set-image-dialog"),
      ).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Delete image" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDeleteOutfitSetImage).toHaveBeenCalledWith(0);

    const actions = registerCapsuleSidebarActions.mock.calls.at(-1)?.[0];
    const anchor = document.createElement("button");
    document.body.appendChild(anchor);
    act(() => {
      actions.openCapsuleActions(
        { currentTarget: anchor } as unknown as MouseEvent<HTMLElement>,
        { id: "capsule-2", name: "Travel edit", status: "saved" },
      );
    });
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(onDeleteCapsule).toHaveBeenCalledWith("capsule-2");
  });

  test("copies active capsule outfit sets into saved outfits with a repeatable action", async () => {
    const user = userEvent.setup();
    const onCopyOutfitSetToOutfits = vi.fn(() =>
      Promise.resolve({ id: "outfit-copy", name: "Copied outfit" }),
    );
    const onOpenOutfit = vi.fn(() => Promise.resolve());
    renderMainScreen({
      onCopyOutfitSetToOutfits,
      onOpenOutfit,
      items: [
        {
          id: "a",
          url: "https://example.com/a",
          source: "from_catalog",
          name: "Jacket",
          category: "outerwear",
        },
        {
          id: "b",
          url: "https://example.com/b",
          source: "from_catalog",
          name: "Shirt",
          category: "top",
        },
        {
          id: "c",
          url: "https://uploads.example.com/bag",
          source: "uploaded",
          name: "Bag",
          category: "bag",
        },
      ],
      outfitSets: [{ itemIds: ["b", "c", "a"] }],
    });

    expect(
      screen.queryByRole("button", { name: "Copy to outfits" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Outfit 1" }));

    const outfitSummary = screen.getByTestId("outfit-summary");
    expect(within(outfitSummary).getByText("Outerwear: 1")).toBeInTheDocument();
    expect(within(outfitSummary).getByText("Top: 1")).toBeInTheDocument();
    expect(within(outfitSummary).getByText("Bag: 1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Copy to outfits" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Copy to outfits",
    });
    const input = screen.getByRole("textbox", { name: "Outfit name" });
    expect(input).toHaveValue("Spring edit: Outfit 1");
    expect(dialog).toHaveTextContent(
      'The capsule "Spring edit" stays unchanged.',
    );

    await user.clear(input);
    await user.type(input, "Travel copy");
    await user.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => {
      expect(onCopyOutfitSetToOutfits).toHaveBeenCalledWith("Travel copy", [
        expect.objectContaining({ url: "https://example.com/a" }),
        expect.objectContaining({ url: "https://example.com/b" }),
        expect.objectContaining({
          url: "https://uploads.example.com/bag",
          source: "uploaded",
        }),
      ]);
    });
    expect(onOpenOutfit).not.toHaveBeenCalled();
    expect(await screen.findByText("Outfit copied")).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Copy to outfits" }),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "Copy to outfits" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open outfit" }));

    expect(onOpenOutfit).toHaveBeenCalledWith("outfit-copy");
  });

  test("uses compact outfit set summary in mobile overlay layouts", async () => {
    const user = userEvent.setup();
    renderMainScreen(
      {
        items: [
          {
            id: "a",
            url: "https://example.com/a",
            name: "Jacket",
            category: "outerwear",
          },
          {
            id: "b",
            url: "https://example.com/b",
            name: "Shirt",
            category: "top",
          },
          {
            id: "c",
            url: "https://example.com/c",
            name: "Bag",
            category: "bag",
          },
        ],
        outfitSets: [{ itemIds: ["a", "b", "c"] }],
      },
      { mobile: true },
    );

    await user.click(screen.getByRole("tab", { name: "Outfit 1" }));

    expect(screen.getByText("3 items · 3 categories")).toBeInTheDocument();
  });

  test("submits desktop inline rename with normalized values", async () => {
    const user = userEvent.setup();
    const onRenameCapsule = vi.fn(() => Promise.resolve());
    renderMainScreen({ onRenameCapsule });

    await user.click(
      screen.getByRole("button", { name: "Rename capsule Spring edit" }),
    );
    const input = screen.getByRole("textbox", { name: "Capsule name" });
    await user.clear(input);
    await user.type(input, "Summer edit{Enter}");

    await waitFor(() => {
      expect(onRenameCapsule).toHaveBeenCalledWith("Summer edit", "capsule-1");
    });
  });

  test("does not submit desktop inline rename for unchanged or whitespace-only values", async () => {
    const user = userEvent.setup();
    const onRenameCapsule = vi.fn(() => Promise.resolve());
    renderMainScreen({ onRenameCapsule });

    await user.click(screen.getByRole("button", { name: "Edit capsule name" }));
    let input = screen.getByRole("textbox", { name: "Capsule name" });
    await user.clear(input);
    await user.type(input, "   ");
    await user.tab();
    await waitFor(() => {
      expect(
        screen.queryByRole("textbox", { name: "Capsule name" }),
      ).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Edit capsule name" }));
    input = screen.getByRole("textbox", { name: "Capsule name" });
    await user.clear(input);
    await user.type(input, "  Spring edit  ");
    await user.tab();

    await waitFor(() => {
      expect(
        screen.queryByRole("textbox", { name: "Capsule name" }),
      ).not.toBeInTheDocument();
    });
    expect(onRenameCapsule).not.toHaveBeenCalled();
  });
});
