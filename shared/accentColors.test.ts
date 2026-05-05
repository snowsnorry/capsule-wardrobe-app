import test from "node:test";
import assert from "node:assert/strict";
import { ACCENT_COLOR_OPTIONS } from "./accentColors.js";

test("ACCENT_COLOR_OPTIONS exports the expected ordered contract", () => {
  assert.deepEqual(ACCENT_COLOR_OPTIONS, [
    "blue",
    "green",
    "red",
    "pink",
    "yellow",
    "purple",
    "orange",
    "multiple_accent_colors"
  ]);
  assert.equal(new Set(ACCENT_COLOR_OPTIONS).size, ACCENT_COLOR_OPTIONS.length);
});
