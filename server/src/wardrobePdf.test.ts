import { test, expect } from "vitest";
import {
  buildWardrobePdf,
  buildWardrobePdfInChild,
  createWardrobePdfJobManager,
  resolveWardrobePdfChildEntryUrl,
  resolveWardrobePdfChildExecArgv
} from "./wardrobePdf.js";

test("wardrobe pdf facade re-exports PDF helpers and job manager", () => {
  expect(typeof buildWardrobePdf).toBe("function");
  expect(typeof buildWardrobePdfInChild).toBe("function");
  expect(typeof createWardrobePdfJobManager).toBe("function");
  expect(typeof resolveWardrobePdfChildEntryUrl).toBe("function");
  expect(typeof resolveWardrobePdfChildExecArgv).toBe("function");
});
