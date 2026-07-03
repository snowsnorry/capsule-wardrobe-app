import type { ComponentProps, RefObject } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  renderWithTheme,
  resetMainScreenTestMocks,
  setMainScreenMediaQuery,
} from "./MainScreen.testUtils";
import MainScreenWardrobe from "./MainScreenWardrobe";
import type { MainScreenItem } from "./MainScreenTypes";

type WardrobeProps = ComponentProps<typeof MainScreenWardrobe>;

const items = [
  {
    id: "a",
    url: "https://example.com/a",
    name: "Shirt",
    brand: "COS",
    category: "top",
  },
  {
    id: "b",
    url: "https://example.com/b",
    name: "Trousers",
    category: "bottom",
  },
  { id: "c", url: "https://example.com/c", name: "Bag", category: "bag" },
];

function createItems(count: number): MainScreenItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index}`,
    url: `https://example.com/item-${index}`,
    name: `Item ${index}`,
    category: "top",
  }));
}

function createScrollContainerRef(
  clientHeight = 800,
): RefObject<HTMLElement | null> {
  const element = document.createElement("div");
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    value: clientHeight,
  });
  element.setAttribute("data-test-scroll-container", "true");
  document.body.appendChild(element);
  return { current: element };
}

function createWardrobeProps(
  overrides: Partial<WardrobeProps> = {},
): WardrobeProps {
  return {
    activeImageSrc: "",
    activeSet: null,
    disabled: false,
    isImagePending: false,
    isLoading: false,
    isOverlay: false,
    mobileColumns: 2,
    partialPendingUrls: [],
    selectedAnchorItemRefs: [],
    selectedUrls: [],
    selectionMode: false,
    showAdditionalItemPlaceholder: false,
    scrollContainerRef: createScrollContainerRef(),
    visibleItems: [],
    onDeleteImage: vi.fn(),
    onGenerateImage: vi.fn(),
    onImageClick: vi.fn(),
    onProductClick: vi.fn(),
    onProductMenuOpen: vi.fn(),
    onToggleSelected: vi.fn(),
    ...overrides,
  };
}

function renderWardrobe(overrides: Partial<WardrobeProps> = {}) {
  const props = createWardrobeProps(overrides);
  return { props, ...renderWithTheme(<MainScreenWardrobe {...props} />) };
}

