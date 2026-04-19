import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSwimwearSelection,
  shouldGenerateSwimwear
} from "./ai/swimwear.js";
import type { SwimwearCandidate } from "./ai/types.js";

test("shouldGenerateSwimwear returns true only when summer is present", () => {
  assert.equal(shouldGenerateSwimwear({ season: ["spring"] }), false);
  assert.equal(shouldGenerateSwimwear({ season: ["spring", "summer"] }), true);
  assert.equal(shouldGenerateSwimwear({ season: "summer" }), true);
  assert.equal(shouldGenerateSwimwear(null), false);
});

test("normalizeSwimwearSelection keeps a single swimsuit when swimsuit and extras are mixed", () => {
  const candidates: SwimwearCandidate[] = [
    { id: "1", swimwear_type: "swimsuit" },
    { id: "2", swimwear_type: "swimwear_top" },
    { id: "3", swimwear_type: "swimwear_bottom" }
  ];

  assert.deepEqual(
    normalizeSwimwearSelection(["2", "1", "3"], candidates),
    [{ id: "1", swimwear_type: "swimsuit" }]
  );
});

test("normalizeSwimwearSelection keeps a valid top and bottom pair", () => {
  const candidates: SwimwearCandidate[] = [
    { id: "1", swimwear_type: "swimwear_top" },
    { id: "2", swimwear_type: "swimwear_bottom" }
  ];

  assert.deepEqual(
    normalizeSwimwearSelection(["1", "2"], candidates),
    candidates
  );
});

test("normalizeSwimwearSelection backfills missing bottom from ranked candidates", () => {
  const candidates: SwimwearCandidate[] = [
    { id: "1", swimwear_type: "swimwear_top" },
    { id: "2", swimwear_type: "swimwear_bottom" },
    { id: "3", swimwear_type: "swimsuit" }
  ];

  assert.deepEqual(
    normalizeSwimwearSelection(["1"], candidates),
    [
      { id: "1", swimwear_type: "swimwear_top" },
      { id: "2", swimwear_type: "swimwear_bottom" }
    ]
  );
});

test("normalizeSwimwearSelection backfills missing top from ranked candidates", () => {
  const candidates: SwimwearCandidate[] = [
    { id: "1", swimwear_type: "swimwear_top" },
    { id: "2", swimwear_type: "swimwear_bottom" }
  ];

  assert.deepEqual(
    normalizeSwimwearSelection(["2"], candidates),
    [
      { id: "1", swimwear_type: "swimwear_top" },
      { id: "2", swimwear_type: "swimwear_bottom" }
    ]
  );
});

test("normalizeSwimwearSelection returns empty array when pair cannot be completed", () => {
  const candidates: SwimwearCandidate[] = [{ id: "1", swimwear_type: "swimwear_top" }];

  assert.deepEqual(normalizeSwimwearSelection(["1"], candidates), []);
});
