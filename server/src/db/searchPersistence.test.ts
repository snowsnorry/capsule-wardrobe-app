import test from "node:test";
import assert from "node:assert/strict";
import { buildPriceBuckets } from "./searchPersistence.js";

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
