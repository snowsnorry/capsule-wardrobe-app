import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import BarChart from "./BarChart";
import DonutChart from "./DonutChart";
import LineChart from "./LineChart";

class ResizeObserverMock {
  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(target: Element) {
    this.callback(
      [{ target } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }

  disconnect() {}
}

describe("tremor charts", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      return window.setTimeout(() => callback(0), 0);
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) =>
      window.clearTimeout(id),
    );
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 320,
      height: 240,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 320,
      bottom: 240,
      toJSON: () => ({}),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("BarChart exposes accessible value buttons", async () => {
    const onValueChange = vi.fn();

    render(
      <BarChart
        data={[
          {
            rawValue: "top",
            label: "Top",
            count: 4,
            color: "#123456",
            groupLabel: "Category",
            isActive: true,
          },
          {
            rawValue: "bottom",
            label: "Bottom",
            count: 2,
            color: "#abcdef",
            groupLabel: "Category",
          },
        ]}
        index="label"
        category="count"
        activeValues={["top"]}
        valueFormatter={(value) => `${value} items`}
        onValueChange={onValueChange}
      />,
    );

    await waitFor(() => {
      expect(document.querySelector(".recharts-wrapper")).toBeInTheDocument();
    });
    expect(
      Array.from(document.head.querySelectorAll("style")).some((style) =>
        style.textContent?.includes(
          ".recharts-surface:focus-visible .recharts-bar-rectangle",
        ),
      ),
    ).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Category: Top" }));

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ rawValue: "top" }),
    );

    fireEvent.focus(screen.getByRole("button", { name: "Category: Top" }));
    await waitFor(() => {
      expect(
        document.querySelector('[stroke-width="2.5"]'),
      ).toBeInTheDocument();
    });
    const focusedBar = document.querySelector('[stroke-width="2.5"]');
    expect(focusedBar).toHaveStyle({
      filter: "drop-shadow(0 0 5px rgba(28, 124, 124, 0.55)) brightness(1.08)",
    });
    expect(focusedBar).toHaveAttribute("stroke-width", "2.5");
  });

  test("DonutChart renders legend rows and omits other bucket actions", async () => {
    const onValueChange = vi.fn();

    render(
      <DonutChart
        data={[
          {
            rawValue: "blue",
            label: "Blue",
            count: 6,
            color: "#123456",
            groupLabel: "Color",
            isActive: true,
          },
          {
            rawValue: "other",
            label: "Other",
            count: 1,
            color: "#cccccc",
            groupLabel: "Color",
            isOther: true,
          },
        ]}
        index="label"
        category="count"
        activeValues={["blue"]}
        valueFormatter={(value) => `${value} items`}
        onValueChange={onValueChange}
      />,
    );

    await waitFor(() => {
      expect(document.querySelector(".recharts-wrapper")).toBeInTheDocument();
    });
    expect(
      Array.from(document.head.querySelectorAll("style")).some((style) =>
        style.textContent?.includes(
          ".recharts-surface:focus-visible .recharts-pie-sector",
        ),
      ),
    ).toBe(true);

    expect(screen.getByText("Blue")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Color: Other" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Color: Blue" }));
    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ rawValue: "blue" }),
    );

    fireEvent.focus(screen.getByRole("button", { name: "Color: Blue" }));
    await waitFor(() => {
      expect(
        document.querySelector('[stroke-width="2.5"]'),
      ).toBeInTheDocument();
    });
    const focusedSector = document.querySelector('[stroke-width="2.5"]');
    expect(focusedSector).toHaveStyle({
      filter: "drop-shadow(0 0 6px rgba(28, 124, 124, 0.55)) brightness(1.08)",
    });
    expect(focusedSector).toHaveAttribute("stroke-width", "2.5");
  });

  test("DonutChart uses dense legend layout for long visible lists", async () => {
    render(
      <DonutChart
        data={[
          ...Array.from({ length: 9 }, (_item, index) => ({
            rawValue: `brand-${index}`,
            label: `Brand ${index + 1}`,
            count: 12 - index,
            color: "#123456",
            groupLabel: "Brand",
          })),
          {
            rawValue: "other",
            label: "Other",
            count: 1,
            color: "#cccccc",
            groupLabel: "Brand",
            isOther: true,
          },
        ]}
        index="label"
        category="count"
        valueFormatter={(value) => `${value} items`}
      />,
    );

    await waitFor(() => {
      expect(document.querySelector(".recharts-wrapper")).toBeInTheDocument();
    });

    expect(screen.getByTestId("donut-legend")).toHaveAttribute(
      "data-density",
      "dense",
    );
    expect(screen.getByText("Brand 9")).toBeInTheDocument();
    expect(screen.queryByText("Other")).not.toBeInTheDocument();
  });

  test("LineChart renders without a custom label formatter", async () => {
    render(
      <LineChart
        data={[{ bucket: "10", count: 3 }]}
        index="bucket"
        category="count"
        valueFormatter={(value) => `${value} items`}
      />,
    );

    await waitFor(() => {
      expect(document.querySelector(".recharts-wrapper")).toBeInTheDocument();
    });
    expect(
      Array.from(document.head.querySelectorAll("style")).some((style) =>
        style.textContent?.includes(
          ".recharts-surface:focus-visible .recharts-area-curve",
        ),
      ),
    ).toBe(true);
  });
});
