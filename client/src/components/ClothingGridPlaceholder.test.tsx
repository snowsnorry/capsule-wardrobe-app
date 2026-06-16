import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render } from "@testing-library/react";

import ClothingGridPlaceholder, {
  CLOTHING_GRID_FOUR_COLUMN_MIN_WIDTH,
  CLOTHING_GRID_THREE_COLUMN_MIN_WIDTH,
  ClothingPlaceholderCard,
  buildClothingGridGap,
  buildResponsiveClothingGridSx,
  buildClothingGridTemplateColumns,
  clothingGridGap,
  clothingGridTemplateColumns,
} from "./ClothingGridPlaceholder";

describe("ClothingGridPlaceholder", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the default grid wrapper with the requested number of placeholders", () => {
    const { container } = render(<ClothingGridPlaceholder count={3} />);

    expect(container.firstElementChild).toBeInTheDocument();
    expect(container.firstElementChild.childElementCount).toBe(3);
    expect(clothingGridTemplateColumns.xs).toBe("repeat(2, minmax(0, 1fr))");
    expect(clothingGridGap.xs).toBe(1.25);
  });

  test("builds custom mobile grid columns while keeping wider breakpoints stable", () => {
    expect(buildClothingGridTemplateColumns(1)).toEqual({
      xs: "repeat(1, minmax(0, 1fr))",
      sm: "repeat(2, minmax(0, 1fr))",
      lg: "repeat(2, minmax(0, 1fr))",
    });
    expect(buildClothingGridTemplateColumns(3).xs).toBe(
      "repeat(3, minmax(0, 1fr))",
    );
  });

  test("removes the mobile grid gap for two and three columns", () => {
    expect(buildClothingGridGap(1).xs).toBe(1.25);
    expect(buildClothingGridGap(2).xs).toBe(0);
    expect(buildClothingGridGap(3).xs).toBe(0);
    expect(buildClothingGridGap(3).sm).toBe(2.5);
  });

  test("builds container-based desktop grid columns with viewport fallback", () => {
    const sx = buildResponsiveClothingGridSx(2);

    expect(
      sx[`@container (min-width: ${CLOTHING_GRID_THREE_COLUMN_MIN_WIDTH}px)`],
    ).toEqual({
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    });
    expect(
      sx[`@container (min-width: ${CLOTHING_GRID_FOUR_COLUMN_MIN_WIDTH}px)`],
    ).toEqual({
      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    });
    expect(
      sx["@supports not (container-type: inline-size)"][
        "@media (min-width: 1760px)"
      ],
    ).toEqual({
      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    });
  });

  test("renders inline placeholders without the outer grid wrapper", () => {
    const { container } = render(<ClothingGridPlaceholder count={2} inline />);

    expect(container.childElementCount).toBe(2);
    expect(container.firstElementChild.childElementCount).toBeGreaterThan(0);
  });

  test("marks two and three column placeholders for dense mobile card chrome", () => {
    const { container, rerender } = render(
      <ClothingPlaceholderCard
        placeholderKey="placeholder"
        mobileColumns={3}
      />,
    );

    expect(container.firstElementChild).toHaveClass(
      "wardrobe-placeholder-card-root-dense",
    );

    rerender(
      <ClothingPlaceholderCard
        placeholderKey="placeholder"
        mobileColumns={1}
      />,
    );

    expect(container.firstElementChild).not.toHaveClass(
      "wardrobe-placeholder-card-root-dense",
    );
  });
});
