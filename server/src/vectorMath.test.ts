import test from "node:test";
import assert from "node:assert/strict";
import {
  buildShiftedTargetVector,
  normalizeEmbeddingVector,
  normalizeVector
} from "./ai/vectorMath.js";

function magnitude(vector) {
  return Math.sqrt(vector.reduce((sum, value) => sum + (value * value), 0));
}

test("normalizeVector returns unit-length vector", () => {
  const normalized = normalizeVector([3, 4]);
  assert.ok(Math.abs(magnitude(normalized) - 1) < 1e-12);
  assert.ok(Math.abs(normalized[0] - 0.6) < 1e-12);
  assert.ok(Math.abs(normalized[1] - 0.8) < 1e-12);
});

test("buildShiftedTargetVector returns normalized target when rejected vectors are empty", () => {
  const shifted = buildShiftedTargetVector([3, 4], []);
  assert.ok(Math.abs(magnitude(shifted) - 1) < 1e-12);
  assert.ok(Math.abs(shifted[0] - 0.6) < 1e-12);
  assert.ok(Math.abs(shifted[1] - 0.8) < 1e-12);
});

test("buildShiftedTargetVector shifts away from rejected centroid and normalizes", () => {
  const shifted = buildShiftedTargetVector([1, 0], [[1, 0], [0, 1]], 0.2);
  assert.ok(Math.abs(magnitude(shifted) - 1) < 1e-12);
  assert.ok(shifted[0] > shifted[1]);
});

test("buildShiftedTargetVector falls back to normalized target when shift magnitude becomes zero", () => {
  const shifted = buildShiftedTargetVector([1, 0], [[5, 0]], 0.2);
  assert.deepEqual(shifted, [1, 0]);
});

test("buildShiftedTargetVector throws on rejected vector dimension mismatch", () => {
  assert.throws(
    () => buildShiftedTargetVector([1, 0], [[1, 0, 0]]),
    /dimensions/
  );
});

test("normalizeEmbeddingVector parses numeric arrays and rejects invalid values", () => {
  assert.deepEqual(normalizeEmbeddingVector(["1", 2, "3.5"]), [1, 2, 3.5]);
  assert.equal(normalizeEmbeddingVector([]), null);
  assert.equal(normalizeEmbeddingVector(["x", 1]), null);
});
