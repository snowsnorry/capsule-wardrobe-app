import { DEFAULT_PROFILE_LLM } from "../../../shared/profileSettings.js";
import { logWarn } from "../logger.js";

const OPENAI_PROFILE_LLM = "openai:gpt-5.5";
const CLAUDE_ALLOWED_MODELS = ["claude-opus-4-7"];
const GEMINI_PROFILE_LLM = "gemini:gemini-2.5-pro";
const DEEPINFRA_ALLOWED_MODELS = [
  "google/gemma-4-31B-it",
  "Qwen/Qwen3-VL-235B-A22B-Instruct",
];

type LlmProviderResolution = {
  fallbackReason?: string;
  llm: string;
  mode?: "none";
  model?: string;
  provider?: "claude" | "deepinfra" | "gemini" | "openai";
  requestedLlm: string;
};

function getProfileLlm(userProfile = null) {
  const llm = String(userProfile?.llm || "").trim();
  return llm || DEFAULT_PROFILE_LLM;
}

function isNoLlmProfileEnabled(userProfile = null) {
  return getProfileLlm(userProfile) === "none";
}

function resolveKnownPrefixedProvider({
  llm,
  prefix,
  allowedModels,
  provider,
}: {
  llm: string;
  prefix: string;
  allowedModels: string[];
  provider: "claude" | "deepinfra";
}): LlmProviderResolution | null {
  if (!llm.startsWith(prefix)) {
    return null;
  }

  const model = llm.slice(prefix.length).trim();
  return allowedModels.includes(model)
    ? { provider, model, llm, requestedLlm: llm }
    : null;
}

function resolveBuiltInProvider(llm: string): LlmProviderResolution | null {
  if (llm === "none") {
    return { mode: "none", llm, requestedLlm: llm };
  }

  if (llm === OPENAI_PROFILE_LLM) {
    return { provider: "openai", model: "gpt-5.5", llm, requestedLlm: llm };
  }

  if (llm === GEMINI_PROFILE_LLM) {
    return {
      provider: "gemini",
      model: "gemini-2.5-pro",
      llm,
      requestedLlm: llm,
    };
  }

  return null;
}

function resolveLlmProvider(userProfile = null): LlmProviderResolution {
  const llm = getProfileLlm(userProfile);
  const resolvedProvider =
    resolveBuiltInProvider(llm) ||
    resolveKnownPrefixedProvider({
      llm,
      prefix: "claude:",
      allowedModels: CLAUDE_ALLOWED_MODELS,
      provider: "claude",
    }) ||
    resolveKnownPrefixedProvider({
      llm,
      prefix: "deepinfra:",
      allowedModels: DEEPINFRA_ALLOWED_MODELS,
      provider: "deepinfra",
    });

  if (resolvedProvider) {
    return resolvedProvider;
  }

  logWarn(
    "[wardrobe-ai][llm-unknown-model]",
    JSON.stringify({
      requestedLlm: llm,
      fallbackProvider: "openai",
      fallbackModel: "gpt-5.5",
    }),
  );

  return {
    provider: "openai",
    model: "gpt-5.5",
    llm: OPENAI_PROFILE_LLM,
    requestedLlm: llm,
    fallbackReason: "unknown_model",
  };
}

export {
  CLAUDE_ALLOWED_MODELS,
  DEEPINFRA_ALLOWED_MODELS,
  GEMINI_PROFILE_LLM,
  OPENAI_PROFILE_LLM,
  getProfileLlm,
  isNoLlmProfileEnabled,
  resolveLlmProvider,
};
