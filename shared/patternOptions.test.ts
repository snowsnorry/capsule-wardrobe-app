import test from "node:test";
import assert from "node:assert/strict";
import {
  CANONICAL_PATTERN_OPTIONS,
  buildCanonicalPatternOptions,
  normalizePatternOption
} from "./patternOptions.js";

test("normalizePatternOption trims and lowercases string values", () => {
  assert.equal(normalizePatternOption("  Stripe  "), "stripe");
  assert.equal(normalizePatternOption("POLKA_DOT"), "polka_dot");
});

test("normalizePatternOption rejects non-string values", () => {
  assert.equal(normalizePatternOption(null), "");
  assert.equal(normalizePatternOption(12), "");
});

test("buildCanonicalPatternOptions returns canonical values plus unique custom extras", () => {
  const options = buildCanonicalPatternOptions(
    ["stripe", " Plaid ", "plaid", "", null, "GRAPHIC"],
    "Micro Check"
  );

  assert.deepEqual(options.slice(0, CANONICAL_PATTERN_OPTIONS.length), [...CANONICAL_PATTERN_OPTIONS]);
  assert.deepEqual(options.slice(CANONICAL_PATTERN_OPTIONS.length), ["plaid", "micro check"]);
});

test("buildCanonicalPatternOptions handles omitted inputs", () => {
  assert.deepEqual(buildCanonicalPatternOptions(), [...CANONICAL_PATTERN_OPTIONS]);
});
