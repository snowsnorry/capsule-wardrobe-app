import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render } from "@testing-library/react";

import ClothingGridPlaceholder, { clothingGridGap, clothingGridTemplateColumns } from "./ClothingGridPlaceholder";

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

  test("renders inline placeholders without the outer grid wrapper", () => {
    const { container } = render(<ClothingGridPlaceholder count={2} inline />);

    expect(container.childElementCount).toBe(2);
    expect(container.firstElementChild.childElementCount).toBeGreaterThan(0);
  });
});
