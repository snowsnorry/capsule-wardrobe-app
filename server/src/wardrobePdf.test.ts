import test from "node:test";
import assert from "node:assert/strict";
import {
  buildWardrobePdf,
  buildWardrobePdfInChild,
  createWardrobePdfJobManager,
  resolveWardrobePdfChildEntryUrl,
  resolveWardrobePdfChildExecArgv
} from "./wardrobePdf.js";

test("wardrobe pdf facade re-exports PDF helpers and job manager", () => {
  assert.equal(typeof buildWardrobePdf, "function");
  assert.equal(typeof buildWardrobePdfInChild, "function");
  assert.equal(typeof createWardrobePdfJobManager, "function");
  assert.equal(typeof resolveWardrobePdfChildEntryUrl, "function");
  assert.equal(typeof resolveWardrobePdfChildExecArgv, "function");
});
