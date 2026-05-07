import test from "node:test";
import assert from "node:assert/strict";
import { getProfileImageLlm, resolveImageLlmProvider } from "./imageLlm.js";

test("image llm helpers resolve defaults and supported providers", () => {
  assert.equal(getProfileImageLlm(null), "openai:gpt-image-2");
  assert.equal(getProfileImageLlm({ imageLlm: " gemini:gemini-3-pro-image-preview " }), "gemini:gemini-3-pro-image-preview");
  assert.deepEqual(resolveImageLlmProvider({ imageLlm: "openai:gpt-image-2" }), {
    provider: "openai",
    model: "gpt-image-2",
    imageLlm: "openai:gpt-image-2",
    requestedImageLlm: "openai:gpt-image-2"
  });
  assert.deepEqual(resolveImageLlmProvider({ imageLlm: "gemini:gemini-3-pro-image-preview" }), {
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
    assert.equal(resolved.provider, "openai");
    assert.equal(resolved.model, "gpt-image-2");
    assert.equal(resolved.fallbackReason, "unknown_model");
    assert.equal(resolved.requestedImageLlm, "unknown:model");
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "[wardrobe-ai][image-llm-unknown-model]");
});
