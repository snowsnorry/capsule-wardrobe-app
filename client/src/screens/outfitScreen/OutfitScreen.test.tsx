import { afterEach, describe, expect, test, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import OutfitScreen from "./OutfitScreen";

const myWardrobeApi = vi.hoisted(() => ({
  fetchMyWardrobeItems: vi.fn(),
}));
const searchApi = vi.hoisted(() => ({
  fetchSearchOptions: vi.fn(),
  runSearch: vi.fn(),
}));

vi.mock("../../api/myWardrobe", () => myWardrobeApi);
vi.mock("../../api/search", () => searchApi);
vi.mock("../mainScreen/CapsuleProductDetailDialog", () => ({
  default: ({
    item,
    mode,
    onApply,
    onClose,
    onEdit,
    onReadMode,
    onSetItemLike,
    open,
  }) =>
    open ? (
      <div role="dialog" aria-label="Product preview">
        <span>{item?.name}</span>
        <span>mode: {mode}</span>
        <button type="button" onClick={onClose}>
          Close preview
        </button>
        <button type="button" onClick={() => onEdit?.(item)}>
          Edit preview
        </button>
        <button type="button" onClick={onReadMode}>
          Read preview
        </button>
        <button
          type="button"
          onClick={() => onApply?.(item, { name: "Updated preview item" })}
        >
          Apply preview
        </button>
        <button type="button" onClick={() => onSetItemLike?.(item, true)}>
          Like preview
        </button>
      </div>
    ) : null,
}));
vi.mock("../../i18n/useI18n", () => ({
  useI18n: () => ({
    locale: "en",
    t: (key: string, params?: Record<string, unknown>) => {
      const labels: Record<string, string> = {
        "actions.add": "Add",
        "actions.cancel": "Cancel",
        "actions.close": "Close",
        "actions.delete": "Delete",
        "actions.save": "Save",
        "capsule.anchors.apply": "Apply",
        "capsule.anchors.empty": "No items",
        "capsule.cardColumnsOne": "1 column",
        "capsule.cardColumnsThree": "3 columns",
        "capsule.cardColumnsTwo": "2 columns",
        "capsule.cardLayout": "Card layout",
        "capsule.editName": "Edit capsule name",
        "capsule.exportPdf": "Export PDF",
        "capsule.nameLabel": "Capsule name",
        "capsule.notSaved": "Not saved",
        "capsule.openProductMenu": "Open product menu",
        "capsule.renameWithName": `Rename capsule ${params?.name ?? ""}`,
        "capsule.revert": "Revert",
        "capsule.saveAs": "Save as",
        "filters.apply": "Apply",
        "filters.open": "Open filters",
        "filters.reset": "Reset",
        "filters.title": "Filters",
        "outfit.addItems": "Add items",
        "outfit.catalog": "Catalog",
        "outfit.catalogSelected": `${params?.count ?? 0} catalog`,
        "outfit.categoryCount": `${params?.count ?? 0} ${params?.category ?? ""}`,
        "outfit.confirmDelete": "Delete outfit?",
        "outfit.confirmRemoveItem": "Remove item?",
        "outfit.confirmRemoveSelected": "Remove selected?",
        "outfit.confirmRevert": "Revert outfit?",
        "outfit.emptySummary": "No items",
        "outfit.noneSelected": "No items selected",
        "outfit.openActions": "Open actions",
        "outfit.personalSelected": `${params?.count ?? 0} personal`,
        "outfit.personalItems": "Personal items",
        "outfit.removeSelectedCount": `Remove ${params?.count ?? 0}`,
        "outfit.selectItem": "Select",
        "main.cancelSelection": "Cancel selection",
        "options.categories.bag": "Bag",
        "options.categories.top": "Top",
        "profile.styleAestheticTitle": "Aesthetics",
        "profile.styleCoreTitle": "Core",
        "search.all": "All",
        "search.filters.audience": "Audience",
        "search.filters.brand": "Brand",
        "search.filters.category": "Category",
        "search.filters.closureType": "Closure type",
        "search.filters.fit": "Fit",
        "search.filters.likedItems": "Liked only",
        "search.filters.max": "Max",
        "search.filters.min": "Min",
        "search.filters.occasion": "Occasion",
        "search.filters.pattern": "Pattern",
        "search.filters.price": "Price",
        "search.filters.season": "Season",
        "search.filters.silhouette": "Silhouette",
        "search.notImportant": "Not important",
        "search.clear": "Clear search",
        "search.filters.query": `Search: ${params?.query ?? ""}`,
        "search.placeholder": "Search in natural language",
        "search.resultsCount": `${params?.count ?? 0} results`,
        "wardrobe.like": "Like",
        "wardrobe.likedBadge": "Liked",
        "wardrobe.removeLike": "Remove like",
      };
      return labels[key] || key;
    },
  }),
}));

const theme = createTheme();
const originalMatchMedia = window.matchMedia;

function setViewportMobile(isMobile: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: isMobile && query.includes("max-width:899px"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function mockCatalogSearch() {
  myWardrobeApi.fetchMyWardrobeItems.mockResolvedValue({ items: [] });
  searchApi.fetchSearchOptions.mockResolvedValue({
    brands: [{ value: "uniqlo", label: "UNIQLO" }],
    categories: ["outerwear", "top"],
    seasons: ["winter"],
    formalityLevels: ["casual"],
    styles: ["minimalistic"],
    occasions: ["office"],
    audience: ["all"],
    colors: ["black"],
    patterns: ["solid"],
    silhouettes: ["straight"],
    fits: ["regular"],
    closureTypes: ["zip"],
    priceRange: { min: 0, max: 300 },
  });
  searchApi.runSearch.mockResolvedValue({
    total: 1,
    items: [
      {
        id: "catalog-1",
        url: "https://example.com/catalog-1",
        name: "Catalog jacket",
        category: "outerwear",
        imageUrl: "https://example.com/catalog-1.png",
      },
    ],
  });
}

function renderScreen(overrides: Record<string, unknown> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <OutfitScreen
        activeOutfit={{
          id: "outfit-1",
          name: "<New outfit>",
          status: "saved",
          effective: { items: [] },
        }}
        isContentBusy={false}
        onDeleteOutfit={vi.fn()}
        onDownloadOutfitPdf={vi.fn()}
        onDuplicateOutfit={vi.fn()}
        onRenameOutfit={vi.fn()}
        onReplaceOutfitItems={vi.fn()}
        onRevertOutfit={vi.fn()}
        onSaveOutfit={vi.fn()}
        onSetItemLike={vi.fn()}
        {...overrides}
      />
    </ThemeProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: originalMatchMedia,
  });
});

