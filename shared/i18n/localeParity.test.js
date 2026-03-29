import test from "node:test";
import assert from "node:assert/strict";
import en from "./en.js";
import ru from "./ru.js";

function assertSameShape(left, right, path = "") {
  assert.equal(typeof left, typeof right, `type mismatch at ${path || "<root>"}`);

  if (left === null || right === null || typeof left !== "object") {
    return;
  }

  assert.equal(Array.isArray(left), Array.isArray(right), `array mismatch at ${path || "<root>"}`);

  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  assert.deepEqual(leftKeys, rightKeys, `key mismatch at ${path || "<root>"}`);

  for (const key of leftKeys) {
    const nextPath = path ? `${path}.${key}` : key;
    assertSameShape(left[key], right[key], nextPath);
  }
}

test("en and ru locale dictionaries keep the same recursive key shape", () => {
  assertSameShape(en, ru);
});
