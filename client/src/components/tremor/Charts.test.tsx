import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import BarChart from "./BarChart";
import DonutChart from "./DonutChart";
import LineChart from "./LineChart";

class ResizeObserverMock {
  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(target: Element) {
    this.callback([{ target } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }

  disconnect() {}
}

describe("tremor charts", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      return window.setTimeout(() => callback(0), 0);
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => window.clearTimeout(id));
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 320,
      height: 240,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 320,
      bottom: 240,
      toJSON: () => ({})
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
          { rawValue: "top", label: "Top", count: 4, color: "#123456", groupLabel: "Category", isActive: true },
          { rawValue: "bottom", label: "Bottom", count: 2, color: "#abcdef", groupLabel: "Category" }
        ]}
        index="label"
        category="count"
        activeValues={["top"]}
        valueFormatter={(value) => `${value} items`}
        onValueChange={onValueChange}
      />
    );

    await waitFor(() => {
      expect(document.querySelector(".recharts-wrapper")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Category: Top" }));

    expect(onValueChange).toHaveBeenCalledWith(expect.objectContaining({ rawValue: "top" }));
  });

  test("DonutChart renders legend rows and omits other bucket actions", async () => {
    const onValueChange = vi.fn();

    render(
      <DonutChart
        data={[
          { rawValue: "blue", label: "Blue", count: 6, color: "#123456", groupLabel: "Color", isActive: true },
          { rawValue: "other", label: "Other", count: 1, color: "#cccccc", groupLabel: "Color", isOther: true }
        ]}
        index="label"
        category="count"
        activeValues={["blue"]}
        valueFormatter={(value) => `${value} items`}
        onValueChange={onValueChange}
      />
    );

    await waitFor(() => {
      expect(document.querySelector(".recharts-wrapper")).toBeInTheDocument();
    });

    expect(screen.getByText("Blue")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Color: Other" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Color: Blue" }));
    expect(onValueChange).toHaveBeenCalledWith(expect.objectContaining({ rawValue: "blue" }));
  });

  test("LineChart renders without a custom label formatter", async () => {
    render(
      <LineChart
        data={[{ bucket: "10", count: 3 }]}
        index="bucket"
        category="count"
        valueFormatter={(value) => `${value} items`}
      />
    );

    await waitFor(() => {
      expect(document.querySelector(".recharts-wrapper")).toBeInTheDocument();
    });
  });
});
