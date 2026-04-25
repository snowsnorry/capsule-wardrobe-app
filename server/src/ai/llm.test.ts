import test from "node:test";
import assert from "node:assert/strict";
import {
  CLAUDE_ALLOWED_MODELS,
  GEMINI_PROFILE_LLM,
  buildSystemPrompt,
  getGenerateJsonWithLlm,
  getProfileLlm,
  isNoLlmProfileEnabled,
  resolveLlmProvider
} from "./llm.js";
import { generateJsonWithLlm as generateJsonWithClaude } from "./claude.js";
import { generateJsonWithLlm as generateJsonWithDeepInfra } from "./deepinfra.js";
import { generateJsonWithLlm as generateJsonWithGemini } from "./gemini.js";
import { generateJsonWithLlm as generateJsonWithOpenAi } from "./openai.js";

test("resolveLlmProvider maps supported profile llm values to providers", () => {
  assert.deepEqual(
    resolveLlmProvider({ llm: "none" }),
    { mode: "none", llm: "none", requestedLlm: "none" }
  );

  assert.deepEqual(
    resolveLlmProvider({ llm: "openai:gpt-5.5" }),
    { provider: "openai", model: "gpt-5.5", llm: "openai:gpt-5.5", requestedLlm: "openai:gpt-5.5" }
  );

  assert.deepEqual(
    resolveLlmProvider({ llm: "deepinfra:google/gemma-4-31B-it" }),
    {
      provider: "deepinfra",
      model: "google/gemma-4-31B-it",
      llm: "deepinfra:google/gemma-4-31B-it",
      requestedLlm: "deepinfra:google/gemma-4-31B-it"
    }
  );

  assert.deepEqual(
    resolveLlmProvider({ llm: `claude:${CLAUDE_ALLOWED_MODELS[0]}` }),
    {
      provider: "claude",
      model: CLAUDE_ALLOWED_MODELS[0],
      llm: `claude:${CLAUDE_ALLOWED_MODELS[0]}`,
      requestedLlm: `claude:${CLAUDE_ALLOWED_MODELS[0]}`
    }
  );

  assert.deepEqual(
    resolveLlmProvider({ llm: GEMINI_PROFILE_LLM }),
    {
      provider: "gemini",
      model: "gemini-2.5-pro",
      llm: GEMINI_PROFILE_LLM,
      requestedLlm: GEMINI_PROFILE_LLM
    }
  );
});

test("profile llm helpers default to openai and expose no-llm mode", () => {
  assert.equal(getProfileLlm(null), "openai:gpt-5.5");
  assert.equal(isNoLlmProfileEnabled({ llm: "none" }), true);
  assert.equal(isNoLlmProfileEnabled({ llm: "openai:gpt-5.5" }), false);
});

test("buildSystemPrompt renders an alternate template with shared placeholder blocks", () => {
  const prompt = buildSystemPrompt({
    audience: "woman",
    formalityLevel: "formal",
    season: ["winter"],
    style: "minimalistic",
    color: "red"
  }, {
    template: [
      "ALT PROMPT",
      "{{audience_logic_block}}",
      "{{formality_logic_block}}",
      "{{seasonality_logic_block}}",
      "{{style_library_block}}",
      "{{style_palette_block}}",
      "{{accent_color_palette_block}}"
    ].join("\n\n")
  });

  assert.match(prompt, /ALT PROMPT/);
  assert.match(prompt, /- woman:/);
  assert.match(prompt, /- formal:/);
  assert.match(prompt, /- winter:/);
  assert.match(prompt, /STYLE LIBRARY/);
  assert.match(prompt, /PALETTE REFERENCE BY STYLE/);
  assert.match(prompt, /PALETTE REFERENCE BY ACCENT COLOR/);
  assert.doesNotMatch(prompt, /\{\{/);
});

test("getGenerateJsonWithLlm returns provider-specific generator", () => {
  assert.equal(getGenerateJsonWithLlm({ llm: "openai:gpt-5.5" }), generateJsonWithOpenAi);
  assert.equal(getGenerateJsonWithLlm({ llm: `claude:${CLAUDE_ALLOWED_MODELS[0]}` }), generateJsonWithClaude);
  assert.equal(getGenerateJsonWithLlm({ llm: GEMINI_PROFILE_LLM }), generateJsonWithGemini);
  assert.equal(getGenerateJsonWithLlm({ llm: "deepinfra:Qwen/Qwen3-VL-235B-A22B-Instruct" }), generateJsonWithDeepInfra);
  assert.equal(getGenerateJsonWithLlm({ llm: "none" }), null);
});

test("resolveLlmProvider warns and falls back for unknown model", () => {
  const originalWarn = console.warn;
  const calls = [];
  console.warn = (...args) => {
    calls.push(args);
  };

  try {
    const resolved = resolveLlmProvider({ llm: "deepinfra:unknown-model" });
    assert.equal(resolved.provider, "openai");
    assert.equal(resolved.model, "gpt-5.5");
    assert.equal(resolved.fallbackReason, "unknown_model");
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "[wardrobe-ai][llm-unknown-model]");
});

test("resolveLlmProvider warns and falls back for unknown claude model", () => {
  const originalWarn = console.warn;
  const calls = [];
  console.warn = (...args) => {
    calls.push(args);
  };

  try {
    const resolved = resolveLlmProvider({ llm: "claude:unknown-model" });
    assert.equal(resolved.provider, "openai");
    assert.equal(resolved.model, "gpt-5.5");
    assert.equal(resolved.fallbackReason, "unknown_model");
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "[wardrobe-ai][llm-unknown-model]");
});
