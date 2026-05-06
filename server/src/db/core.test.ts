import test from "node:test";
import assert from "node:assert/strict";
import { hasAffectedRows, hashCapsuleContent, stableStringify } from "./core.js";

type HasAffectedRowsInput =
  | { email: string }[]
  | { count: number }
  | null
  | undefined
  | Record<string, never>;

test("hasAffectedRows handles Neon-style returned rows", () => {
  assert.equal(hasAffectedRows([{ email: "user@example.com" }] satisfies HasAffectedRowsInput), true);
  assert.equal(hasAffectedRows([] satisfies HasAffectedRowsInput), false);
});

test("hasAffectedRows handles drivers that return count", () => {
  assert.equal(hasAffectedRows({ count: 1 } satisfies HasAffectedRowsInput), true);
  assert.equal(hasAffectedRows({ count: 0 } satisfies HasAffectedRowsInput), false);
});

test("hasAffectedRows returns false for unsupported payloads", () => {
  assert.equal(hasAffectedRows(null satisfies HasAffectedRowsInput), false);
  assert.equal(hasAffectedRows(undefined satisfies HasAffectedRowsInput), false);
  assert.equal(hasAffectedRows({} as never), false);
});

test("stableStringify and hashCapsuleContent ignore object key insertion order", () => {
  const left = { b: 2, a: { d: 4, c: [3, { z: true, y: null }] } };
  const right = { a: { c: [3, { y: null, z: true }], d: 4 }, b: 2 };

  assert.equal(stableStringify(left), stableStringify(right));
  assert.equal(hashCapsuleContent(left), hashCapsuleContent(right));
});
