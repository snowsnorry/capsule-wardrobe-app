import { test, expect } from "vitest";
import {
  hasAffectedRows,
  hashCapsuleContent,
  stableStringify,
} from "./core.js";

type HasAffectedRowsInput =
  | { email: string }[]
  | { count: number }
  | null
  | undefined
  | Record<string, never>;

test("hasAffectedRows handles Neon-style returned rows", () => {
  expect(
    hasAffectedRows([
      { email: "user@example.com" },
    ] satisfies HasAffectedRowsInput),
  ).toBe(true);
  expect(hasAffectedRows([] satisfies HasAffectedRowsInput)).toBe(false);
});

test("hasAffectedRows handles drivers that return count", () => {
  expect(hasAffectedRows({ count: 1 } satisfies HasAffectedRowsInput)).toBe(
    true,
  );
  expect(hasAffectedRows({ count: 0 } satisfies HasAffectedRowsInput)).toBe(
    false,
  );
});

test("hasAffectedRows returns false for unsupported payloads", () => {
  expect(hasAffectedRows(null satisfies HasAffectedRowsInput)).toBe(false);
  expect(hasAffectedRows(undefined satisfies HasAffectedRowsInput)).toBe(false);
  expect(hasAffectedRows({} as never)).toBe(false);
});

test("stableStringify and hashCapsuleContent ignore object key insertion order", () => {
  const left = { b: 2, a: { d: 4, c: [3, { z: true, y: null }] } };
  const right = { a: { c: [3, { y: null, z: true }], d: 4 }, b: 2 };

  expect(stableStringify(left)).toBe(stableStringify(right));
  expect(hashCapsuleContent(left)).toBe(hashCapsuleContent(right));
});
