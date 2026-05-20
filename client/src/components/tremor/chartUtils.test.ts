import { describe, expect, test } from "vitest";
import {
  getGradientStops,
  getTooltipStyle,
  getTooltipTextStyle,
  sanitizeSvgId,
} from "./chartUtils";

describe("chartUtils", () => {
  test("returns light and dark tooltip styles", () => {
    expect(getTooltipStyle(false)).toMatchObject({
      background: "rgba(255, 253, 249, 0.98)",
      color: "#1f2933",
    });
    expect(getTooltipStyle(true)).toMatchObject({
      background: "rgba(8, 17, 17, 0.96)",
      color: "#eef5f3",
    });
    expect(getTooltipTextStyle(false)).toEqual({
      color: "#1f2933",
      fontVariantNumeric: "tabular-nums",
    });
    expect(getTooltipTextStyle(true)).toEqual({
      color: "#eef5f3",
      fontVariantNumeric: "tabular-nums",
    });
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
