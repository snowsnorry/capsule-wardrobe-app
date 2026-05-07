import { test, expect } from "vitest";
import {
  buildShiftedTargetVector,
  normalizeEmbeddingVector,
  normalizeVector,
} from "./vectorMath.js";

function magnitude(vector) {
  return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
}

test("normalizeVector returns unit-length vector", () => {
  const normalized = normalizeVector([3, 4]);
  expect(Math.abs(magnitude(normalized) - 1) < 1e-12).toBeTruthy();
  expect(Math.abs(normalized[0] - 0.6) < 1e-12).toBeTruthy();
  expect(Math.abs(normalized[1] - 0.8) < 1e-12).toBeTruthy();
});

test("buildShiftedTargetVector returns normalized target when rejected vectors are empty", () => {
  const shifted = buildShiftedTargetVector([3, 4], []);
  expect(Math.abs(magnitude(shifted) - 1) < 1e-12).toBeTruthy();
  expect(Math.abs(shifted[0] - 0.6) < 1e-12).toBeTruthy();
  expect(Math.abs(shifted[1] - 0.8) < 1e-12).toBeTruthy();
});

test("buildShiftedTargetVector shifts away from rejected centroid and normalizes", () => {
  const shifted = buildShiftedTargetVector(
    [1, 0],
    [
      [1, 0],
      [0, 1],
    ],
    0.2,
  );
  expect(Math.abs(magnitude(shifted) - 1) < 1e-12).toBeTruthy();
  expect(shifted[0] > shifted[1]).toBeTruthy();
});

test("buildShiftedTargetVector falls back to normalized target when shift magnitude becomes zero", () => {
  const shifted = buildShiftedTargetVector([1, 0], [[5, 0]], 0.2);
  expect(shifted).toEqual([1, 0]);
});

test("buildShiftedTargetVector throws on rejected vector dimension mismatch", () => {
  expect(() => buildShiftedTargetVector([1, 0], [[1, 0, 0]])).toThrow(
    /dimensions/,
  );
});

test("normalizeEmbeddingVector parses numeric arrays and rejects invalid values", () => {
  expect(normalizeEmbeddingVector(["1", 2, "3.5"])).toEqual([1, 2, 3.5]);
  expect(normalizeEmbeddingVector([])).toBe(null);
  expect(normalizeEmbeddingVector(["x", 1])).toBe(null);
});
