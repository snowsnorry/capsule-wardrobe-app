import { test, expect } from "vitest";
import { ACCENT_COLOR_OPTIONS } from "./accentColors.js";

test("ACCENT_COLOR_OPTIONS exports the expected ordered contract", () => {
  expect(ACCENT_COLOR_OPTIONS).toEqual([
    "blue",
    "green",
    "red",
    "pink",
    "yellow",
    "purple",
    "orange",
    "multiple_accent_colors"
  ]);
  expect(new Set(ACCENT_COLOR_OPTIONS).size).toBe(ACCENT_COLOR_OPTIONS.length);
});
