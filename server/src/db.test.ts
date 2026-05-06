import test from "node:test";
import assert from "node:assert/strict";
import { buildPriceBuckets, hasAffectedRows, hashCapsuleContent, stableStringify } from "./db.js";

test("db facade re-exports core and search persistence helpers", () => {
  assert.equal(typeof hasAffectedRows, "function");
  assert.equal(typeof stableStringify, "function");
  assert.equal(typeof hashCapsuleContent, "function");
  assert.equal(typeof buildPriceBuckets, "function");
});
