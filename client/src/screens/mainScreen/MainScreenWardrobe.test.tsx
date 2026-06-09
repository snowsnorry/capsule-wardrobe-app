import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  renderWithTheme,
  resetMainScreenTestMocks,
} from "./MainScreen.testUtils";
import MainScreenWardrobe from "./MainScreenWardrobe";

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
    cleanup();
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
