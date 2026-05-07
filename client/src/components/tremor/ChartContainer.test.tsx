import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import ChartContainer from "./ChartContainer";

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

describe("ChartContainer", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("renders charts after measuring positive dimensions", async () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(
      () => undefined,
    );
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 320,
      height: 180,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 320,
      bottom: 180,
      toJSON: () => ({}),
    });

    render(
      <ChartContainer
        renderChart={({ width, height }) => <span>{`${width}x${height}`}</span>}
      >
        <span>legend</span>
      </ChartContainer>,
    );

    expect(await screen.findByText("320x180")).toBeInTheDocument();
    expect(screen.getByText("legend")).toBeInTheDocument();
  });

  test("falls back to zero dimensions when ResizeObserver is unavailable", async () => {
    vi.stubGlobal("ResizeObserver", undefined);

    render(
      <ChartContainer
        renderChart={({ width, height }) => <span>{`${width}x${height}`}</span>}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("0x0")).toBeInTheDocument();
    });
  });
});
