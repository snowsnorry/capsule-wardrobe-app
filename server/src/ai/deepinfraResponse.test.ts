import assert from "node:assert/strict";
import { test } from "node:test";
import {
  collectStreamText,
  estimateJsonByteLength,
  extractChunkText,
  extractResponseText,
  parseDeepInfraJsonResponse
} from "./deepinfraResponse.js";

test("parseDeepInfraJsonResponse extracts JSON and reports raw invalid responses", () => {
  assert.deepEqual(parseDeepInfraJsonResponse("prefix {\"ok\":true} suffix"), { ok: true });

  assert.throws(
    () => parseDeepInfraJsonResponse(" not-json "),
    (error: Error & { rawSelectionText?: string | null }) => {
      assert.match(error.message, /Failed to parse JSON response/);
      assert.equal(error.rawSelectionText, "not-json");
      return true;
    }
  );
});

test("extractResponseText and streaming helpers handle string, array, and missing content", async () => {
  assert.equal(extractResponseText({ choices: [{ message: { content: "plain" } }] }), "plain");
  assert.equal(
    extractResponseText({ choices: [{ message: { content: ["a", { text: "b" }, { text: null }] } }] }),
    "ab"
  );
  assert.equal(extractResponseText(null), "{}");

  assert.equal(extractChunkText({ choices: [{ delta: { content: ["x", { text: "y" }, {}] } }] }), "xy");
  assert.equal(extractChunkText(null), "");

  async function* stream() {
    yield { choices: [{ delta: { content: "a" } }] };
    yield { choices: [{ delta: { content: [{ text: "b" }] } }] };
  }

  assert.equal(await collectStreamText(stream()), "ab");
});

test("estimateJsonByteLength returns null for circular values", () => {
  assert.equal(estimateJsonByteLength({ ok: true }), 11);
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  assert.equal(estimateJsonByteLength(circular), null);
});
