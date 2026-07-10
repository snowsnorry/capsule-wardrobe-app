import { test, expect } from "vitest";
import { countItemsByKey, extractLlmUsage } from "./swimwearLogging.js";

test("countItemsByKey counts non-empty category values", () => {
  expect(
    countItemsByKey([
      { category: "top" },
      { category: "top" },
      { category: " " },
      { category: "bottom" },
      null as unknown as Record<string, unknown>,
    ]),
  ).toEqual({ top: 2, bottom: 1 });
  expect(
    countItemsByKey([{ swimwear_type: "swimsuit" }], "swimwear_type"),
  ).toEqual({ swimsuit: 1 });
});

test("extractLlmUsage keeps only finite token metrics", () => {
  expect(extractLlmUsage(null)).toEqual({});
  expect(
    extractLlmUsage({
      input_tokens: 10,
      output_tokens: Number.NaN,
      total_tokens: 12,
      output_tokens_details: {
        reasoning_tokens: 2,
      },
    }),
  ).toEqual({
    inputTokens: 10,
    totalTokens: 12,
    reasoningTokens: 2,
  });
});