describe("OutfitScreen", () => {
  test("uses the app primary scroll target for only the outfit cards", () => {
    renderScreen();

    const screenSurface = screen.getByTestId("outfit-screen");
    const contentColumn = screen.getByTestId("outfit-content");
    const cardsScroll = screen.getByTestId("outfit-cards-scroll");
    const cardsContent = screen.getByTestId("outfit-cards-content");

    expect(screenSurface).not.toHaveAttribute("data-app-primary-scroll-target");
    expect(getComputedStyle(screenSurface).overflow).toBe("hidden");
    expect(cardsScroll).toHaveAttribute(
      "data-app-primary-scroll-target",
      "true",
    );
    expect(getComputedStyle(cardsScroll).overflowY).toBe("auto");
    expect(getComputedStyle(cardsScroll).overflowX).toBe("hidden");
    expect(getComputedStyle(cardsScroll).overscrollBehaviorY).toBe("contain");
    expect(getComputedStyle(screenSurface).marginRight).not.toBe("auto");
    expect(getComputedStyle(contentColumn).marginRight).toBe("auto");
    expect(getComputedStyle(cardsContent).marginRight).toBe("auto");
  });

  test("uses capsule-style inline title controls with unsaved dot", async () => {
    const user = userEvent.setup();
    const onRenameOutfit = vi.fn(() => Promise.resolve());
    renderScreen({
      activeOutfit: {
        id: "outfit-1",
        name: "<New outfit>",
        status: "modified",
        effective: { items: [] },
      },
      onRenameOutfit,
    });

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Rename capsule <New outfit>" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit capsule name" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Not saved")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit capsule name" }));
    const input = screen.getByRole("textbox", { name: "Capsule name" });
    await user.clear(input);
    await user.type(input, "Weekend outfit{Enter}");

    await waitFor(() => {
      expect(onRenameOutfit).toHaveBeenCalledWith("Weekend outfit", "outfit-1");
    });
  });

  test("opens item preview when an outfit card is clicked", async () => {
    const user = userEvent.setup();
    renderScreen({
      activeOutfit: {
        id: "outfit-1",
        name: "<New outfit>",
        status: "saved",
        effective: {
          items: [
            {
              key: "https://example.com/jacket",
              source: "catalog",
              item: {
                id: "catalog-1",
                url: "https://example.com/jacket",
                name: "Preview jacket",
                category: "outerwear",
                imageUrl: "https://example.com/jacket.png",
              },
            },
          ],
        },
      },
    });

    await user.click(screen.getByRole("button", { name: /Preview jacket/i }));

    const preview = screen.getByRole("dialog", { name: "Product preview" });
    expect(preview).toBeInTheDocument();
    expect(within(preview).getByText("Preview jacket")).toBeInTheDocument();
  });

  test("applies uploaded preview edits and preview likes to the outfit", async () => {
    const user = userEvent.setup();
    const onReplaceOutfitItems = vi.fn(() => Promise.resolve());
    const onSetItemLike = vi.fn(() => Promise.resolve());
    const onUpdateUploadedWardrobeItem = vi.fn(() =>
      Promise.resolve({
        id: 42,
        url: "https://example.com/uploaded",
        name: "Updated preview item",
        category: "outerwear",
        imageUrl: "https://example.com/uploaded.png",
        source: "uploaded",
      }),
    );
    renderScreen({
      activeOutfit: {
        id: "outfit-1",
        name: "Weekend",
        status: "modified",
        effective: {
          items: [
            {
              key: "wardrobe://42",
              source: "personal",
              item: {
                id: 42,
                url: "https://example.com/uploaded",
                name: "Uploaded jacket",
                category: "outerwear",
                imageUrl: "https://example.com/uploaded.png",
                source: "uploaded",
              },
            },
          ],
        },
      },
      onReplaceOutfitItems,
      onSetItemLike,
      onUpdateUploadedWardrobeItem,
    });

    await user.click(screen.getByRole("button", { name: /Uploaded jacket/i }));
    await user.click(screen.getByRole("button", { name: "Edit preview" }));
    expect(screen.getByText("mode: edit")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Read preview" }));
    expect(screen.getByText("mode: read")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Apply preview" }));
    await waitFor(() => {
      expect(onUpdateUploadedWardrobeItem).toHaveBeenCalledWith(
        expect.objectContaining({ id: 42 }),
        { name: "Updated preview item" },
      );
      expect(onReplaceOutfitItems).toHaveBeenCalledWith("outfit-1", [
        expect.objectContaining({
          item: expect.objectContaining({ name: "Updated preview item" }),
        }),
      ]);
    });

    await user.click(screen.getByRole("button", { name: "Like preview" }));
    expect(onSetItemLike).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://example.com/uploaded" }),
      true,
    );

    await user.click(screen.getByRole("button", { name: "Close preview" }));
    expect(
      screen.queryByRole("dialog", { name: "Product preview" }),
    ).not.toBeInTheDocument();
  });

  test("handles desktop outfit item menu like, select, and remove actions", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const onReplaceOutfitItems = vi.fn(() => Promise.resolve());
    const onSetItemLike = vi.fn(() => Promise.resolve());
    renderScreen({
      activeOutfit: {
        id: "outfit-1",
        name: "Weekend",
        status: "modified",
        effective: {
          items: [
            {
              key: "https://example.com/context-jacket",
              source: "catalog",
              item: {
                id: "catalog-1",
                url: "https://example.com/context-jacket",
                name: "Context jacket",
                category: "outerwear",
                imageUrl: "https://example.com/context-jacket.png",
              },
            },
          ],
        },
      },
      onReplaceOutfitItems,
      onSetItemLike,
    });

    const openMenu = async () => {
      await screen.findByRole("button", { name: /Context jacket/i });
      fireEvent.click(document.querySelector(".wardrobe-card-product-menu")!);
    };

    await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Like" }));
    expect(onSetItemLike).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://example.com/context-jacket" }),
      true,
    );

    await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Select" }));
    await user.click(screen.getByRole("button", { name: "Cancel selection" }));

    await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Select" }));
    await screen.findByRole("button", { name: "Cancel selection" });
    const selectedCard = screen.getByRole("button", {
      name: /Context jacket/i,
    });
    await user.click(selectedCard);
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Cancel selection" }),
      ).not.toBeInTheDocument();
    });

    await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Select" }));
    await screen.findByRole("button", { name: "Cancel selection" });
    await user.click(screen.getByRole("button", { name: "Remove 1" }));
    expect(confirm).toHaveBeenCalledWith("Remove selected?");
    expect(onReplaceOutfitItems).toHaveBeenLastCalledWith("outfit-1", []);

    await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(confirm).toHaveBeenCalledWith("Remove item?");
    expect(onReplaceOutfitItems).toHaveBeenLastCalledWith("outfit-1", []);
  });

  test("sorts outfit cards by the capsule wardrobe order", () => {
    renderScreen({
      activeOutfit: {
        id: "outfit-1",
        name: "<New outfit>",
        status: "saved",
        effective: {
          items: [
            {
              key: "https://example.com/bag",
              source: "catalog",
              item: {
                id: "bag",
                url: "https://example.com/bag",
                name: "Bag",
                category: "bag",
                imageUrl: "https://example.com/bag.png",
              },
            },
            {
              key: "https://example.com/trousers",
              source: "catalog",
              item: {
                id: "trousers",
                url: "https://example.com/trousers",
                name: "Trousers",
                category: "bottom",
                imageUrl: "https://example.com/trousers.png",
              },
            },
            {
              key: "https://example.com/shirt",
              source: "catalog",
              item: {
                id: "shirt",
                url: "https://example.com/shirt",
                name: "Shirt",
                category: "top",
                imageUrl: "https://example.com/shirt.png",
              },
            },
            {
              key: "https://example.com/blazer",
              source: "catalog",
              item: {
                id: "blazer",
                url: "https://example.com/blazer",
                name: "Blazer",
                category: "outerwear",
                imageUrl: "https://example.com/blazer.png",
              },
            },
          ],
        },
      },
    });

    const blazer = screen.getByRole("button", { name: /Blazer/i });
    const shirt = screen.getByRole("button", { name: /Shirt/i });
    const trousers = screen.getByRole("button", { name: /Trousers/i });
    const bag = screen.getByRole("button", { name: /Bag/i });

    expect(blazer.compareDocumentPosition(shirt)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(shirt.compareDocumentPosition(trousers)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(trousers.compareDocumentPosition(bag)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  test("does not duplicate the outfit title inside the mobile body", () => {
    setViewportMobile(true);

    renderScreen({
      activeOutfit: {
        id: "outfit-1",
        name: "Test outfit",
        status: "modified",
        effective: { items: [] },
      },
    });

    expect(
      screen.queryByRole("button", { name: "Rename capsule Test outfit" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add items" }),
    ).toBeInTheDocument();
  });

  test("opens the outfit item long-press menu as a centered mobile preview", () => {
    vi.useFakeTimers();
    setViewportMobile(true);
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: vibrate,
    });

    renderScreen({
      activeOutfit: {
        id: "outfit-1",
        name: "Test outfit",
        status: "saved",
        effective: {
          items: [
            {
              key: "https://example.com/context-jacket",
              source: "catalog",
              item: {
                id: "catalog-1",
                url: "https://example.com/context-jacket",
                name: "Context jacket",
                category: "outerwear",
                imageUrl: "https://example.com/context-jacket.png",
              },
            },
          ],
        },
      },
    });

    const card = screen.getByRole("button", { name: /Context jacket/i });
    vi.spyOn(card, "getBoundingClientRect").mockReturnValue({
      top: 24,
      left: 16,
      width: 150,
      height: 210,
      right: 166,
      bottom: 234,
      x: 16,
      y: 24,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(card, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 24,
      clientY: 32,
    });
    act(() => {
      vi.advanceTimersByTime(520);
    });

    expect(vibrate).toHaveBeenCalledWith(10);
    const dialog = screen.getByRole("dialog", { name: "Open product menu" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("Context jacket")).toBeInTheDocument();
    expect(screen.getAllByText("Select")).toHaveLength(1);

    fireEvent.click(screen.getByText("Select"));

    expect(screen.getByRole("button", { name: "Select" })).toBeVisible();
    expect(screen.getByTestId("CheckRoundedIcon")).toBeInTheDocument();
    expect(
      screen.queryByTestId("ThumbDownAltOutlinedIcon"),
    ).not.toBeInTheDocument();
  });

  test("shows mobile card layout controls and updates outfit columns", async () => {
    setViewportMobile(true);
    window.localStorage.removeItem("outfit.mobileCardColumns");
    const user = userEvent.setup();
    const { container } = renderScreen({
      activeOutfit: {
        id: "outfit-1",
        name: "Test outfit",
        status: "saved",
        effective: {
          items: [
            {
              key: "wardrobe://42",
              source: "personal",
              item: {
                id: 42,
                url: "https://example.com/uploaded",
                name: "Uploaded jacket",
                category: "outerwear",
                imageUrl: "https://example.com/uploaded.png",
                source: "uploaded",
              },
            },
          ],
        },
      },
    });

    await screen.findByRole("button", { name: /Uploaded jacket/i });
    expect(container.querySelector(".wardrobe-card-root")).toHaveAttribute(
      "data-mobile-columns",
      "2",
    );

    await user.click(screen.getByRole("button", { name: "Open actions" }));

    expect(screen.getByText("Card layout")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "3 columns" }));

    expect(container.querySelector(".wardrobe-card-root")).toHaveAttribute(
      "data-mobile-columns",
      "3",
    );
    expect(window.localStorage.getItem("outfit.mobileCardColumns")).toBe("3");
  });

  test("runs outfit-level menu actions with confirmation for destructive operations", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const onDeleteOutfit = vi.fn(() => Promise.resolve());
    const onDownloadOutfitPdf = vi.fn(() => Promise.resolve());
    const onDuplicateOutfit = vi.fn(() => Promise.resolve());
    const onRevertOutfit = vi.fn(() => Promise.resolve());
    const onSaveOutfit = vi.fn(() => Promise.resolve());
    renderScreen({
      activeOutfit: {
        id: "outfit-1",
        name: "Weekend",
        status: "modified",
        effective: { items: [] },
      },
      onDeleteOutfit,
      onDownloadOutfitPdf,
      onDuplicateOutfit,
      onRevertOutfit,
      onSaveOutfit,
    });

    const openMenu = async () => {
      await user.click(screen.getByRole("button", { name: "Open actions" }));
    };

    await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Export PDF" }));
    expect(onDownloadOutfitPdf).toHaveBeenCalledWith("outfit-1");

    await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Save" }));
    expect(onSaveOutfit).toHaveBeenCalledWith("outfit-1");

    await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Save as" }));
    expect(onDuplicateOutfit).toHaveBeenCalledWith("Weekend", "outfit-1");

    await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Revert" }));
    expect(confirm).toHaveBeenCalledWith("Revert outfit?");
    expect(onRevertOutfit).toHaveBeenCalledWith("outfit-1");

    await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(confirm).toHaveBeenCalledWith("Delete outfit?");
    expect(onDeleteOutfit).toHaveBeenCalledWith("outfit-1");
  });

  test("adds selected personal and catalog items to the current outfit", async () => {
    myWardrobeApi.fetchMyWardrobeItems.mockResolvedValue({
      items: [
        {
          id: 42,
          url: "https://example.com/personal",
          name: "Personal shirt",
          category: "top",
          imageUrl: "https://example.com/personal.png",
          source: "uploaded",
          isLiked: true,
        },
        {
          id: 43,
          url: "https://example.com/existing",
          name: "Existing shirt",
          category: "top",
          imageUrl: "https://example.com/existing.png",
          source: "from_catalog",
        },
      ],
    });
    searchApi.fetchSearchOptions.mockResolvedValue({
      brands: [],
      categories: ["bag"],
      seasons: [],
      formalityLevels: [],
      styles: [],
      occasions: [],
      audience: [],
      colors: [],
      patterns: [],
      silhouettes: [],
      fits: [],
      closureTypes: [],
      priceRange: { min: 0, max: 100 },
    });
    searchApi.runSearch.mockResolvedValue({
      total: 1,
      items: [
        {
          id: "catalog-bag",
          url: "https://example.com/bag",
          name: "Catalog bag",
          category: "bag",
          imageUrl: "https://example.com/bag.png",
        },
      ],
    });
    const onReplaceOutfitItems = vi.fn(() => Promise.resolve());
    const user = userEvent.setup();
    renderScreen({
      activeOutfit: {
        id: "outfit-1",
        name: "Weekend",
        status: "modified",
        effective: {
          items: [
            {
              key: "wardrobe://43",
              source: "personal",
              item: {
                id: 43,
                url: "https://example.com/existing",
                name: "Existing shirt",
                category: "top",
              },
            },
          ],
        },
      },
      onReplaceOutfitItems,
    });

    await user.click(screen.getByRole("button", { name: "Add items" }));
    await user.click(
      await screen.findByRole("button", { name: /Personal shirt/i }),
    );
    await user.click(screen.getByRole("tab", { name: "Catalog" }));
    await user.click(
      await screen.findByRole("button", { name: /Catalog bag/i }),
    );

    expect(screen.getByText("1 personal · 1 catalog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(onReplaceOutfitItems).toHaveBeenCalledWith("outfit-1", [
      expect.objectContaining({ key: "wardrobe://43", source: "personal" }),
      expect.objectContaining({ key: "wardrobe://42", source: "personal" }),
      expect.objectContaining({
        key: "https://example.com/bag",
        source: "catalog",
      }),
    ]);
  });

  test("opens the add items dialog fullscreen on mobile", async () => {
    setViewportMobile(true);
    myWardrobeApi.fetchMyWardrobeItems.mockResolvedValue({ items: [] });

    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole("button", { name: "Add items" }));

    expect(screen.getByRole("dialog", { name: /Add items/ })).toHaveClass(
      "MuiDialog-paperFullScreen",
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: /Add items/ }),
      ).not.toBeInTheDocument();
    });
  });

  test("shows catalog filters, search, total, and picker cards in add dialog", async () => {
    mockCatalogSearch();

    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole("button", { name: "Add items" }));
    await user.click(screen.getByRole("tab", { name: "Catalog" }));

    await waitFor(() => {
      expect(searchApi.fetchSearchOptions).toHaveBeenCalledTimes(1);
      expect(searchApi.runSearch).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 20, persist: false }),
      );
    });

    expect(screen.getAllByText("Filters")).not.toHaveLength(0);
    expect(screen.getByText("Liked only")).toBeInTheDocument();
    expect(screen.getByText("Brand")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Search in natural language"),
    ).toBeInTheDocument();
    expect(screen.getByText("1 results")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Catalog jacket/i }),
    ).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText("Search in natural language"),
      "linen{Enter}",
    );

    await waitFor(() => {
      expect(searchApi.runSearch).toHaveBeenLastCalledWith(
        expect.objectContaining({ limit: 20, persist: false, query: "linen" }),
      );
    });
  });

  test("keeps the catalog query chip on the last applied search while typing", async () => {
    mockCatalogSearch();

    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole("button", { name: "Add items" }));
    await user.click(screen.getByRole("tab", { name: "Catalog" }));
    await screen.findByText("1 results");
    searchApi.runSearch.mockClear();

    const searchInput = screen.getByPlaceholderText(
      "Search in natural language",
    );
    await user.type(searchInput, "linen");

    expect(searchInput).toHaveValue("linen");
    expect(screen.queryByText("Search: linen")).not.toBeInTheDocument();
    expect(searchApi.runSearch).not.toHaveBeenCalled();

    await user.type(searchInput, "{Enter}");

    await waitFor(() => {
      expect(screen.getByText("Search: linen")).toBeInTheDocument();
      expect(searchApi.runSearch).toHaveBeenLastCalledWith(
        expect.objectContaining({ limit: 20, persist: false, query: "linen" }),
      );
    });

    await user.clear(searchInput);
    await user.type(searchInput, "silk");

    expect(screen.getByText("Search: linen")).toBeInTheDocument();
    expect(screen.queryByText("Search: silk")).not.toBeInTheDocument();
  });

  test("uses the colocated 320 thumbnail for uploaded personal items in the add dialog", async () => {
    const imageUrl =
      "https://assets.capsule-wardrobe.org/wardrobe/f2641a1885a7ae72/6f6172c0-de05-4782-b2c1-0e90291f4eea-5ddb4e96b2b825e06d19bc887f32e61e7a5e0fa9d92deea0c3adc4feebb30828.webp";
    myWardrobeApi.fetchMyWardrobeItems.mockResolvedValue({
      items: [
        {
          id: 42,
          url: "https://example.com/original-product-page",
          name: "Uploaded jacket",
          category: "outerwear",
          imageUrl,
          source: "uploaded",
        },
      ],
    });

    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole("button", { name: "Add items" }));

    const image = await screen.findByRole("img", {
      name: "Uploaded jacket",
    });
    expect(image).toHaveAttribute(
      "src",
      "https://assets.capsule-wardrobe.org/wardrobe/f2641a1885a7ae72/6f6172c0-de05-4782-b2c1-0e90291f4eea-5ddb4e96b2b825e06d19bc887f32e61e7a5e0fa9d92deea0c3adc4feebb30828_320.webp",
    );
    expect(image).not.toHaveAttribute("srcset");
  });

  test("does not infer personal item source from wardrobe-looking image URLs", async () => {
    const imageUrl =
      "https://assets.capsule-wardrobe.org/wardrobe/f2641a1885a7ae72/catalog-looking.webp";
    myWardrobeApi.fetchMyWardrobeItems.mockResolvedValue({
      items: [
        {
          id: 43,
          url: "https://example.com/original-product-page",
          name: "Catalog-backed personal item",
          category: "outerwear",
          imageUrl,
          source: "from_catalog",
        },
      ],
    });

    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole("button", { name: "Add items" }));

    const image = await screen.findByRole("img", {
      name: "Catalog-backed personal item",
    });
    expect(image).not.toHaveAttribute(
      "src",
      "https://assets.capsule-wardrobe.org/wardrobe/f2641a1885a7ae72/catalog-looking_320.webp",
    );
  });

  test("opens catalog filters from the mobile search bar", async () => {
    setViewportMobile(true);
    mockCatalogSearch();

    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole("button", { name: "Add items" }));
    await user.click(screen.getByRole("tab", { name: "Catalog" }));

    await screen.findByText("1 results");
    await user.click(screen.getByRole("button", { name: "Open filters" }));

    const filtersDialog = screen.getByRole("dialog", { name: "Filters" });
    const likedOnlySwitch = within(filtersDialog).getByRole("switch", {
      name: "Liked only",
    });
    expect(likedOnlySwitch).toBeInTheDocument();
    expect(
      within(filtersDialog).getByRole("button", { name: "Apply" }),
    ).toBeInTheDocument();
    expect(
      within(filtersDialog).getAllByRole("button", { name: "Reset" }),
    ).not.toHaveLength(0);
    expect(
      within(filtersDialog).getByRole("button", { name: "Close" }),
    ).toBeInTheDocument();

    await user.click(likedOnlySwitch);
    expect(searchApi.runSearch).toHaveBeenCalledTimes(1);

    await user.click(
      within(filtersDialog).getByRole("button", { name: "Close" }),
    );
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Filters" }),
      ).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Open filters" }));
    const reopenedDialog = screen.getByRole("dialog", { name: "Filters" });
    expect(
      within(reopenedDialog).getByRole("switch", { name: "Liked only" }),
    ).not.toBeChecked();

    await user.click(
      within(reopenedDialog).getByRole("switch", { name: "Liked only" }),
    );
    await user.click(
      within(reopenedDialog).getByRole("button", { name: "Apply" }),
    );

    await waitFor(() => {
      expect(searchApi.runSearch).toHaveBeenCalledTimes(2);
      expect(searchApi.runSearch).toHaveBeenLastCalledWith(
        expect.objectContaining({
          likedOnly: true,
          limit: 20,
          persist: false,
        }),
      );
      expect(
        screen.queryByRole("dialog", { name: "Filters" }),
      ).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Open filters" }));
    const appliedDialog = screen.getByRole("dialog", { name: "Filters" });
    expect(
      within(appliedDialog).getByRole("switch", { name: "Liked only" }),
    ).toBeChecked();

    const resetButtons = within(appliedDialog).getAllByRole("button", {
      name: "Reset",
    });
    await user.click(resetButtons.at(-1)!);

    await waitFor(() => {
      expect(searchApi.runSearch).toHaveBeenCalledTimes(3);
      expect(searchApi.runSearch).toHaveBeenLastCalledWith(
        expect.objectContaining({
          likedOnly: false,
          limit: 20,
          persist: false,
        }),
      );
      expect(
        screen.queryByRole("dialog", { name: "Filters" }),
      ).not.toBeInTheDocument();
    });
  }, 10_000);
});
