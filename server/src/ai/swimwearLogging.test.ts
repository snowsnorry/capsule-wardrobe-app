import test from "node:test";
import assert from "node:assert/strict";
import {
  countItemsByKey,
  extractLlmUsage,
  formatLogPayload,
  formatLogValue,
  getShortRequestId
} from "./swimwearLogging.js";

test("formatLogValue serializes nullish, scalar, and object values", () => {
  assert.equal(formatLogValue(null), "null");
  assert.equal(formatLogValue(undefined), "undefined");
  assert.equal(formatLogValue("ready"), "ready");
  assert.equal(formatLogValue(3), "3");
  assert.equal(formatLogValue(false), "false");
  assert.equal(formatLogValue({ a: 1 }), "{\"a\":1}");
});

test("formatLogPayload omits undefined values and preserves key labels", () => {
  assert.equal(
    formatLogPayload({
      total: 2,
      skipped: undefined,
      tags: ["summer", "beach"]
    }),
    "total: 2, tags: [\"summer\",\"beach\"]"
  );
  assert.equal(formatLogPayload(), "");
});

test("getShortRequestId returns the first request id segment", () => {
  assert.equal(getShortRequestId({ capsuleRequestId: "abc12345-def" }), "abc12345");
  assert.equal(getShortRequestId({ capsuleRequestId: "  singleid  " }), "singleid");
  assert.equal(getShortRequestId(null), "");
});

test("countItemsByKey counts non-empty category values", () => {
  assert.deepEqual(
    countItemsByKey([
      { category: "top" },
      { category: "top" },
      { category: " " },
      { category: "bottom" },
      null as unknown as Record<string, unknown>
    ]),
    { top: 2, bottom: 1 }
  );
  assert.deepEqual(countItemsByKey([{ swimwear_type: "swimsuit" }], "swimwear_type"), { swimsuit: 1 });
});

test("extractLlmUsage keeps only finite token metrics", () => {
  assert.deepEqual(extractLlmUsage(null), {});
  assert.deepEqual(
    extractLlmUsage({
      input_tokens: 10,
      output_tokens: Number.NaN,
      total_tokens: 12,
      output_tokens_details: {
        reasoning_tokens: 2
      }
    }),
    {
      inputTokens: 10,
      totalTokens: 12,
      reasoningTokens: 2
    }
  );
});
