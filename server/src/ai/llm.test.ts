import test from "node:test";
import assert from "node:assert/strict";
import {
  CLAUDE_ALLOWED_MODELS,
  GEMINI_PROFILE_LLM,
  getGenerateJsonWithLlm
} from "./llm.js";
import { generateJsonWithLlm as generateJsonWithClaude } from "./claude.js";
import { generateJsonWithLlm as generateJsonWithDeepInfra } from "./deepinfra.js";
import { generateJsonWithLlm as generateJsonWithGemini } from "./gemini.js";
import { generateJsonWithLlm as generateJsonWithOpenAi } from "./openai.js";

test("getGenerateJsonWithLlm returns provider-specific generator", () => {
  assert.equal(getGenerateJsonWithLlm({ llm: "openai:gpt-5.5" }), generateJsonWithOpenAi);
  assert.equal(getGenerateJsonWithLlm({ llm: `claude:${CLAUDE_ALLOWED_MODELS[0]}` }), generateJsonWithClaude);
  assert.equal(getGenerateJsonWithLlm({ llm: GEMINI_PROFILE_LLM }), generateJsonWithGemini);
  assert.equal(getGenerateJsonWithLlm({ llm: "deepinfra:Qwen/Qwen3-VL-235B-A22B-Instruct" }), generateJsonWithDeepInfra);
  assert.equal(getGenerateJsonWithLlm({ llm: "none" }), null);
});
