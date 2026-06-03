import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { chartFacetRamp } from "../../theme/themeTokens";

vi.mock("../../components/tremor/DonutChart", () => ({
  default: ({
    data,
    valueFormatter,
    onValueChange,
  }: {
    data: Array<{
      label: string;
      count: number;
      rawValue: string;
      isOther?: boolean;
    }>;
    valueFormatter: (value: number) => string;
    onValueChange: (row: { rawValue: string }) => void;
  }) => (
    <div data-testid="donut-chart">
      <span>{valueFormatter(data[0]?.count ?? 0)}</span>
      {data.map((row) =>
        row.isOther ? (
          <span key={row.rawValue}>{row.label}</span>
        ) : (
          <button
            key={row.rawValue}
            type="button"
            onClick={() => onValueChange(row)}
          >
            {row.label}
          </button>
        ),
      )}
    </div>
  ),
}));

vi.mock("../../components/tremor/BarChart", () => ({
  default: ({
    data,
    valueFormatter,
    onValueChange,
  }: {
    data: Array<{ label: string; count: number; rawValue: string }>;
    valueFormatter: (value: number) => string;
    onValueChange: (row: { rawValue: string }) => void;
  }) => (
    <div data-testid="bar-chart">
      <span>{valueFormatter(data[0]?.count ?? 0)}</span>
      <button type="button" onClick={() => onValueChange(data[0])}>
        {data[0]?.label}
      </button>
    </div>
  ),
}));

