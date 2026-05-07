import { test, expect } from "vitest";
import {
  CANONICAL_PATTERN_OPTIONS,
  buildCanonicalPatternOptions,
  normalizePatternOption,
} from "./patternOptions.js";

test("normalizePatternOption trims and lowercases string values", () => {
  expect(normalizePatternOption("  Stripe  ")).toBe("stripe");
  expect(normalizePatternOption("POLKA_DOT")).toBe("polka_dot");
});

test("normalizePatternOption rejects non-string values", () => {
  expect(normalizePatternOption(null)).toBe("");
  expect(normalizePatternOption(12)).toBe("");
});

test("buildCanonicalPatternOptions returns canonical values plus unique custom extras", () => {
  const options = buildCanonicalPatternOptions(
    ["stripe", " Plaid ", "plaid", "", null, "GRAPHIC"],
    "Micro Check",
  );

  expect(options.slice(0, CANONICAL_PATTERN_OPTIONS.length)).toEqual([
    ...CANONICAL_PATTERN_OPTIONS,
  ]);
  expect(options.slice(CANONICAL_PATTERN_OPTIONS.length)).toEqual([
    "plaid",
    "micro check",
  ]);
});

test("buildCanonicalPatternOptions handles omitted inputs", () => {
  expect(buildCanonicalPatternOptions()).toEqual([
    ...CANONICAL_PATTERN_OPTIONS,
  ]);
});
