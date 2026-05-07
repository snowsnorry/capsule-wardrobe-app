import { test, expect } from "vitest";
import { buildPriceBuckets, hasAffectedRows, hashCapsuleContent, stableStringify } from "./db.js";

test("db facade re-exports core and search persistence helpers", () => {
  expect(typeof hasAffectedRows).toBe("function");
  expect(typeof stableStringify).toBe("function");
  expect(typeof hashCapsuleContent).toBe("function");
  expect(typeof buildPriceBuckets).toBe("function");
});
