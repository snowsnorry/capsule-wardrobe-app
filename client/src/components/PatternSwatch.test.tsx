import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { PatternSwatch } from "./PatternSwatch";

describe("PatternSwatch", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders supported pattern artwork at the default 20px size", () => {
    render(<PatternSwatch pattern="solid" />);

    const swatch = document.querySelector<HTMLElement>(
      '[data-pattern-swatch="solid"]',
    );
    expect(swatch).not.toBeNull();
    expect(swatch).toHaveStyle({ width: "20px", height: "20px" });
    expect(swatch).toHaveAttribute("aria-hidden", "true");
    expect(swatch?.style.backgroundImage).toContain(
      "/patterns/pattern-sprite.webp",
    );
    expect(swatch?.style.backgroundSize).toBe("140px 80px");
    expect(swatch?.style.backgroundPosition).toBe("-20px -60px");
  });

  test("positions sprite artwork for representative canonical patterns", () => {
    render(<PatternSwatch pattern="argyle" />);

    const argyle = document.querySelector<HTMLElement>(
      '[data-pattern-swatch="argyle"]',
    );
    expect(argyle).not.toBeNull();
    expect(argyle?.style.backgroundSize).toBe("140px 80px");
    expect(argyle?.style.backgroundPosition).toBe("-20px 0px");

    cleanup();
    render(<PatternSwatch pattern="zebra" />);

    const zebra = document.querySelector<HTMLElement>(
      '[data-pattern-swatch="zebra"]',
    );
    expect(zebra).not.toBeNull();
    expect(zebra?.style.backgroundSize).toBe("140px 80px");
    expect(zebra?.style.backgroundPosition).toBe("-100px -60px");
  });

  test("scales logo artwork without using a duplicate offset layer", () => {
    render(<PatternSwatch pattern="logo" />);

    const logo = document.querySelector<HTMLElement>(
      '[data-pattern-swatch="logo"]',
    );
    expect(logo).not.toBeNull();
    expect(logo?.style.backgroundSize).toBe("140px 80px");
    expect(logo?.style.backgroundPosition).toBe("-20px -40px");
    expect(
      document.querySelector("[data-pattern-swatch-layer]"),
    ).not.toBeInTheDocument();
  });

  test("renders no swatch for unsupported patterns", () => {
    const { container } = render(<PatternSwatch pattern="unsupported" />);

    expect(container.querySelector("[data-pattern-swatch]")).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });
});
