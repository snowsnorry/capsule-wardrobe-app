import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";

vi.mock("./ChartContainer", () => ({
  default: ({ children, renderChart }: { children?: ReactNode; renderChart: (size: { width: number; height: number }) => ReactNode }) => (
    <div>
      {children}
      {renderChart({ width: 320, height: 240 })}
    </div>
  )
}));

vi.mock("recharts", () => {
  return {
    Area: () => <path data-testid="area" />,
    AreaChart: ({ children }: { children?: ReactNode }) => <svg data-testid="line-plot">{children}</svg>,
    Bar: ({ children, onClick }: { children?: ReactNode; onClick?: (entry: unknown) => void }) => (
      <g data-testid="bar-series">
        {children}
        <foreignObject>
          <button type="button" onClick={() => onClick?.({ rawValue: "top", label: "Top", count: 4 })}>valid-bar</button>
          <button type="button" onClick={() => onClick?.({ label: "Missing raw value" })}>invalid-bar</button>
        </foreignObject>
      </g>
    ),
    BarChart: ({ children }: { children?: ReactNode }) => <svg data-testid="bar-plot">{children}</svg>,
    CartesianGrid: () => <g data-testid="grid" />,
    Cell: ({ fill, fillOpacity, stroke }: { fill?: string; fillOpacity?: number; stroke?: string }) => (
      <rect data-testid="cell" data-fill={fill} data-opacity={String(fillOpacity)} data-stroke={stroke} />
    ),
    Tooltip: ({
      formatter,
      labelFormatter
    }: {
      formatter: (value: number | string, name: string, item: { payload?: Record<string, unknown> }) => [string, string];
      labelFormatter: () => string;
    }) => {
      const [value, label] = formatter(5, "count", { payload: { label: "Top", bucket: "10" } });
      return (
        <foreignObject>
          <div data-testid="tooltip">
            <span>{value}</span>
            <span>{label}</span>
            <span>{labelFormatter()}</span>
          </div>
        </foreignObject>
      );
    },
    XAxis: ({ tick }: { tick?: (props: { x: number; y: number; payload: { value: string } }) => ReactNode }) => (
      <g data-testid="x-axis">
        {typeof tick === "function" ? tick({ x: 1, y: 2, payload: { value: "Top" } }) : null}
        {typeof tick === "function" ? tick({ x: 3, y: 4, payload: { value: "Bottom" } }) : null}
      </g>
    ),
    YAxis: () => <g data-testid="y-axis" />
  };
});

import BarChart from "./BarChart";
import LineChart from "./LineChart";

const lightTheme = createTheme();
const darkTheme = createTheme({ palette: { mode: "dark" } });

function renderWithTheme(children: ReactNode, theme = lightTheme) {
  return render(<ThemeProvider theme={theme}>{children}</ThemeProvider>);
}

describe("tremor chart recharts callbacks", () => {
  afterEach(() => {
    cleanup();
  });

  test("BarChart executes tooltip, axis, gradient, cell, and click callbacks", () => {
    const onValueChange = vi.fn();
    renderWithTheme(
      <BarChart
        data={[
          {
            rawValue: "top",
            label: "Top",
            count: 4,
            color: "url(#top-gradient)",
            groupLabel: "Category",
            isActive: true,
            gradientId: "top-gradient",
            gradientStops: ["#111111", "#222222", "#333333"]
          },
          { rawValue: "bottom", label: "Bottom", count: 2, color: "#abcdef", groupLabel: "Category" }
        ]}
        index="label"
        category="count"
        activeValues={["top"]}
        valueFormatter={(value) => `${value} items`}
        onValueChange={onValueChange}
      />
    );

    expect(screen.getByText("5 items")).toBeInTheDocument();
    expect(screen.getAllByTestId("cell")[0]).toHaveAttribute("data-opacity", "1");
    expect(screen.getAllByTestId("cell")[1]).toHaveAttribute("data-opacity", "0.46");

    fireEvent.click(screen.getByRole("button", { name: "valid-bar" }));
    fireEvent.click(screen.getByRole("button", { name: "invalid-bar" }));

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(expect.objectContaining({ rawValue: "top" }));
  });

  test("LineChart executes custom and fallback tooltip formatters in light and dark themes", () => {
    renderWithTheme(
      <LineChart
        data={[{ bucket: "10", label: "Ten", count: 5 }]}
        index="bucket"
        category="count"
        valueFormatter={(value) => `${value} items`}
        labelFormatter={(row) => `bucket ${String(row?.bucket || "")}`}
      />
    );

    expect(screen.getByText("bucket 10")).toBeInTheDocument();

    cleanup();
    renderWithTheme(
      <LineChart
        data={[{ bucket: "20", count: 5 }]}
        index="bucket"
        category="count"
        valueFormatter={(value) => `${value} items`}
      />,
      darkTheme
    );

    expect(screen.getByText("10 EUR")).toBeInTheDocument();
  });
});
