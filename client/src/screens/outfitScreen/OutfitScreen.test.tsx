import { afterEach, describe, expect, test, vi } from "vitest";
import {
  cleanup,
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
  default: ({ item, open, onClose }) =>
    open ? (
      <div role="dialog" aria-label="Product preview">
        <span>{item?.name}</span>
        <button type="button" onClick={onClose}>
          Close preview
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
        "capsule.renameWithName": `Rename capsule ${params?.name ?? ""}`,
        "capsule.revert": "Revert",
        "capsule.saveAs": "Save as",
        "filters.apply": "Apply",
        "filters.open": "Open filters",
        "filters.reset": "Reset",
        "filters.title": "Filters",
        "outfit.addItems": "Add items",
        "outfit.catalog": "Catalog",
        "outfit.emptySummary": "No items",
        "outfit.noneSelected": "No items selected",
        "outfit.openActions": "Open actions",
        "outfit.personalItems": "Personal items",
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
        "search.placeholder": "Search in natural language",
        "search.resultsCount": `${params?.count ?? 0} results`,
        "wardrobe.likedBadge": "Liked",
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
  vi.clearAllMocks();
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: originalMatchMedia,
  });
});

describe("OutfitScreen", () => {
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

  test("opens the add items dialog fullscreen on mobile", async () => {
    setViewportMobile(true);
    myWardrobeApi.fetchMyWardrobeItems.mockResolvedValue({ items: [] });

    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole("button", { name: "Add items" }));

    expect(screen.getByRole("dialog", { name: /Add items/ })).toHaveClass(
      "MuiDialog-paperFullScreen",
    );
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
    expect(
      within(filtersDialog).getByRole("switch", { name: "Liked only" }),
    ).toBeInTheDocument();
    expect(
      within(filtersDialog).queryByRole("button", { name: "Apply" }),
    ).not.toBeInTheDocument();
    expect(
      within(filtersDialog).getByRole("button", { name: "Close" }),
    ).toBeInTheDocument();
  });
});
