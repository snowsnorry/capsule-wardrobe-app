import { afterEach, describe, expect, test, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import type { ComponentProps } from "react";

vi.mock("../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

import ClothingCard from "./ClothingCard";

const theme = createTheme();

const item: ComponentProps<typeof ClothingCard>["item"] = {
  id: "item-1",
  name: "Red Jacket",
  brand: "Studio Nicholson",
  category: "outerwear",
  imageUrl: "https://example.com/red-jacket.jpg",
  url: "https://example.com/products/red-jacket",
};

function renderCard(props: Partial<ComponentProps<typeof ClothingCard>> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <ClothingCard item={item} {...props} />
    </ThemeProvider>,
  );
}

describe("ClothingCard", () => {
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  test("calls onToggleSelected and stops bubbling when the toggle button is clicked", async () => {
    const onToggleSelected = vi.fn();
    const onParentClick = vi.fn();

    render(
      <ThemeProvider theme={theme}>
        <div onClick={onParentClick}>
          <ClothingCard
            item={item}
            isSelectable
            isSelectionMode
            isMobile
            onToggleSelected={onToggleSelected}
          />
        </div>
      </ThemeProvider>,
    );

    const toggleButton = screen.getByRole("button", {
      name: "main.partialRegenerateToggle",
    });
    fireEvent.click(toggleButton);

    expect(onToggleSelected).toHaveBeenCalledTimes(1);
    expect(onToggleSelected).toHaveBeenCalledWith(item);
    expect(onParentClick).not.toHaveBeenCalled();
  });

  test("renders only the product menu by default and keeps it hidden on desktop until hover", () => {
    const { container, rerender } = renderCard({ isSelectable: true });
    const toggleButton = container.querySelector(".wardrobe-card-regenerate");
    const menuButton = container.querySelector(".wardrobe-card-product-menu");

    expect(toggleButton).not.toBeInTheDocument();
    expect(menuButton).toBeInTheDocument();
    expect(menuButton).not.toBeVisible();

    rerender(
      <ThemeProvider theme={theme}>
        <ClothingCard item={item} isSelectable isMobile />
      </ThemeProvider>,
    );

    expect(
      screen.queryByRole("button", { name: "main.partialRegenerateToggle" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "capsule.openProductMenu" }),
    ).not.toBeInTheDocument();
  });

  test("renders only the selection toggle in selection mode", () => {
    renderCard({ isSelectable: true, isSelectionMode: true, isMobile: true });

    expect(
      screen.getByRole("button", { name: "main.partialRegenerateToggle" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "capsule.openProductMenu" }),
    ).not.toBeInTheDocument();
  });

  test("disables the selection toggle when regeneration is locked", () => {
    const onToggleSelected = vi.fn();
    renderCard({
      isSelectionMode: true,
      isMobile: true,
      regenerationLockedReason: "Anchor items must stay in the capsule.",
      onToggleSelected,
    });

    const toggleButton = screen.getByRole("button", {
      name: "main.partialRegenerateToggle",
    });
    expect(toggleButton).toBeDisabled();

    fireEvent.click(toggleButton);
    expect(onToggleSelected).not.toHaveBeenCalled();
  });

  test("uses the card click for selection instead of product details in selection mode", () => {
    const onToggleSelected = vi.fn();
    const onProductClick = vi.fn();
    renderCard({
      isSelectable: true,
      isSelectionMode: true,
      onToggleSelected,
      onProductClick,
    });

    fireEvent.click(screen.getByRole("button", { name: /Red Jacket/ }));

    expect(onToggleSelected).toHaveBeenCalledWith(item);
    expect(onProductClick).not.toHaveBeenCalled();
  });

  test("renders an inline saved wardrobe icon for saved catalog items", () => {
    const { container } = renderCard({
      item: { ...item, isSavedToWardrobe: true },
    });

    expect(screen.getByLabelText("wardrobe.savedBadge")).toBeInTheDocument();
    expect(
      container.querySelector(
        ".wardrobe-card-title .wardrobe-card-bookmark-icon",
      ),
    ).toBeInTheDocument();
    const titleHtml = container.querySelector(
      ".wardrobe-card-title",
    )?.innerHTML;
    expect(titleHtml?.indexOf("wardrobe-card-saved-icon")).toBeLessThan(
      titleHtml?.indexOf("Red Jacket") ?? 0,
    );
  });

  test("renders an inline photo camera icon for uploaded personal items", () => {
    const { container } = renderCard({
      item: { ...item, source: "uploaded" },
    });

    expect(screen.getByLabelText("wardrobe.savedBadge")).toBeInTheDocument();
    expect(
      container.querySelector(
        ".wardrobe-card-title .wardrobe-card-uploaded-icon",
      ),
    ).toBeInTheDocument();
    expect(
      container.querySelector(
        ".wardrobe-card-title .wardrobe-card-bookmark-icon",
      ),
    ).not.toBeInTheDocument();
    const titleHtml = container.querySelector(
      ".wardrobe-card-title",
    )?.innerHTML;
    expect(titleHtml?.indexOf("wardrobe-card-uploaded-icon")).toBeLessThan(
      titleHtml?.indexOf("Red Jacket") ?? 0,
    );
  });

  test("keeps the inline photo camera icon when uploaded items are annotated as unsaved catalog URLs", () => {
    const { container } = renderCard({
      item: {
        ...item,
        source: "uploaded",
        url: "https://images.example.com/uploaded-product-photo.jpg",
        isSavedToWardrobe: false,
      },
    });

    expect(screen.getByLabelText("wardrobe.savedBadge")).toBeInTheDocument();
    expect(
      container.querySelector(
        ".wardrobe-card-title .wardrobe-card-uploaded-icon",
      ),
    ).toBeInTheDocument();
    expect(
      container.querySelector(
        ".wardrobe-card-title .wardrobe-card-bookmark-icon",
      ),
    ).not.toBeInTheDocument();
  });

  test("keeps the inline photo camera icon and shows a failed chip for failed uploaded personal items", () => {
    const { container } = renderCard({
      item: { ...item, source: "uploaded", processingStatus: "failed" },
    });

    expect(
      container.querySelector(
        ".wardrobe-card-title .wardrobe-card-uploaded-icon",
      ),
    ).toBeInTheDocument();
    expect(
      container.querySelector(
        ".wardrobe-card-title .wardrobe-card-failed-upload-icon",
      ),
    ).not.toBeInTheDocument();
    const failedChip = container.querySelector(
      ".wardrobe-card-category-failed",
    );
    expect(failedChip).toHaveTextContent("wardrobe.failedUploadBadge");
    expect(
      container.querySelector(".wardrobe-card-category-category"),
    ).not.toBeInTheDocument();
  });

  test("shows a needs review chip for uploaded personal items with needs-review status", () => {
    const { container } = renderCard({
      item: {
        ...item,
        category: null,
        season: ["summer"],
        source: "uploaded",
        processingStatus: "needs_review",
      },
    });

    const needsReviewChip = container.querySelector(
      ".wardrobe-card-category-needsReview",
    );
    expect(needsReviewChip).toHaveTextContent("wardrobe.needsReviewBadge");
    expect(
      container.querySelector(".wardrobe-card-category-category"),
    ).not.toBeInTheDocument();
  });

  test("does not show a needs review chip for ready uploaded personal items with sparse metadata", () => {
    const { container } = renderCard({
      item: {
        ...item,
        category: null,
        season: [],
        source: "uploaded",
        processingStatus: "ready",
      },
    });

    expect(
      container.querySelector(".wardrobe-card-category-needsReview"),
    ).not.toBeInTheDocument();
  });

  test("renders the product thumbnail image and opens product details from the card", async () => {
    const onProductClick = vi.fn();
    renderCard({ onProductClick });

    const image = await screen.findByRole("img", { name: item.name ?? "" });
    const digest =
      "701ef83d3205bee4cedc8663c6a2100ddeaad5bb7f5aeefbabfa58ac0d84c40a";

    expect(
      screen.queryByRole("link", { name: /Red Jacket/ }),
    ).not.toBeInTheDocument();
    expect(image).toHaveAttribute(
      "src",
      `https://assets.capsule-wardrobe.org/thumbnails/${digest}_640.webp`,
    );
    expect(image).toHaveAttribute(
      "srcset",
      `https://assets.capsule-wardrobe.org/thumbnails/${digest}_320.webp 320w, https://assets.capsule-wardrobe.org/thumbnails/${digest}_480.webp 480w, https://assets.capsule-wardrobe.org/thumbnails/${digest}_640.webp 640w`,
    );
    expect(image).toHaveAttribute(
      "sizes",
      "(max-width: 600px) calc((100vw - 48px) / 2), 285px",
    );
    expect(image).toHaveAttribute("alt", item.name);
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("decoding", "async");

    fireEvent.click(screen.getByRole("button", { name: /Red Jacket/ }));
    expect(onProductClick).toHaveBeenCalledWith(item);
  });

  test("renders colocated thumbnails for uploaded personal items", async () => {
    renderCard({
      item: {
        ...item,
        imageUrl: "https://images.example.com/wardrobe/profile/item_clean.png",
        source: "uploaded",
      },
    });

    const image = await screen.findByRole("img", { name: item.name ?? "" });
    expect(image).toHaveAttribute(
      "src",
      "https://images.example.com/wardrobe/profile/item_clean_640.webp",
    );
    expect(image).toHaveAttribute(
      "srcset",
      "https://images.example.com/wardrobe/profile/item_clean_320.webp 320w, https://images.example.com/wardrobe/profile/item_clean_480.webp 480w, https://images.example.com/wardrobe/profile/item_clean_640.webp 640w",
    );
  });

  test("falls back from thumbnails to the original image and then a 404 placeholder", async () => {
    renderCard();

    const image = await screen.findByRole("img", { name: item.name ?? "" });
    expect(image).toHaveAttribute(
      "src",
      "https://assets.capsule-wardrobe.org/thumbnails/701ef83d3205bee4cedc8663c6a2100ddeaad5bb7f5aeefbabfa58ac0d84c40a_640.webp",
    );

    fireEvent.error(image);

    await waitFor(() => {
      expect(image).toHaveAttribute("src", item.imageUrl);
    });
    expect(image).not.toHaveAttribute("srcset");

    fireEvent.error(image);
    await waitFor(() => {
      expect(screen.queryByRole("img", { name: item.name ?? "" })).toBeNull();
    });
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getAllByText("Red Jacket").length).toBeGreaterThan(0);
  });

  test("renders product title in the details area and category over the image", () => {
    const { container } = renderCard();

    const details = container.querySelector(".wardrobe-card-details");
    const title = container.querySelector(".wardrobe-card-title");
    const brand = container.querySelector(".wardrobe-card-brand");
    const category = container.querySelector(".wardrobe-card-category");

    expect(details).toContainElement(screen.getByText("Red Jacket"));
    expect(details).toContainElement(screen.getByText("Studio Nicholson"));
    expect(title).toHaveTextContent("Red Jacket");
    expect(brand).toHaveTextContent("Studio Nicholson");
    expect(brand).toHaveStyle({
      color: "var(--cw-color-product-card-muted)",
      overflow: "hidden",
    });
    expect(title).not.toHaveTextContent("options.categories.outerwear");
    expect(details).toHaveStyle({
      display: "grid",
      alignContent: "center",
      width: "100%",
    });
    expect(title).toHaveStyle({
      width: "100%",
      overflow: "hidden",
      WebkitLineClamp: "3",
      overflowWrap: "anywhere",
    });
    expect(details).not.toContainElement(
      screen.getByText("options.categories.outerwear"),
    );
    expect(category).toContainElement(
      screen.getByText("options.categories.outerwear"),
    );
    expect(category).toHaveClass("wardrobe-card-category-category");
  });

  test("renders liked indicator as a polished product-image overlay", () => {
    const { container } = renderCard({
      item: { ...item, isLiked: true },
    });

    const likedIndicator = container.querySelector(
      ".wardrobe-card-liked-indicator",
    );

    expect(screen.getByLabelText("wardrobe.likedBadge")).toBeInTheDocument();
    expect(likedIndicator).toHaveStyle({
      width: "28px",
      height: "28px",
      color: "var(--cw-color-liked-indicator, #c62828)",
    });
    expect(likedIndicator?.querySelector("svg")).toHaveStyle({
      fontSize: "17px",
      transform: "translateY(0.5px)",
    });
  });

  test("omits the brand line when the product brand is blank", () => {
    const { container } = renderCard({
      item: { ...item, brand: "   " },
    });

    expect(
      container.querySelector(".wardrobe-card-brand"),
    ).not.toBeInTheDocument();
  });

  test("moves known category icons into the mobile title prefix", () => {
    const { container } = renderCard({ isMobile: true });
    const title = container.querySelector(".wardrobe-card-title");

    expect(
      container.querySelector(".wardrobe-card-category"),
    ).not.toBeInTheDocument();
    expect(
      title?.querySelector(".wardrobe-card-title-category-prefix svg"),
    ).toBeInTheDocument();
    expect(
      title?.querySelector(
        ".wardrobe-card-title-category-prefix [aria-label='options.categories.outerwear']",
      ),
    ).toBeInTheDocument();
    expect(
      title?.querySelector(".wardrobe-card-title-separator"),
    ).toHaveTextContent("•");
    expect(title).toHaveTextContent("Red Jacket");
    expect(title).not.toHaveTextContent("options.categories.outerwear");
  });

  test("uses the hoodie icon for mobile midlayer title prefixes", () => {
    const { container } = renderCard({
      isMobile: true,
      item: {
        ...item,
        category: "midlayer",
      },
    });
    const title = container.querySelector(".wardrobe-card-title");

    expect(
      container.querySelector(".wardrobe-card-category"),
    ).not.toBeInTheDocument();
    expect(
      title?.querySelector(".wardrobe-card-title-category-prefix svg"),
    ).toBeInTheDocument();
    expect(
      title?.querySelector(
        ".wardrobe-card-title-category-prefix [aria-label='options.categories.midlayer']",
      ),
    ).toBeInTheDocument();
    expect(title).not.toHaveTextContent("options.categories.midlayer");
  });

  test("uses text category fallback in the mobile title prefix for unknown categories", () => {
    const { container } = renderCard({
      isMobile: true,
      item: {
        ...item,
        category: "unknown",
      },
    });
    const title = container.querySelector(".wardrobe-card-title");

    expect(
      container.querySelector(".wardrobe-card-category"),
    ).not.toBeInTheDocument();
    expect(
      title?.querySelector(".wardrobe-card-title-category-prefix svg"),
    ).not.toBeInTheDocument();
    expect(
      title?.querySelector(".wardrobe-card-title-category-text"),
    ).toHaveTextContent("options.categories.unknown");
    expect(
      title?.querySelector(".wardrobe-card-title-separator"),
    ).toHaveTextContent("•");
    expect(title).toHaveTextContent("Red Jacket");
  });

  test("omits the mobile title category prefix when the item has no category", () => {
    const { container } = renderCard({
      isMobile: true,
      item: {
        ...item,
        category: null,
      },
    });
    const title = container.querySelector(".wardrobe-card-title");

    expect(
      container.querySelector(".wardrobe-card-category"),
    ).not.toBeInTheDocument();
    expect(
      title?.querySelector(".wardrobe-card-title-category-prefix"),
    ).not.toBeInTheDocument();
    expect(
      title?.querySelector(".wardrobe-card-title-separator"),
    ).not.toBeInTheDocument();
    expect(title).toHaveTextContent("Red Jacket");
  });

  test("uses compact mobile typography without a visible product menu button", () => {
    const { container } = renderCard({ isSelectable: true, isMobile: true });

    const root = container.querySelector(".wardrobe-card-root");
    const details = container.querySelector(".wardrobe-card-details");
    const title = container.querySelector(".wardrobe-card-title");
    const actions = container.querySelector(".wardrobe-card-actions");

    expect(root).toHaveStyle({
      borderRadius: "0",
      boxShadow: "none",
      border: "0.5px solid var(--cw-color-product-dense-border)",
    });
    expect(details).toHaveStyle({ minHeight: "50px" });
    expect(title).toHaveStyle({
      fontSize: "13px",
      overflow: "hidden",
      WebkitLineClamp: "2",
    });
    expect(
      container.querySelector(".wardrobe-card-category"),
    ).not.toBeInTheDocument();
    expect(actions).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "capsule.openProductMenu" }),
    ).not.toBeInTheDocument();
  });

  test("uses roomier mobile typography for one-column cards", async () => {
    const { container } = renderCard({
      isSelectable: true,
      isMobile: true,
      mobileColumns: 1,
    });
    const image = await screen.findByRole("img", { name: item.name ?? "" });

    expect(container.querySelector(".wardrobe-card-root")).toHaveStyle({
      borderRadius: "var(--cw-radius-card)",
      boxShadow: "var(--cw-shadow-wardrobe-card)",
      border: "1px solid var(--cw-color-product-border)",
    });
    expect(container.querySelector(".wardrobe-card-details")).toHaveStyle({
      minHeight: "64px",
    });
    expect(container.querySelector(".wardrobe-card-title")).toHaveStyle({
      fontSize: "16px",
      lineHeight: "1.22",
    });
    expect(
      container.querySelector(".wardrobe-card-category"),
    ).not.toBeInTheDocument();
    expect(image).toHaveAttribute("sizes", "(max-width: 600px) 100vw, 285px");
  });

  test("uses tighter mobile typography for three-column cards while keeping actions touch sized", async () => {
    const { container } = renderCard({
      isSelectable: true,
      isMobile: true,
      mobileColumns: 3,
    });
    const image = await screen.findByRole("img", { name: item.name ?? "" });

    expect(container.querySelector(".wardrobe-card-root")).toHaveStyle({
      borderRadius: "0",
      boxShadow: "none",
      border: "0.5px solid var(--cw-color-product-dense-border)",
    });
    expect(container.querySelector(".wardrobe-card-details")).toHaveStyle({
      minHeight: "42px",
    });
    expect(container.querySelector(".wardrobe-card-title")).toHaveStyle({
      fontSize: "11.5px",
      lineHeight: "1.12",
    });
    expect(
      container.querySelector(".wardrobe-card-category"),
    ).not.toBeInTheDocument();
    expect(image).toHaveAttribute(
      "sizes",
      "(max-width: 600px) 33.333vw, 285px",
    );
    expect(
      screen.queryByRole("button", { name: "capsule.openProductMenu" }),
    ).not.toBeInTheDocument();
  });

  test("drops unsafe product and image urls", () => {
    const onProductClick = vi.fn();
    renderCard({
      item: {
        ...item,
        url: "javascript:alert(1)",
        imageUrl: "data:text/html,<script>alert(1)</script>",
      },
      onProductClick,
    });

    expect(
      screen.queryByRole("link", { name: /Red Jacket/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: item.name ?? "" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("Red Jacket").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Red Jacket/ }));
    expect(onProductClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: "item-1" }),
    );
  });

  test("appends unisex suffix for all-audience products", async () => {
    const onProductClick = vi.fn();
    renderCard({
      item: {
        ...item,
        audience: "all",
      },
      onProductClick,
    });

    const expectedLabel = "Red Jacket unisex";

    expect(screen.getByText("Red Jacket")).toBeInTheDocument();
    expect(screen.getByText("unisex")).toBeInTheDocument();
    const image = await screen.findByRole("img", { name: expectedLabel });
    expect(
      screen.getByRole("button", { name: /Red Jacket unisex/ }),
    ).toBeInTheDocument();
    expect(image).toHaveAttribute("alt", expectedLabel);
  });

  test("does not append unisex suffix for non-all audiences", () => {
    renderCard({
      item: {
        ...item,
        audience: "woman",
      },
    });

    expect(screen.getByText("Red Jacket")).toBeInTheDocument();
    expect(screen.queryByText("unisex")).not.toBeInTheDocument();
  });

  test("opens product menu callback for safe product URLs", () => {
    const onProductMenuOpen = vi.fn();
    const onProductClick = vi.fn();
    renderCard({ onProductMenuOpen, onProductClick });

    const menuButton = document.querySelector(".wardrobe-card-product-menu");
    fireEvent.click(menuButton as Element);

    expect(onProductMenuOpen).toHaveBeenCalledWith(
      expect.any(HTMLButtonElement),
      "https://example.com/products/red-jacket",
      expect.objectContaining({ id: "item-1" }),
      { presentation: "anchored" },
    );
    expect(onProductClick).not.toHaveBeenCalled();
  });

  test("opens product menu callback for uploaded items without safe product URLs", () => {
    const onProductMenuOpen = vi.fn();
    renderCard({
      item: {
        id: "uploaded-1",
        source: "uploaded",
        url: "wardrobe://uploaded-1",
        name: "Uploaded shirt",
        category: "top",
        imageUrl: "https://example.com/uploaded-shirt.jpg",
      },
      allowProductMenuWithoutUrl: true,
      onProductMenuOpen,
    });

    const menuButton = document.querySelector(".wardrobe-card-product-menu");
    fireEvent.click(menuButton as Element);

    expect(onProductMenuOpen).toHaveBeenCalledWith(
      expect.any(HTMLButtonElement),
      "uploaded-1",
      expect.objectContaining({ id: "uploaded-1", source: "uploaded" }),
      { presentation: "anchored" },
    );
  });

  test("opens the mobile context menu on touch long press and suppresses the follow-up click", () => {
    vi.useFakeTimers();
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: vibrate,
    });
    const onProductMenuOpen = vi.fn();
    const onProductClick = vi.fn();
    renderCard({ isMobile: true, onProductClick, onProductMenuOpen });

    const card = screen.getByRole("button", { name: /Red Jacket/ });
    vi.spyOn(card, "getBoundingClientRect").mockReturnValue({
      top: 20,
      left: 10,
      width: 120,
      height: 160,
      right: 130,
      bottom: 180,
      x: 10,
      y: 20,
      toJSON: () => ({}),
    });
    fireEvent.pointerDown(card, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 10,
      clientY: 20,
    });

    expect(card).toHaveStyle({
      transform: "scale(0.94)",
      transition: "transform 520ms linear,box-shadow 180ms ease",
    });

    act(() => {
      vi.advanceTimersByTime(520);
    });

    expect(vibrate).toHaveBeenCalledWith(10);
    expect(onProductMenuOpen).toHaveBeenCalledWith(
      card,
      "https://example.com/products/red-jacket",
      expect.objectContaining({ id: "item-1" }),
      {
        originRect: { top: 20, left: 10, width: 120, height: 160 },
        presentation: "mobile-context",
      },
    );

    fireEvent.click(card);

    expect(onProductClick).not.toHaveBeenCalled();
  });

  test("keeps a regular mobile tap on the card as product detail navigation", () => {
    vi.useFakeTimers();
    const onProductMenuOpen = vi.fn();
    const onProductClick = vi.fn();
    renderCard({ isMobile: true, onProductClick, onProductMenuOpen });

    const card = screen.getByRole("button", { name: /Red Jacket/ });
    fireEvent.pointerDown(card, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 10,
      clientY: 20,
    });
    fireEvent.pointerUp(card, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 10,
      clientY: 20,
    });
    act(() => {
      vi.advanceTimersByTime(520);
    });
    fireEvent.click(card);

    expect(onProductClick).toHaveBeenCalledWith(item);
    expect(onProductMenuOpen).not.toHaveBeenCalled();
  });

  test("cancels mobile long press when the touch is canceled before the threshold", () => {
    vi.useFakeTimers();
    const onProductMenuOpen = vi.fn();
    renderCard({
      isMobile: true,
      onProductClick: vi.fn(),
      onProductMenuOpen,
    });

    const card = screen.getByRole("button", { name: /Red Jacket/ });
    fireEvent.pointerDown(card, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 10,
      clientY: 20,
    });
    fireEvent.pointerCancel(card, {
      pointerType: "touch",
      pointerId: 1,
    });
    act(() => {
      vi.advanceTimersByTime(520);
    });

    expect(onProductMenuOpen).not.toHaveBeenCalled();
    expect(card).toHaveStyle({ transform: "scale(1)" });
  });

  test("opens the mobile context menu from keyboard shortcuts without changing Enter behavior", () => {
    const onProductMenuOpen = vi.fn();
    const onProductClick = vi.fn();
    renderCard({ isMobile: true, onProductClick, onProductMenuOpen });

    const card = screen.getByRole("button", { name: /Red Jacket/ });
    fireEvent.keyDown(card, { key: "ContextMenu" });

    expect(onProductMenuOpen).toHaveBeenCalledWith(
      card,
      "https://example.com/products/red-jacket",
      expect.objectContaining({ id: "item-1" }),
      { presentation: "mobile-context" },
    );

    fireEvent.keyDown(card, { key: "Enter" });

    expect(onProductClick).toHaveBeenCalledWith(item);
  });

  test("opens the mobile context menu from the native context menu event", () => {
    const onProductMenuOpen = vi.fn();
    const onProductClick = vi.fn();
    renderCard({ isMobile: true, onProductClick, onProductMenuOpen });

    const card = screen.getByRole("button", { name: /Red Jacket/ });
    fireEvent.contextMenu(card);

    expect(onProductMenuOpen).toHaveBeenCalledWith(
      card,
      "https://example.com/products/red-jacket",
      expect.objectContaining({ id: "item-1" }),
      { presentation: "mobile-context" },
    );
    expect(onProductClick).not.toHaveBeenCalled();
  });

  test("expires long-press click suppression if the synthetic click is not delivered", () => {
    vi.useFakeTimers();
    const onProductMenuOpen = vi.fn();
    const onProductClick = vi.fn();
    renderCard({ isMobile: true, onProductClick, onProductMenuOpen });

    const card = screen.getByRole("button", { name: /Red Jacket/ });
    fireEvent.pointerDown(card, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 10,
      clientY: 20,
    });
    act(() => {
      vi.advanceTimersByTime(520);
      vi.advanceTimersByTime(750);
    });

    fireEvent.click(card);

    expect(onProductMenuOpen).toHaveBeenCalledTimes(1);
    expect(onProductClick).toHaveBeenCalledWith(item);
  });

  test("does not render product menu button when product URL is not safe", () => {
    const onProductMenuOpen = vi.fn();
    renderCard({
      item: {
        id: "1",
        url: "mailto:person@example.com",
        name: "Linen Shirt",
        category: "top",
      },
      onProductMenuOpen,
    });

    expect(
      screen.queryByRole("button", { name: "capsule.openProductMenu" }),
    ).not.toBeInTheDocument();
    expect(onProductMenuOpen).not.toHaveBeenCalled();
  });
});
