import test from "node:test";
import assert from "node:assert/strict";
import {
  buildStylePreferenceArray,
  getEnabledStyleValues,
  inferStyleSelections,
  partitionStyleValues
} from "./stylePreferences.js";

test("partitionStyleValues groups known styles and appends unknown styles to aesthetics", () => {
  assert.deepEqual(
    partitionStyleValues([
      "sporty",
      "casual",
      "avant_garde",
      "military",
      "street_style",
      "smart_casual",
      "casual"
    ]),
    {
      core: [
        { value: "casual", disabled: false },
        { value: "smart_casual", disabled: false },
        { value: "formal", disabled: true },
        { value: "minimalistic", disabled: true },
        { value: "street_style", disabled: false }
      ],
      aesthetics: [
        { value: "romantic", disabled: true },
        { value: "preppy", disabled: true },
        { value: "retro", disabled: true },
        { value: "boho", disabled: true },
        { value: "nautical", disabled: true },
        { value: "safari", disabled: true },
        { value: "equestrian", disabled: true },
        { value: "military", disabled: false },
        { value: "grunge", disabled: true },
        { value: "sporty", disabled: false },
        { value: "avant_garde", disabled: false }
      ]
    }
  );
});

test("inferStyleSelections extracts core and aesthetics from legacy style arrays", () => {
  assert.deepEqual(
    inferStyleSelections(["retro", "formal", "avant_garde"]),
    { styleCore: "formal", styleAesthetic: "retro" }
  );
  assert.deepEqual(
    inferStyleSelections(["avant_garde"]),
    { styleCore: null, styleAesthetic: "avant_garde" }
  );
});

test("buildStylePreferenceArray removes nulls and duplicates", () => {
  assert.deepEqual(buildStylePreferenceArray("formal", null), ["formal"]);
  assert.deepEqual(buildStylePreferenceArray("formal", "formal"), ["formal"]);
  assert.deepEqual(buildStylePreferenceArray("formal", "retro"), ["formal", "retro"]);
});

test("getEnabledStyleValues filters out disabled options", () => {
  assert.deepEqual(
    getEnabledStyleValues([
      { value: "casual", disabled: false },
      { value: "formal", disabled: true },
      { value: "retro", disabled: false }
    ]),
    ["casual", "retro"]
  );
});
