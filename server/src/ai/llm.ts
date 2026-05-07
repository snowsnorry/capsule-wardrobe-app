import { generateJsonWithLlm as generateJsonWithClaude } from "./claude.js";
import { generateJsonWithLlm as generateJsonWithDeepInfra } from "./deepinfra.js";
import { generateJsonWithLlm as generateJsonWithGemini } from "./gemini.js";
import { generateJsonWithLlm as generateJsonWithOpenAi } from "./openai.js";
import { resolveLlmProvider } from "./llmPrompts.js";

function getGenerateJsonWithLlm(userProfile = null) {
  const resolved = resolveLlmProvider(userProfile);

  if (resolved.mode === "none") {
    return null;
  }

  return resolved.provider === "deepinfra"
    ? generateJsonWithDeepInfra
    : resolved.provider === "claude"
      ? generateJsonWithClaude
      : resolved.provider === "gemini"
        ? generateJsonWithGemini
        : generateJsonWithOpenAi;
}

export {
  CLAUDE_ALLOWED_MODELS,
  GEMINI_PROFILE_LLM,
  buildCapsuleSchema,
  buildCustomJsonObjectFormat,
  buildSwimwearSchema,
  buildSystemPrompt,
  isNoLlmProfileEnabled,
  resolveLlmProvider,
  splitSystemAndUserPrompt,
} from "./llmPrompts.js";

export { getGenerateJsonWithLlm };
