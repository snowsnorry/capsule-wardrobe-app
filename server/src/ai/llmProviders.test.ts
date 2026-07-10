import { test, expect } from "vitest";
import {
  CLAUDE_ALLOWED_MODELS,
  GEMINI_PROFILE_LLM,
  getProfileLlm,
  isNoLlmProfileEnabled,
  resolveLlmProvider,
} from "./llmPrompts.js";

test("resolveLlmProvider maps supported profile llm values to providers", () => {
  expect(resolveLlmProvider({ llm: "none" })).toEqual({
    mode: "none",
    llm: "none",
    requestedLlm: "none",
  });

  expect(resolveLlmProvider({ llm: "openai:gpt-5.5" })).toEqual({
    provider: "openai",
    model: "gpt-5.5",
    llm: "openai:gpt-5.5",
    requestedLlm: "openai:gpt-5.5",
  });

  expect(resolveLlmProvider({ llm: "openai:gpt-5.6-terra" })).toEqual({
    provider: "openai",
    model: "gpt-5.6-terra",
    llm: "openai:gpt-5.6-terra",
    requestedLlm: "openai:gpt-5.6-terra",
  });

  expect(
    resolveLlmProvider({ llm: "deepinfra:google/gemma-4-31B-it" }),
  ).toEqual({
    provider: "deepinfra",
    model: "google/gemma-4-31B-it",
    llm: "deepinfra:google/gemma-4-31B-it",
    requestedLlm: "deepinfra:google/gemma-4-31B-it",
  });

  expect(
    resolveLlmProvider({ llm: `claude:${CLAUDE_ALLOWED_MODELS[0]}` }),
  ).toEqual({
    provider: "claude",
    model: CLAUDE_ALLOWED_MODELS[0],
    llm: `claude:${CLAUDE_ALLOWED_MODELS[0]}`,
    requestedLlm: `claude:${CLAUDE_ALLOWED_MODELS[0]}`,
  });

  expect(resolveLlmProvider({ llm: GEMINI_PROFILE_LLM })).toEqual({
    provider: "gemini",
    model: "gemini-2.5-pro",
    llm: GEMINI_PROFILE_LLM,
    requestedLlm: GEMINI_PROFILE_LLM,
  });
});

test("profile llm helpers default to openai and expose no-llm mode", () => {
  expect(getProfileLlm(null)).toBe("openai:gpt-5.5");
  expect(isNoLlmProfileEnabled({ llm: "none" })).toBe(true);
  expect(isNoLlmProfileEnabled({ llm: "openai:gpt-5.5" })).toBe(false);
});

test("resolveLlmProvider warns and falls back for unknown model", () => {
  const originalWarn = console.warn;
  const calls = [];
  console.warn = (...args) => {
    calls.push(args);
  };

  try {
    const resolved = resolveLlmProvider({ llm: "deepinfra:unknown-model" });
    expect(resolved.provider).toBe("openai");
    expect(resolved.model).toBe("gpt-5.5");
    expect(resolved.fallbackReason).toBe("unknown_model");
  } finally {
    console.warn = originalWarn;
  }

  expect(calls.length).toBe(1);
  expect(String(calls[0][0])).toContain(
    "WARN event=wardrobe.ai.llm.unknown.model",
  );
  expect(String(calls[0][0])).toContain(
    "fallbackModel=gpt-5.5 fallbackProvider=openai requestedLlm=deepinfra:unknown-model",
  );
});

test("resolveLlmProvider warns and falls back for unknown claude model", () => {
  const originalWarn = console.warn;
  const calls = [];
  console.warn = (...args) => {
    calls.push(args);
  };

  try {
    const resolved = resolveLlmProvider({ llm: "claude:unknown-model" });
    expect(resolved.provider).toBe("openai");
    expect(resolved.model).toBe("gpt-5.5");
    expect(resolved.fallbackReason).toBe("unknown_model");
  } finally {
    console.warn = originalWarn;
  }

  expect(calls.length).toBe(1);
  expect(String(calls[0][0])).toContain(
    "WARN event=wardrobe.ai.llm.unknown.model",
  );
  expect(String(calls[0][0])).toContain(
    "fallbackModel=gpt-5.5 fallbackProvider=openai requestedLlm=claude:unknown-model",
  );
});
