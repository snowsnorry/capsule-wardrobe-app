import { test, expect } from "vitest";
import {
  countItemsByKey,
  extractLlmUsage,
  formatLogPayload,
  formatLogValue,
  getShortRequestId
} from "./swimwearLogging.js";

test("formatLogValue serializes nullish, scalar, and object values", () => {
  expect(formatLogValue(null)).toBe("null");
  expect(formatLogValue(undefined)).toBe("undefined");
  expect(formatLogValue("ready")).toBe("ready");
  expect(formatLogValue(3)).toBe("3");
  expect(formatLogValue(false)).toBe("false");
  expect(formatLogValue({ a: 1 })).toBe("{\"a\":1}");
});

test("formatLogPayload omits undefined values and preserves key labels", () => {
  expect(formatLogPayload({
      total: 2,
      skipped: undefined,
      tags: ["summer", "beach"]
    })).toBe("total: 2, tags: [\"summer\",\"beach\"]");
  expect(formatLogPayload()).toBe("");
});

test("getShortRequestId returns the first request id segment", () => {
  expect(getShortRequestId({ capsuleRequestId: "abc12345-def" })).toBe("abc12345");
  expect(getShortRequestId({ capsuleRequestId: "  singleid  " })).toBe("singleid");
  expect(getShortRequestId(null)).toBe("");
});

test("countItemsByKey counts non-empty category values", () => {
  expect(countItemsByKey([
      { category: "top" },
      { category: "top" },
      { category: " " },
      { category: "bottom" },
      null as unknown as Record<string, unknown>
    ])).toEqual({ top: 2, bottom: 1 });
  expect(countItemsByKey([{ swimwear_type: "swimsuit" }], "swimwear_type")).toEqual({ swimsuit: 1 });
});

test("extractLlmUsage keeps only finite token metrics", () => {
  expect(extractLlmUsage(null)).toEqual({});
  expect(extractLlmUsage({
      input_tokens: 10,
      output_tokens: Number.NaN,
      total_tokens: 12,
      output_tokens_details: {
        reasoning_tokens: 2
      }
    })).toEqual({
      inputTokens: 10,
      totalTokens: 12,
      reasoningTokens: 2
    });
});
