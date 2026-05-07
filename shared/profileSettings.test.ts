import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PROFILE_IMAGE_LLM,
  DEFAULT_PROFILE_LLM,
  DEFAULT_PROFILE_THEME,
  PROFILE_IMAGE_LLM_VALUES,
  PROFILE_LLM_VALUES,
  PROFILE_THEME_VALUES
} from "./profileSettings.js";

test("profile setting defaults are valid selectable values", () => {
  assert.ok(PROFILE_THEME_VALUES.includes(DEFAULT_PROFILE_THEME));
  assert.ok(PROFILE_LLM_VALUES.includes(DEFAULT_PROFILE_LLM));
  assert.ok(PROFILE_IMAGE_LLM_VALUES.includes(DEFAULT_PROFILE_IMAGE_LLM));
});

test("profile setting option lists expose supported providers", () => {
  assert.deepEqual(PROFILE_THEME_VALUES, ["system", "light", "dark"]);
  assert.ok(PROFILE_LLM_VALUES.some((value) => value.startsWith("openai:")));
  assert.ok(PROFILE_LLM_VALUES.some((value) => value.startsWith("claude:")));
  assert.ok(PROFILE_LLM_VALUES.some((value) => value.startsWith("gemini:")));
  assert.ok(PROFILE_LLM_VALUES.includes("none"));
  assert.ok(PROFILE_IMAGE_LLM_VALUES.every((value) => value.includes(":")));
});
