import { test, expect } from "vitest";
import {
  buildStylePreferenceArray,
  getEnabledStyleValues,
  partitionStyleValues,
} from "./stylePreferences.js";

test("partitionStyleValues groups known styles and appends unknown styles to aesthetics", () => {
  expect(
    partitionStyleValues([
      "sporty",
      "casual",
      "avant_garde",
      "military",
      "street_style",
      "smart_casual",
      "casual",
    ]),
  ).toEqual({
    core: [
      { value: "casual", disabled: false },
      { value: "smart_casual", disabled: false },
      { value: "formal", disabled: true },
      { value: "minimalistic", disabled: true },
      { value: "street_style", disabled: false },
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
      { value: "avant_garde", disabled: false },
    ],
  });
});

test("buildStylePreferenceArray removes nulls and duplicates", () => {
  expect(buildStylePreferenceArray("formal", null)).toEqual(["formal"]);
  expect(buildStylePreferenceArray("formal", "formal")).toEqual(["formal"]);
  expect(buildStylePreferenceArray("formal", "retro")).toEqual([
    "formal",
    "retro",
  ]);
});

test("getEnabledStyleValues filters out disabled options", () => {
  expect(
    getEnabledStyleValues([
      { value: "casual", disabled: false },
      { value: "formal", disabled: true },
      { value: "retro", disabled: false },
    ]),
  ).toEqual(["casual", "retro"]);
});