describe("MainScreenWardrobe", () => {
  beforeEach(() => {
    resetMainScreenTestMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    cleanup();
    document
      .querySelectorAll("[data-test-scroll-container]")
      .forEach((element) => element.remove());
  });

  test("renders loading placeholder with configured mobile columns", () => {
    renderWardrobe({ isLoading: true, mobileColumns: 3 });

    expect(screen.getByTestId("loading-placeholder")).toHaveAttribute(
      "data-mobile-columns",
      "3",
    );
  });

  test("renders grid items, pending placeholders, selected state, and extra placeholder", async () => {
    const user = userEvent.setup();
    const onToggleSelected = vi.fn();
    renderWardrobe({
      visibleItems: items,
      selectedUrls: ["https://example.com/a"],
      partialPendingUrls: ["https://example.com/b"],
      selectionMode: true,
      showAdditionalItemPlaceholder: true,
      onToggleSelected,
    });

    expect(
      screen.getByTestId("placeholder-card-pending-https://example.com/b"),
    ).toHaveAttribute("data-mobile-columns", "2");
    expect(
      screen.getByTestId("clothing-card-https://example.com/a"),
    ).toHaveAttribute("data-selected", "true");
    expect(
      screen.getByTestId("clothing-card-https://example.com/a"),
    ).toHaveAttribute("data-selection-mode", "true");
    expect(screen.getByText("COS")).toBeInTheDocument();
    expect(screen.getByTestId("inline-placeholder-1")).toHaveAttribute(
      "data-mobile-columns",
      "2",
    );

    await user.click(screen.getByTestId("clothing-card-https://example.com/c"));
    expect(onToggleSelected).toHaveBeenCalledWith(items[2]);
  });

  test("keeps short lists on the regular grid path", () => {
    renderWardrobe({ visibleItems: createItems(12) });

    expect(
      screen.queryByTestId("virtual-wardrobe-grid"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("clothing-card-https://example.com/item-0"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("clothing-card-https://example.com/item-11"),
    ).toBeInTheDocument();
  });

  test("virtualizes long lists without mounting every card immediately", () => {
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({
        x: 0,
        y: 0,
        width: 1200,
        height: 800,
        top: 0,
        right: 1200,
        bottom: 800,
        left: 0,
        toJSON: () => ({}),
      });

    renderWardrobe({ visibleItems: createItems(100) });

    expect(screen.getByTestId("virtual-wardrobe-grid")).toBeInTheDocument();
    expect(
      screen.getByTestId("clothing-card-https://example.com/item-0"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("clothing-card-https://example.com/item-99"),
    ).not.toBeInTheDocument();

    rectSpy.mockRestore();
  });

  test("uses the sm breakpoint for virtual columns even when content width is below sm", () => {
    setMainScreenMediaQuery((query) =>
      String(query).includes("min-width:600px"),
    );
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 520,
      height: 800,
      top: 0,
      right: 520,
      bottom: 800,
      left: 0,
      toJSON: () => ({}),
    });

    renderWardrobe({ mobileColumns: 3, visibleItems: createItems(72) });

    expect(screen.getByTestId("virtual-wardrobe-grid")).toHaveAttribute(
      "data-column-count",
      "2",
    );
  });

  test("applies scroll margin when content sits above the virtual grid", async () => {
    const scrollContainerRef = createScrollContainerRef(800);
    scrollContainerRef.current!.scrollTop = 50;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function getRect(this: HTMLElement) {
        const isScrollContainer = this.hasAttribute(
          "data-test-scroll-container",
        );
        const isVirtualGrid =
          this.getAttribute("data-testid") === "virtual-wardrobe-grid";
        const top = isVirtualGrid ? 300 : isScrollContainer ? 20 : 0;
        return {
          x: 0,
          y: top,
          width: 1200,
          height: isScrollContainer ? 800 : 400,
          top,
          right: 1200,
          bottom: top + (isScrollContainer ? 800 : 400),
          left: 0,
          toJSON: () => ({}),
        };
      },
    );

    renderWardrobe({
      scrollContainerRef,
      visibleItems: createItems(72),
    });

    await waitFor(() =>
      expect(screen.getByTestId("virtual-wardrobe-grid")).toHaveAttribute(
        "data-scroll-margin",
        "330",
      ),
    );
  });

  test("uses ResizeObserver when the browser provides it", () => {
    class ResizeObserverMock {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 1200,
      height: 800,
      top: 0,
      right: 1200,
      bottom: 800,
      left: 0,
      toJSON: () => ({}),
    });

    const { unmount } = renderWardrobe({ visibleItems: createItems(72) });

    expect(screen.getByTestId("virtual-wardrobe-grid")).toBeInTheDocument();

    unmount();
    vi.unstubAllGlobals();
  });

  test("preserves card behavior in the virtualized grid path", async () => {
    const user = userEvent.setup();
    const onToggleSelected = vi.fn();
    const virtualItems = createItems(72);
    virtualItems[0] = {
      id: "selected",
      url: "https://example.com/selected",
      name: "Selected",
      category: "top",
    };
    virtualItems[1] = {
      id: "pending",
      url: "https://example.com/pending",
      name: "Pending",
      category: "top",
    };
    virtualItems[2] = {
      id: "anchor",
      url: "wardrobe://anchor",
      name: "Anchor",
      category: "top",
      source: "uploaded" as const,
    };

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 1200,
      height: 800,
      top: 0,
      right: 1200,
      bottom: 800,
      left: 0,
      toJSON: () => ({}),
    });

    renderWardrobe({
      visibleItems: virtualItems,
      selectedUrls: ["https://example.com/selected"],
      partialPendingUrls: ["https://example.com/pending"],
      selectedAnchorItemRefs: [
        { source: "uploaded", url: "wardrobe://anchor" },
      ],
      selectionMode: true,
      onToggleSelected,
    });

    expect(
      screen.getByTestId("clothing-card-https://example.com/selected"),
    ).toHaveAttribute("data-selected", "true");
    expect(
      screen.getByTestId(
        "placeholder-card-pending-https://example.com/pending",
      ),
    ).toHaveAttribute("data-mobile-columns", "2");
    expect(
      screen.getByTestId("clothing-card-wardrobe://anchor"),
    ).toHaveAttribute("data-selectable", "false");

    await user.click(
      screen.getByTestId("clothing-card-https://example.com/item-3"),
    );
    expect(onToggleSelected).toHaveBeenCalledWith(virtualItems[3]);
  });

  test("can render the additional placeholder on the virtualized path", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 1200,
      height: 10000,
      top: 0,
      right: 1200,
      bottom: 10000,
      left: 0,
      toJSON: () => ({}),
    });

    renderWardrobe({
      scrollContainerRef: createScrollContainerRef(10000),
      showAdditionalItemPlaceholder: true,
      visibleItems: createItems(61),
    });

    expect(screen.getByTestId("virtual-wardrobe-grid")).toBeInTheDocument();
    expect(screen.getByTestId("inline-placeholder-1")).toHaveAttribute(
      "data-mobile-columns",
      "2",
    );
  });

  test("keeps anchor wardrobe cards out of partial-regeneration selection", async () => {
    const user = userEvent.setup();
    const onToggleSelected = vi.fn();
    const anchorItem = {
      id: "W7",
      wardrobeId: 7,
      url: "wardrobe://7",
      name: "Anchor shirt",
      category: "top",
      source: "uploaded" as const,
    };
    renderWardrobe({
      visibleItems: [anchorItem],
      selectedAnchorItemRefs: [{ source: "uploaded", url: "wardrobe://7" }],
      selectionMode: true,
      isOverlay: true,
      onToggleSelected,
    });

    const anchorCard = screen.getByTestId("clothing-card-wardrobe://7");
    expect(anchorCard).toHaveAttribute("data-selectable", "false");
    expect(anchorCard).toHaveAttribute(
      "data-regeneration-locked-reason",
      "Anchor items must stay in the capsule.",
    );
    expect(anchorCard).toBeDisabled();

    await user.click(anchorCard);

    expect(onToggleSelected).not.toHaveBeenCalled();
  });

  test("keeps catalog anchor refs out of partial-regeneration selection", async () => {
    const user = userEvent.setup();
    const onToggleSelected = vi.fn();
    const anchorItem = {
      id: "p1",
      url: "https://example.com/catalog-coat",
      name: "Catalog coat",
      category: "outerwear",
      source: "from_catalog" as const,
    };
    renderWardrobe({
      visibleItems: [anchorItem],
      selectedAnchorItemRefs: [
        { source: "from_catalog", url: "https://example.com/catalog-coat" },
      ],
      selectionMode: true,
      isOverlay: true,
      onToggleSelected,
    });

    const anchorCard = screen.getByTestId(
      "clothing-card-https://example.com/catalog-coat",
    );
    expect(anchorCard).toHaveAttribute("data-selectable", "false");
    expect(anchorCard).toHaveAttribute(
      "data-regeneration-locked-reason",
      "Anchor items must stay in the capsule.",
    );

    await user.click(anchorCard);

    expect(onToggleSelected).not.toHaveBeenCalled();
  });

  test("opens product details from a product card outside selection mode", async () => {
    const user = userEvent.setup();
    const onProductClick = vi.fn();
    const onToggleSelected = vi.fn();
    renderWardrobe({
      visibleItems: items,
      onProductClick,
      onToggleSelected,
    });

    await user.click(screen.getByTestId("clothing-card-https://example.com/a"));

    expect(onProductClick).toHaveBeenCalledWith(items[0]);
    expect(onToggleSelected).not.toHaveBeenCalled();
  });

  test("opens product menu for uploaded cards without a safe product URL", async () => {
    const user = userEvent.setup();
    const onProductMenuOpen = vi.fn();
    const uploadedItem = {
      id: "uploaded-1",
      url: "wardrobe://uploaded-1",
      name: "Uploaded shirt",
      category: "top",
      source: "uploaded" as const,
    };
    renderWardrobe({
      visibleItems: [uploadedItem],
      isOverlay: true,
      onProductMenuOpen,
    });

    const menuButton = screen.getByTestId("product-menu-wardrobe://uploaded-1");
    expect(menuButton).toHaveAttribute(
      "data-allow-product-menu-without-url",
      "true",
    );
    await user.click(menuButton);

    expect(onProductMenuOpen).toHaveBeenCalledWith(
      expect.any(HTMLButtonElement),
      "wardrobe://uploaded-1",
      uploadedItem,
      { presentation: "anchored" },
    );
  });

  test("renders only create image button for outfit tab without generated image", async () => {
    const user = userEvent.setup();
    const onGenerateImage = vi.fn();
    renderWardrobe({
      activeSet: {
        id: "set-1",
        index: 0,
        label: 1,
        items,
        image: null,
        imageObsolete: false,
      },
      visibleItems: items,
      onGenerateImage,
    });

    expect(screen.getByTestId("outfit-set-image-divider")).toBeInTheDocument();
    expect(
      screen.queryByTestId("outfit-set-image-placeholder"),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create image" }));
    expect(onGenerateImage).toHaveBeenCalledWith(0);
  });

  test("renders placeholder while outfit set image is pending", () => {
    renderWardrobe({
      activeSet: {
        id: "set-1",
        index: 0,
        label: 1,
        items,
        image: null,
        imageObsolete: false,
      },
      isImagePending: true,
      visibleItems: items,
    });

    expect(
      screen.getByTestId("outfit-set-image-placeholder"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Create image" }),
    ).not.toBeInTheDocument();
  });

  test("renders generated image and opens full-size callback on click", async () => {
    const user = userEvent.setup();
    const onImageClick = vi.fn();
    renderWardrobe({
      activeImageSrc: "data:image/png;base64,abc123",
      activeSet: {
        id: "set-1",
        index: 0,
        label: 1,
        items,
        image: "abc123",
        imageObsolete: false,
      },
      visibleItems: items,
      onImageClick,
    });

    await user.click(screen.getByTestId("outfit-set-image"));
    expect(screen.getByTestId("outfit-set-image")).toHaveAttribute(
      "src",
      "data:image/png;base64,abc123",
    );
    expect(screen.getByTestId("outfit-set-image")).toHaveAttribute(
      "alt",
      "Outfit set 1",
    );
    expect(screen.getByTestId("outfit-set-image-divider")).toBeInTheDocument();
    expect(onImageClick).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("button", { name: "Create image" }),
    ).not.toBeInTheDocument();
  });

  test("passes through generated image URLs directly", () => {
    renderWardrobe({
      activeImageSrc: "https://images.example.com/set.png",
      activeSet: {
        id: "set-1",
        index: 0,
        label: 1,
        items,
        image: "https://images.example.com/set.png",
        imageObsolete: false,
      },
      visibleItems: items,
    });

    expect(screen.getByTestId("outfit-set-image")).toHaveAttribute(
      "src",
      "https://images.example.com/set.png",
    );
  });

  test("renders obsolete image warning only when image is marked obsolete", () => {
    renderWardrobe({
      activeImageSrc: "data:image/png;base64,abc123",
      activeSet: {
        id: "set-1",
        index: 0,
        label: 1,
        items,
        image: "abc123",
        imageObsolete: true,
      },
      visibleItems: items,
    });

    expect(
      screen.getByText(
        "This image may no longer match the current outfit. Remove it and generate a new one if needed.",
      ),
    ).toBeInTheDocument();

    cleanup();
    renderWardrobe({
      activeImageSrc: "data:image/png;base64,abc123",
      activeSet: {
        id: "set-1",
        index: 0,
        label: 1,
        items,
        image: "abc123",
        imageObsolete: false,
      },
      visibleItems: items,
    });

    expect(
      screen.queryByText(
        "This image may no longer match the current outfit. Remove it and generate a new one if needed.",
      ),
    ).not.toBeInTheDocument();
  });

  test("calls delete image callback with active outfit set index", async () => {
    const user = userEvent.setup();
    const onDeleteImage = vi.fn();
    renderWardrobe({
      activeImageSrc: "data:image/png;base64,abc123",
      activeSet: {
        id: "set-2",
        index: 1,
        label: 2,
        items,
        image: "abc123",
        imageObsolete: false,
      },
      visibleItems: items,
      onDeleteImage,
    });

    await user.click(screen.getByRole("button", { name: "Delete image" }));
    expect(onDeleteImage).toHaveBeenCalledWith(1);
  });
});
