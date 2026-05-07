import { describe, expect, test } from "vitest";
import {
  getGradientStops,
  getTooltipStyle,
  getTooltipTextStyle,
  sanitizeSvgId
} from "./chartUtils";

describe("chartUtils", () => {
  test("returns light and dark tooltip styles", () => {
    expect(getTooltipStyle(false)).toMatchObject({
      background: "rgba(255,255,255,0.98)",
      color: "#111111"
    });
    expect(getTooltipStyle(true)).toMatchObject({
      background: "rgba(0,0,0,0.96)",
      color: "#ffffff"
    });
    expect(getTooltipTextStyle(false)).toEqual({ color: "#111111" });
    expect(getTooltipTextStyle(true)).toEqual({ color: "#ffffff" });
  });

  test("extracts hex gradient stops and normalizes SVG ids", () => {
    expect(getGradientStops("linear-gradient(#fff, #123456, rgba(0,0,0,.2), #abcdef99)")).toEqual([
      "#fff",
      "#123456",
      "#abcdef99"
    ]);
    expect(getGradientStops(null)).toEqual([]);
    expect(sanitizeSvgId(" Accent Color / Summer ")).toBe("accent-color-summer");
    expect(sanitizeSvgId(null)).toBe("");
  });
});
