const PROFILE_THEME_VALUES = ["system", "light", "dark"] as const;
const PROFILE_LLM_VALUES = [
  "openai:gpt-5.5",
  "claude:claude-opus-4-7",
  "gemini:gemini-2.5-pro",
  "deepinfra:Qwen/Qwen3-VL-235B-A22B-Instruct",
  "deepinfra:google/gemma-4-31B-it",
  "none"
] as const;
const PROFILE_IMAGE_LLM_VALUES = [
  "openai:gpt-image-2",
  "gemini:gemini-3-pro-image-preview"
] as const;

const DEFAULT_PROFILE_THEME = "system";
const DEFAULT_PROFILE_LLM = "openai:gpt-5.5";
const DEFAULT_PROFILE_IMAGE_LLM = "openai:gpt-image-2";

export {
  PROFILE_THEME_VALUES,
  PROFILE_LLM_VALUES,
  PROFILE_IMAGE_LLM_VALUES,
  DEFAULT_PROFILE_THEME,
  DEFAULT_PROFILE_LLM,
  DEFAULT_PROFILE_IMAGE_LLM
};
