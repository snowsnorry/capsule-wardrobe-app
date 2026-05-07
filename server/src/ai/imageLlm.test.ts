import { test, expect } from "vitest";
import { getProfileImageLlm, resolveImageLlmProvider } from "./imageLlm.js";

test("image llm helpers resolve defaults and supported providers", () => {
  expect(getProfileImageLlm(null)).toBe("openai:gpt-image-2");
  expect(getProfileImageLlm({ imageLlm: " gemini:gemini-3-pro-image-preview " })).toBe("gemini:gemini-3-pro-image-preview");
  expect(resolveImageLlmProvider({ imageLlm: "openai:gpt-image-2" })).toEqual({
    provider: "openai",
    model: "gpt-image-2",
    imageLlm: "openai:gpt-image-2",
    requestedImageLlm: "openai:gpt-image-2"
  });
  expect(resolveImageLlmProvider({ imageLlm: "gemini:gemini-3-pro-image-preview" })).toEqual({
    provider: "gemini",
    model: "gemini-3-pro-image-preview",
    imageLlm: "gemini:gemini-3-pro-image-preview",
    requestedImageLlm: "gemini:gemini-3-pro-image-preview"
  });
});

test("resolveImageLlmProvider warns and falls back for unknown image models", () => {
  const originalWarn = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args) => {
    calls.push(args);
  };

  try {
    const resolved = resolveImageLlmProvider({ imageLlm: "unknown:model" });
    expect(resolved.provider).toBe("openai");
    expect(resolved.model).toBe("gpt-image-2");
    expect(resolved.fallbackReason).toBe("unknown_model");
    expect(resolved.requestedImageLlm).toBe("unknown:model");
  } finally {
    console.warn = originalWarn;
  }

  expect(calls.length).toBe(1);
  expect(calls[0][0]).toBe("[wardrobe-ai][image-llm-unknown-model]");
});
