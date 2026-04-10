import test from "node:test";
import assert from "node:assert/strict";
import { buildPriceBuckets, hasAffectedRows } from "./db.js";

test("hasAffectedRows handles Neon-style returned rows", () => {
  assert.equal(hasAffectedRows([{ email: "user@example.com" }]), true);
  assert.equal(hasAffectedRows([]), false);
});

test("hasAffectedRows handles drivers that return count", () => {
  assert.equal(hasAffectedRows({ count: 1 }), true);
  assert.equal(hasAffectedRows({ count: 0 }), false);
});

test("hasAffectedRows returns false for unsupported payloads", () => {
  assert.equal(hasAffectedRows(null), false);
  assert.equal(hasAffectedRows(undefined), false);
  assert.equal(hasAffectedRows({}), false);
});

test("buildPriceBuckets returns a continuous bucket range with zero-count gaps", () => {
  assert.deepEqual(buildPriceBuckets([
    { bucket: 1, count: 3, rangeMin: 0, rangeMax: 240 },
    { bucket: 3, count: 7, rangeMin: 0, rangeMax: 240 }
  ], 4), [
    { key: "0:60", min: 0, max: 60, count: 3 },
    { key: "60:120", min: 60, max: 120, count: 0 },
    { key: "120:180", min: 120, max: 180, count: 7 },
    { key: "180:240", min: 180, max: 240, count: 0 }
  ]);
});
