import { DEFAULT_PROFILE_LLM } from "../../../shared/profileSettings.js";
import { generateJsonWithLlm as generateJsonWithOpenAi } from "./openai.js";
import { generateJsonWithLlm as generateJsonWithDeepInfra } from "./deepinfra.js";
import { generateJsonWithLlm as generateJsonWithGemini } from "./gemini.js";

const OPENAI_PROFILE_LLM = "openai:gpt-5.2";
const GEMINI_PROFILE_LLM = "gemini:gemini-2.5-pro";
const DEEPINFRA_ALLOWED_MODELS = [
  "google/gemma-4-31B-it",
  "Qwen/Qwen3-VL-235B-A22B-Instruct"
];

function getProfileLlm(userProfile = null) {
  const llm = String(userProfile?.llm || "").trim();
  return llm || DEFAULT_PROFILE_LLM;
}

function isNoLlmProfileEnabled(userProfile = null) {
  return getProfileLlm(userProfile) === "none";
}

function resolveLlmProvider(userProfile = null) {
  const llm = getProfileLlm(userProfile);

  if (llm === "none") {
    return {
      mode: "none",
      llm,
      requestedLlm: llm
    };
  }

  if (llm === OPENAI_PROFILE_LLM) {
    return {
      provider: "openai",
      model: "gpt-5.2",
      llm,
      requestedLlm: llm
    };
  }

  if (llm === GEMINI_PROFILE_LLM) {
    return {
      provider: "gemini",
      model: "gemini-2.5-pro",
      llm,
      requestedLlm: llm
    };
  }

  if (llm.startsWith("deepinfra:")) {
    const model = llm.slice("deepinfra:".length).trim();
    if (DEEPINFRA_ALLOWED_MODELS.includes(model)) {
      return {
        provider: "deepinfra",
        model,
        llm,
        requestedLlm: llm
      };
    }
  }

  console.warn("[wardrobe-ai][llm-unknown-model]", JSON.stringify({
    requestedLlm: llm,
    fallbackProvider: "openai",
    fallbackModel: "gpt-5.2"
  }));

  return {
    provider: "openai",
    model: "gpt-5.2",
    llm: OPENAI_PROFILE_LLM,
    requestedLlm: llm,
    fallbackReason: "unknown_model"
  };
}

function getGenerateJsonWithLlm(userProfile = null) {
  const resolved = resolveLlmProvider(userProfile);

  if (resolved.mode === "none") {
    return null;
  }

  return resolved.provider === "deepinfra"
    ? generateJsonWithDeepInfra
    : resolved.provider === "gemini"
      ? generateJsonWithGemini
      : generateJsonWithOpenAi;
}

export {
  DEEPINFRA_ALLOWED_MODELS,
  GEMINI_PROFILE_LLM,
  OPENAI_PROFILE_LLM,
  getGenerateJsonWithLlm,
  getProfileLlm,
  isNoLlmProfileEnabled,
  resolveLlmProvider
};
