import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import {
  getWardrobeUploadProcessingErrorMessage,
  resolveWardrobeUploadProcessingChildEntryUrl,
  resolveWardrobeUploadProcessingChildExecArgv,
} from "./wardrobeUploadProcessingCore.ts";

test("wardrobe upload processing core resolves child entrypoint and exec argv", () => {
  const entryUrl = resolveWardrobeUploadProcessingChildEntryUrl();

  expect(fileURLToPath(entryUrl)).toMatch(
    /wardrobeUploadProcessing\.child\.[jt]s$/,
  );
  expect(
    resolveWardrobeUploadProcessingChildExecArgv(
      new URL("file:///tmp/child.js"),
    ),
  ).toEqual([]);
  expect(
    resolveWardrobeUploadProcessingChildExecArgv(
      new URL("file:///tmp/child.ts"),
    ),
  ).toEqual(process.execArgv);
});

test("wardrobe upload processing core normalizes child error messages", () => {
  const error = new Error("worker_failed");

  expect(getWardrobeUploadProcessingErrorMessage(error)).toEqual(
    expect.objectContaining({
      message: "worker_failed",
      stack: expect.any(String),
    }),
  );
  expect(getWardrobeUploadProcessingErrorMessage(null)).toEqual({
    message: "unknown_error",
    stack: null,
  });
});
