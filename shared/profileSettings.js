const PROFILE_THEME_VALUES = ["system", "light", "dark"];
const PROFILE_LLM_VALUES = [
  "openai:gpt-5",
  "deepinfra:Qwen/Qwen3-VL-235B-A22B-Instruct",
  "deepinfra:google/gemma-3-27b-it",
  "none"
];

const DEFAULT_PROFILE_THEME = "system";
const DEFAULT_PROFILE_LLM = "openai:gpt-5";

export {
  PROFILE_THEME_VALUES,
  PROFILE_LLM_VALUES,
  DEFAULT_PROFILE_THEME,
  DEFAULT_PROFILE_LLM
};
