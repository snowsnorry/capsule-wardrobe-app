import { test, expect } from "vitest";
import {
  collectStreamText,
  estimateJsonByteLength,
  extractChunkText,
  extractResponseText,
  parseDeepInfraJsonResponse
} from "./deepinfraResponse.js";

test("parseDeepInfraJsonResponse extracts JSON and reports raw invalid responses", () => {
  expect(parseDeepInfraJsonResponse("prefix {\"ok\":true} suffix")).toEqual({ ok: true });

  try {
    parseDeepInfraJsonResponse(" not-json ");
    throw new Error("Expected parseDeepInfraJsonResponse to throw");
  } catch (error) {
    expect((error as Error).message).toMatch(/Failed to parse JSON response/);
    expect((error as Error & { rawSelectionText?: string | null }).rawSelectionText).toBe("not-json");
  }
});

test("extractResponseText and streaming helpers handle string, array, and missing content", async () => {
  expect(extractResponseText({ choices: [{ message: { content: "plain" } }] })).toBe("plain");
  expect(extractResponseText({ choices: [{ message: { content: ["a", { text: "b" }, { text: null }] } }] })).toBe("ab");
  expect(extractResponseText(null)).toBe("{}");

  expect(extractChunkText({ choices: [{ delta: { content: ["x", { text: "y" }, {}] } }] })).toBe("xy");
  expect(extractChunkText(null)).toBe("");

  async function* stream() {
    yield { choices: [{ delta: { content: "a" } }] };
    yield { choices: [{ delta: { content: [{ text: "b" }] } }] };
  }

  expect(await collectStreamText(stream())).toBe("ab");
});

test("estimateJsonByteLength returns null for circular values", () => {
  expect(estimateJsonByteLength({ ok: true })).toBe(11);
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  expect(estimateJsonByteLength(circular)).toBe(null);
});
