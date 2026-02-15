import test from "node:test";
import assert from "node:assert/strict";
import { hasAffectedRows } from "./db.js";

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
