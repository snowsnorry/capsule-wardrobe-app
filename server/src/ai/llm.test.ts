import { test, expect } from "vitest";
import {
  CLAUDE_ALLOWED_MODELS,
  GEMINI_PROFILE_LLM,
  getGenerateJsonWithLlm,
} from "./llm.js";
import { generateJsonWithLlm as generateJsonWithClaude } from "./claude.js";
import { generateJsonWithLlm as generateJsonWithDeepInfra } from "./deepinfra.js";
import { generateJsonWithLlm as generateJsonWithGemini } from "./gemini.js";
import { generateJsonWithLlm as generateJsonWithOpenAi } from "./openai.js";

test("getGenerateJsonWithLlm returns provider-specific generator", () => {
  expect(getGenerateJsonWithLlm({ llm: "openai:gpt-5.5" })).toBe(
    generateJsonWithOpenAi,
  );
  expect(
    getGenerateJsonWithLlm({ llm: `claude:${CLAUDE_ALLOWED_MODELS[0]}` }),
  ).toBe(generateJsonWithClaude);
  expect(getGenerateJsonWithLlm({ llm: GEMINI_PROFILE_LLM })).toBe(
    generateJsonWithGemini,
  );
  expect(
    getGenerateJsonWithLlm({
      llm: "deepinfra:Qwen/Qwen3-VL-235B-A22B-Instruct",
    }),
  ).toBe(generateJsonWithDeepInfra);
  expect(getGenerateJsonWithLlm({ llm: "none" })).toBe(null);
});
