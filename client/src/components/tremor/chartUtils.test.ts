import { describe, expect, test } from "vitest";
import {
  getChartFocusFilter,
  getChartTheme,
  getGradientStops,
  getTooltipStyle,
  getTooltipTextStyle,
  sanitizeSvgId,
} from "./chartUtils";

describe("chartUtils", () => {
  test("returns light and dark tooltip styles", () => {
    const chartTheme = getChartTheme(false);

    expect(getTooltipStyle(false)).toMatchObject({
      background: chartTheme.tooltipBg,
      border: `1px solid ${chartTheme.tooltipBorder}`,
      boxShadow: chartTheme.tooltipShadow,
      color: chartTheme.tooltipInk,
    });
    expect(getTooltipStyle(true)).toMatchObject(getTooltipStyle(false));
    expect(getTooltipTextStyle(false)).toEqual({
      color: chartTheme.tooltipInk,
      fontVariantNumeric: "tabular-nums",
    });
    expect(getTooltipTextStyle(true)).toEqual(getTooltipTextStyle(false));
  });

  test("builds chart focus filters from centralized glow values", () => {
    const chartTheme = getChartTheme();

    expect(
      getChartFocusFilter({
        blur: 4,
        glow: chartTheme.focusSoftGlow,
        brightness: 1.04,
      }),
    ).toBe(
      "drop-shadow(0 0 4px var(--cw-chart-focus-soft-glow)) brightness(1.04)",
    );
    expect(getChartFocusFilter({ blur: 6, brightness: 1.08 })).toBe(
      "drop-shadow(0 0 6px var(--cw-chart-focus-glow)) brightness(1.08)",
    );
  });

  test("extracts hex gradient stops and normalizes SVG ids", () => {
    expect(
      getGradientStops(
        "linear-gradient(#fff, #123456, rgba(0,0,0,.2), #abcdef99)",
      ),
    ).toEqual(["#fff", "#123456", "#abcdef99"]);
    expect(getGradientStops(null)).toEqual([]);
    expect(sanitizeSvgId(" Accent Color / Summer ")).toBe(
      "accent-color-summer",
    );
    expect(sanitizeSvgId(null)).toBe("");
  });
});
