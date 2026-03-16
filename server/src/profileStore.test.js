import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPatternOptions,
  getFormalityLevels,
  getStyles,
  PROFILE_OCCASION_OPTIONS,
  PROFILE_SEASON_OPTIONS,
  normalizeFormalityLevel,
  normalizeStyle,
  normalizeColor,
  getAudienceOptions,
  getOccasions,
  getSeasons
} from "./profileStore.js";

test("normalizeFormalityLevel keeps only known core styles", () => {
  assert.equal(normalizeFormalityLevel(" smart_casual "), "smart_casual");
  assert.equal(normalizeFormalityLevel("retro"), null);
});

test("normalizeStyle normalizes optional style values", () => {
  assert.equal(normalizeStyle(" avant_garde "), "avant_garde");
  assert.equal(normalizeStyle(""), null);
  assert.equal(normalizeStyle(null), null);
});

test("normalizeColor keeps only allowed accent colors", () => {
  assert.equal(normalizeColor(" Red "), "red");
  assert.equal(normalizeColor("ultraviolet"), null);
  assert.equal(normalizeColor(""), null);
});

test("getAudienceOptions returns supported profile audiences", () => {
  assert.deepEqual(getAudienceOptions(), ["man", "woman", "any"]);
});

test("getFormalityLevels returns fixed schema-based values", async () => {
  assert.deepEqual(await getFormalityLevels("user@example.com"), ["casual", "smart_casual", "formal"]);
});

test("getStyles returns fixed schema-based values", async () => {
  assert.deepEqual(await getStyles("user@example.com"), [
    "minimalistic",
    "street_style",
    "romantic",
    "preppy",
    "retro",
    "boho",
    "nautical",
    "safari",
    "equestrian",
    "military",
    "grunge",
    "sporty"
  ]);
});

test("getOccasions returns fixed schema-based values in schema order", async () => {
  assert.deepEqual(await getOccasions("user@example.com"), PROFILE_OCCASION_OPTIONS);
});

test("getSeasons returns fixed schema-based values in schema order", async () => {
  assert.deepEqual(await getSeasons("user@example.com"), PROFILE_SEASON_OPTIONS);
});

test("buildPatternOptions keeps only whitelisted product-backed values in schema order", () => {
  assert.deepEqual(
    buildPatternOptions(["paisley", "snake", "check", "unknown", "stripe"]),
    ["stripe", "check", "snake", "paisley"]
  );
});

test("buildPatternOptions keeps current valid profile pattern even if absent in products", () => {
  assert.deepEqual(
    buildPatternOptions(["stripe"], "lace"),
    ["stripe", "lace"]
  );
});
