import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PatternSwatch } from "./PatternSwatch";

describe("PatternSwatch", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders supported pattern artwork at the default 18px size", () => {
    render(<PatternSwatch pattern="solid" />);

    const swatch = document.querySelector('[data-pattern-swatch="solid"]');
    expect(swatch).not.toBeNull();
    expect(swatch).toHaveStyle({ width: "18px", height: "18px" });
    expect(swatch).toHaveAttribute("aria-hidden", "true");
  });

  test("reserves an empty 18px slot for unsupported patterns", () => {
    render(<PatternSwatch pattern="argyle" />);

    const swatch = document.querySelector(
      '[data-pattern-swatch-empty="argyle"]',
    );
    expect(swatch).not.toBeNull();
    expect(swatch).toHaveStyle({
      width: "18px",
      height: "18px",
      visibility: "hidden",
    });
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
