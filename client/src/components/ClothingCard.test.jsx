import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";

vi.mock("../i18n/useI18n.js", () => ({
  useI18n: () => ({
    t: (key) => key
  })
}));

import ClothingCard from "./ClothingCard.jsx";

const theme = createTheme();

const item = {
  id: "item-1",
  name: "Red Jacket",
  category: "outerwear",
  image_url: "https://example.com/red-jacket.jpg",
  url: "https://example.com/products/red-jacket"
};

function renderCard(props = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <ClothingCard item={item} {...props} />
    </ThemeProvider>
  );
}

describe("ClothingCard", () => {
  afterEach(() => {
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
            isMobile
            onToggleSelected={onToggleSelected}
          />
        </div>
      </ThemeProvider>
    );

    const toggleButton = screen.getByRole("button", { name: "main.partialRegenerateToggle" });
    fireEvent.click(toggleButton);

    expect(onToggleSelected).toHaveBeenCalledTimes(1);
    expect(onToggleSelected).toHaveBeenCalledWith(item);
    expect(onParentClick).not.toHaveBeenCalled();
  });

  test("keeps the toggle hidden on desktop until selected but shows it on mobile", () => {
    const { container, rerender } = renderCard({ isSelectable: true });
    const toggleButton = container.querySelector("button");

    expect(toggleButton).toBeInTheDocument();
    expect(toggleButton).not.toBeVisible();

    rerender(
      <ThemeProvider theme={theme}>
        <ClothingCard item={item} isSelectable isMobile />
      </ThemeProvider>
    );

    expect(screen.getByRole("button", { name: "main.partialRegenerateToggle" })).toBeVisible();
  });

  test("renders an outbound link with the product image and attributes", () => {
    renderCard();

    const link = screen.getByRole("link", { name: /Red Jacket/ });
    const image = screen.getByRole("img", { name: item.name });

    expect(link).toHaveAttribute("href", item.url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
    expect(image).toHaveAttribute("src", item.image_url);
    expect(image).toHaveAttribute("alt", item.name);
  });

  test("drops unsafe product and image urls", () => {
    renderCard({
      item: {
        ...item,
        url: "javascript:alert(1)",
        image_url: "data:text/html,<script>alert(1)</script>"
      }
    });

    expect(screen.queryByRole("link", { name: /Red Jacket/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: item.name })).not.toBeInTheDocument();
    expect(screen.getAllByText("Red Jacket").length).toBeGreaterThan(0);
  });
});
