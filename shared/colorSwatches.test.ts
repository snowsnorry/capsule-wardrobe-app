import { test, expect } from "vitest";
import en from "./i18n/en.js";
import ru from "./i18n/ru.js";
import {
  COLOR_SWATCH_KEYS,
  FALLBACK_COLOR_SWATCH_KEY,
  normalizeColorSwatchKey,
  getColorSwatchStyle,
  getPdfColorSwatchFill,
} from "./colorSwatches.js";
import { translateOption } from "./i18n/helpers.js";

type LocaleDictionary = typeof en;

for (const locale of [
  ["en", en],
  ["ru", ru],
] satisfies [string, LocaleDictionary][]) {
  test(`${locale[0]} defines accent color labels for every shared swatch key`, () => {
    const dictionary = locale[1];
    const accentColors = dictionary?.options?.accentColors || {};

    expect(Object.keys(accentColors).sort()).toEqual(
      [...COLOR_SWATCH_KEYS].sort(),
    );
  });
}

test("shared color swatches expose consistent client and pdf styles", () => {
  expect(getColorSwatchStyle("light_blue")).toEqual({ bgcolor: "#38bdf8" });
  expect(getColorSwatchStyle("light blue")).toEqual({ bgcolor: "#38bdf8" });
  expect(getPdfColorSwatchFill("light_blue")).toEqual([0.22, 0.741, 0.973]);
  expect(getPdfColorSwatchFill("light blue")).toEqual([0.22, 0.741, 0.973]);
  expect(normalizeColorSwatchKey("Light Blue")).toBe("light_blue");
  expect(getColorSwatchStyle("missing_color")).toEqual(
    getColorSwatchStyle(FALLBACK_COLOR_SWATCH_KEY),
  );
  expect(getPdfColorSwatchFill("missing_color")).toEqual(
    getPdfColorSwatchFill(FALLBACK_COLOR_SWATCH_KEY),
  );
  expect(getColorSwatchStyle("multiple_accent_colors")).toEqual(
    getColorSwatchStyle("multicolor"),
  );
  expect(getPdfColorSwatchFill("multiple_accent_colors")).toEqual(
    getPdfColorSwatchFill("multicolor"),
  );
});

test("translateOption resolves accent color aliases with spaces and casing", () => {
  expect(translateOption("accentColors", "light blue", "en")).toBe(
    "Light blue",
  );
  expect(translateOption("accentColors", "Light Blue", "ru")).toBe("Голубой");
});
