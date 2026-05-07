import { test, expect } from "vitest";
import {
  DEFAULT_PROFILE_IMAGE_LLM,
  DEFAULT_PROFILE_LLM,
  DEFAULT_PROFILE_THEME,
  PROFILE_IMAGE_LLM_VALUES,
  PROFILE_LLM_VALUES,
  PROFILE_THEME_VALUES,
} from "./profileSettings.js";

test("profile setting defaults are valid selectable values", () => {
  expect(PROFILE_THEME_VALUES.includes(DEFAULT_PROFILE_THEME)).toBeTruthy();
  expect(PROFILE_LLM_VALUES.includes(DEFAULT_PROFILE_LLM)).toBeTruthy();
  expect(
    PROFILE_IMAGE_LLM_VALUES.includes(DEFAULT_PROFILE_IMAGE_LLM),
  ).toBeTruthy();
});

test("profile setting option lists expose supported providers", () => {
  expect(PROFILE_THEME_VALUES).toEqual(["system", "light", "dark"]);
  expect(
    PROFILE_LLM_VALUES.some((value) => value.startsWith("openai:")),
  ).toBeTruthy();
  expect(
    PROFILE_LLM_VALUES.some((value) => value.startsWith("claude:")),
  ).toBeTruthy();
  expect(
    PROFILE_LLM_VALUES.some((value) => value.startsWith("gemini:")),
  ).toBeTruthy();
  expect(PROFILE_LLM_VALUES.includes("none")).toBeTruthy();
  expect(
    PROFILE_IMAGE_LLM_VALUES.every((value) => value.includes(":")),
  ).toBeTruthy();
});
