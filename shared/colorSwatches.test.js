import test from "node:test";
import assert from "node:assert/strict";
import en from "./i18n/en.js";
import ru from "./i18n/ru.js";
import {
  COLOR_SWATCH_KEYS,
  FALLBACK_COLOR_SWATCH_KEY,
  normalizeColorSwatchKey,
  getColorSwatchStyle,
  getPdfColorSwatchFill
} from "./colorSwatches.js";
import { translateOption } from "./i18n/helpers.js";

for (const locale of [
  ["en", en],
  ["ru", ru]
]) {
  test(`${locale[0]} defines accent color labels for every shared swatch key`, () => {
    const dictionary = locale[1];
    const accentColors = dictionary?.options?.accentColors || {};

    assert.deepEqual(
      Object.keys(accentColors).sort(),
      [...COLOR_SWATCH_KEYS].sort()
    );
  });
}

test("shared color swatches expose consistent client and pdf styles", () => {
  assert.deepEqual(getColorSwatchStyle("light_blue"), { bgcolor: "#38bdf8" });
  assert.deepEqual(getColorSwatchStyle("light blue"), { bgcolor: "#38bdf8" });
  assert.deepEqual(getPdfColorSwatchFill("light_blue"), [0.220, 0.741, 0.973]);
  assert.deepEqual(getPdfColorSwatchFill("light blue"), [0.220, 0.741, 0.973]);
  assert.equal(normalizeColorSwatchKey("Light Blue"), "light_blue");
  assert.deepEqual(
    getColorSwatchStyle("missing_color"),
    getColorSwatchStyle(FALLBACK_COLOR_SWATCH_KEY)
  );
  assert.deepEqual(
    getPdfColorSwatchFill("missing_color"),
    getPdfColorSwatchFill(FALLBACK_COLOR_SWATCH_KEY)
  );
});

test("translateOption resolves accent color aliases with spaces and casing", () => {
  assert.equal(translateOption("accentColors", "light blue", "en"), "Light blue");
  assert.equal(translateOption("accentColors", "Light Blue", "ru"), "Голубой");
});