vi.mock("../../components/tremor/LineChart", () => ({
  default: ({
    data,
    valueFormatter,
    labelFormatter,
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
  ),
}));

import {
  BAR_CHART_DIMENSION_KEYS,
  CHART_DIMENSIONS,
  PriceLineChart,
  STATISTICS_FACET_COLORS,
  StatisticsBarChart,
  StatisticsDonutChart,
  formatCount,
  getColorChartFillConfig,
  getStatisticsFacetFillConfig,
} from "./StatisticsCharts";

const theme = createTheme();

function renderWithTheme(children: ReactNode) {
  return render(<ThemeProvider theme={theme}>{children}</ThemeProvider>);
}

function parseOklchColor(value: string) {
  const match = /^oklch\(([\d.]+)% ([\d.]+) ([\d.]+)\)$/.exec(value);
  if (!match) {
    throw new Error(`Unsupported OKLCH color: ${value}`);
  }

  return {
    lightness: Number(match[1]),
    chroma: Number(match[2]),
    hue: Number(match[3]),
  };
}

describe("StatisticsCharts", () => {
  afterEach(() => {
    cleanup();
  });

  test("formats counts and exposes chart dimension metadata", () => {
    expect(formatCount("en", 12345)).toBe("12,345");
    expect(BAR_CHART_DIMENSION_KEYS.has("style")).toBe(true);
    expect(
      CHART_DIMENSIONS.some((dimension) => dimension.key === "brand"),
    ).toBe(true);
  });

  test("uses a muted generic facet ramp with active color pairs", () => {
    const previousDemoColors = new Set<string>([
      "#FF6B6B",
      "#4ECDC4",
      "#FFE66D",
      "#FF9F1C",
      "#E71D36",
      "#8338EC",
      "#3A86FF",
      "#FF006E",
      "#8AC926",
      "#1982C4",
      "#F15BB5",
      "#00B4D8",
      "#9B5DE5",
      "#FFB703",
      "#38B000",
      "#E07A5F",
      "#5A189A",
      "#F4A261",
      "#014F86",
    ]);
    const tokenRampColors = chartFacetRamp.flatMap(({ color, activeColor }) => [
      color,
      activeColor,
    ]);
    const rampDefaults = chartFacetRamp.map(({ color }) =>
      parseOklchColor(color),
    );

    expect(chartFacetRamp).toHaveLength(24);
    expect(tokenRampColors.every((color) => /^oklch\(/.test(color))).toBe(true);
    expect(
      tokenRampColors.some((color) =>
        previousDemoColors.has(color.toUpperCase()),
      ),
    ).toBe(false);
    expect(new Set(tokenRampColors).size).toBe(tokenRampColors.length);
    expect(
      rampDefaults.every(({ chroma }) => chroma > 0 && chroma <= 0.1),
    ).toBe(true);
    expect(
      rampDefaults.every(
        (color, index) =>
          color.hue !== rampDefaults[(index + 1) % rampDefaults.length].hue,
      ),
    ).toBe(true);
    expect(STATISTICS_FACET_COLORS).toHaveLength(chartFacetRamp.length);
    expect(
      STATISTICS_FACET_COLORS.every(
        ({ color, activeColor }, index) =>
          color === `var(--cw-chart-facet-${index})` &&
          activeColor === `var(--cw-chart-facet-active-${index})`,
      ),
    ).toBe(true);
    expect(getStatisticsFacetFillConfig(24)).toEqual(
      STATISTICS_FACET_COLORS[0],
    );
  });

  test("builds donut data with active and summarized values", async () => {
    const user = userEvent.setup();
    const onToggleValue = vi.fn();
    const rows = Array.from({ length: 22 }, (_item, index) => ({
      value: `value-${index}`,
      count: 30 - index,
    }));

    renderWithTheme(
      <StatisticsDonutChart
        title="Brand"
        subtitle="By brand"
        rows={rows}
        activeValues={["value-0"]}
        onToggleValue={onToggleValue}
        formatLabel={(value) =>
          value === "__other__" ? "Other" : `Label ${value}`
        }
        locale="en"
      />,
    );

    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("Label value-19")).toBeInTheDocument();
    expect(screen.queryByText("Label value-20")).not.toBeInTheDocument();
    expect(screen.getByText("Other")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Label value-0" }));
    expect(onToggleValue).toHaveBeenCalledWith("value-0");
  });

  test("builds bar chart data from valid rows and fill config", async () => {
    const user = userEvent.setup();
    const onToggleValue = vi.fn();
    const getFillConfig = vi.fn((value: string) => ({
      color: value === "blue" ? "#3A86FF" : "#94a3b8",
    }));

    renderWithTheme(
      <StatisticsBarChart
        title="Colors"
        subtitle="By color"
        rows={[
          { value: "blue", count: 8 },
          { value: "", count: 3 },
          { value: "white", count: 0 },
        ]}
        activeValues={["blue"]}
        onToggleValue={onToggleValue}
        formatLabel={(value) => value.toUpperCase()}
        locale="en"
        getFillConfig={getFillConfig}
      />,
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
          { key: "20:30", min: 20, max: 30, count: 6 },
        ]}
      />,
    );

    expect(screen.getByText("15")).toBeInTheDocument();
    expect(getColorChartFillConfig("blue")).toMatchObject({
      color: expect.any(String),
    });
    expect(getColorChartFillConfig("unknown-color")).toMatchObject({
      color: "url(#statistics-color-bar-unknown-color)",
      gradientId: "statistics-color-bar-unknown-color",
    });
  });

  test("uses the theme fallback swatch when a color style has no usable fill", async () => {
    vi.resetModules();
    vi.doMock("../../../../shared/colorSwatches.js", () => ({
      getColorSwatchStyle: () => ({
        background: "linear-gradient(rgba(0,0,0,.2), rgba(0,0,0,.1))",
      }),
    }));

    try {
      const { getColorChartFillConfig: getMockedColorChartFillConfig } =
        await import("./StatisticsCharts");

      expect(getMockedColorChartFillConfig("empty")).toEqual({
        color: "var(--cw-chart-fallback-swatch)",
      });
    } finally {
      vi.doUnmock("../../../../shared/colorSwatches.js");
      vi.resetModules();
    }
  });
});
