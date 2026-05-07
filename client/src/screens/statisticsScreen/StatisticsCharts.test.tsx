import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";

vi.mock("../../components/tremor/DonutChart", () => ({
  default: ({
    data,
    valueFormatter,
    onValueChange
  }: {
    data: Array<{ label: string; count: number; rawValue: string; isOther?: boolean }>;
    valueFormatter: (value: number) => string;
    onValueChange: (row: { rawValue: string }) => void;
  }) => (
    <div data-testid="donut-chart">
      <span>{valueFormatter(data[0]?.count ?? 0)}</span>
      <button type="button" onClick={() => onValueChange(data[0])}>{data[0]?.label}</button>
      <span>{data.find((row) => row.isOther)?.label}</span>
    </div>
  )
}));

vi.mock("../../components/tremor/BarChart", () => ({
  default: ({
    data,
    valueFormatter,
    onValueChange
  }: {
    data: Array<{ label: string; count: number; rawValue: string }>;
    valueFormatter: (value: number) => string;
    onValueChange: (row: { rawValue: string }) => void;
  }) => (
    <div data-testid="bar-chart">
      <span>{valueFormatter(data[0]?.count ?? 0)}</span>
      <button type="button" onClick={() => onValueChange(data[0])}>{data[0]?.label}</button>
    </div>
  )
}));

vi.mock("../../components/tremor/LineChart", () => ({
  default: ({
    data,
    valueFormatter,
    labelFormatter
  }: {
    data: Array<{ label: string; count: number }>;
    valueFormatter: (value: number) => string;
    labelFormatter: (row?: { label?: string }) => string;
  }) => (
    <div data-testid="line-chart">
      <span>{valueFormatter(data[0]?.count ?? 0)}</span>
      <span>{labelFormatter(data[0])}</span>
      <span>{labelFormatter(undefined)}</span>
    </div>
  )
}));

import {
  BAR_CHART_DIMENSION_KEYS,
  CHART_DIMENSIONS,
  PriceLineChart,
  StatisticsBarChart,
  StatisticsDonutChart,
  formatCount,
  getColorChartFillConfig
} from "./StatisticsCharts";

const theme = createTheme();

function renderWithTheme(children: ReactNode) {
  return render(<ThemeProvider theme={theme}>{children}</ThemeProvider>);
}

describe("StatisticsCharts", () => {
  afterEach(() => {
    cleanup();
  });

  test("formats counts and exposes chart dimension metadata", () => {
    expect(formatCount("en", 12345)).toBe("12,345");
    expect(BAR_CHART_DIMENSION_KEYS.has("style")).toBe(true);
    expect(CHART_DIMENSIONS.some((dimension) => dimension.key === "brand")).toBe(true);
  });

  test("builds donut data with active and summarized values", async () => {
    const user = userEvent.setup();
    const onToggleValue = vi.fn();
    const rows = Array.from({ length: 14 }, (_item, index) => ({
      value: `value-${index}`,
      count: 20 - index
    }));

    renderWithTheme(
      <StatisticsDonutChart
        title="Brand"
        subtitle="By brand"
        rows={rows}
        activeValues={["value-0"]}
        onToggleValue={onToggleValue}
        formatLabel={(value) => (value === "__other__" ? "Other" : `Label ${value}`)}
        locale="en"
      />
    );

    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("Other")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Label value-0" }));
    expect(onToggleValue).toHaveBeenCalledWith("value-0");
  });

  test("builds bar chart data from valid rows and fill config", async () => {
    const user = userEvent.setup();
    const onToggleValue = vi.fn();
    const getFillConfig = vi.fn((value: string) => ({
      color: value === "blue" ? "#3A86FF" : "#94a3b8"
    }));

    renderWithTheme(
      <StatisticsBarChart
        title="Colors"
        subtitle="By color"
        rows={[
          { value: "blue", count: 8 },
          { value: "", count: 3 },
          { value: "white", count: 0 }
        ]}
        activeValues={["blue"]}
        onToggleValue={onToggleValue}
        formatLabel={(value) => value.toUpperCase()}
        locale="en"
        getFillConfig={getFillConfig}
      />
    );

    expect(getFillConfig).toHaveBeenCalledWith("blue", 0);
    await user.click(screen.getByRole("button", { name: "BLUE" }));
    expect(onToggleValue).toHaveBeenCalledWith("blue");
  });

  test("builds price line chart labels and color fill configs", () => {
    renderWithTheme(
      <PriceLineChart
        title="Prices"
        subtitle="By bucket"
        locale="en"
        buckets={[
          { key: "10:20", min: 10, max: 20, count: 4 },
          { key: "20:30", min: 20, max: 30, count: 6 }
        ]}
      />
    );

    expect(screen.getByText("15")).toBeInTheDocument();
    expect(getColorChartFillConfig("blue")).toMatchObject({ color: expect.any(String) });
    expect(getColorChartFillConfig("unknown-color")).toMatchObject({
      color: "url(#statistics-color-bar-unknown-color)",
      gradientId: "statistics-color-bar-unknown-color"
    });
  });
});
