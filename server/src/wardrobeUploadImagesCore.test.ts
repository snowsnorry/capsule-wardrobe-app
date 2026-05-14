import { Buffer } from "node:buffer";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import {
  getWardrobeUploadChildErrorMessage,
  isAllowedWardrobeUploadMimeType,
  normalizeIpcBuffer,
  resolveWardrobeUploadChildEntryUrl,
  resolveWardrobeUploadChildExecArgv,
} from "./wardrobeUploadImagesCore.ts";

test("wardrobe upload core resolves child entrypoint and exec argv", () => {
  const entryUrl = resolveWardrobeUploadChildEntryUrl();

  expect(fileURLToPath(entryUrl)).toMatch(
    /wardrobeUploadImages\.child\.[jt]s$/,
  );
  expect(
    resolveWardrobeUploadChildExecArgv(new URL("file:///tmp/child.js")),
  ).toEqual([]);
  expect(
    resolveWardrobeUploadChildExecArgv(new URL("file:///tmp/child.ts")),
  ).toEqual(process.execArgv);
});

test("wardrobe upload core normalizes IPC buffer shapes", () => {
  const buffer = Buffer.from("wardrobe");
  const uint8Array = new Uint8Array([1, 2, 3]);

  expect(normalizeIpcBuffer(buffer)).toBe(buffer);
  expect(normalizeIpcBuffer(uint8Array)).toEqual(Buffer.from([1, 2, 3]));
  expect(
    normalizeIpcBuffer({
      type: "Buffer",
      data: [4, 5, 6],
    }),
  ).toEqual(Buffer.from([4, 5, 6]));
  expect(normalizeIpcBuffer({ type: "Buffer", data: "invalid" })).toBeNull();
  expect(normalizeIpcBuffer("invalid")).toBeNull();
});

test("wardrobe upload core validates MIME types and child errors", () => {
  const error = new Error("normalize_failed");

  expect(isAllowedWardrobeUploadMimeType("image/jpeg")).toBe(true);
  expect(isAllowedWardrobeUploadMimeType("image/png")).toBe(true);
  expect(isAllowedWardrobeUploadMimeType("image/webp")).toBe(true);
  expect(isAllowedWardrobeUploadMimeType("image/gif")).toBe(false);
  expect(getWardrobeUploadChildErrorMessage(error)).toEqual(
    expect.objectContaining({
      ok: false,
      message: "normalize_failed",
      stack: expect.any(String),
    }),
  );
  expect(getWardrobeUploadChildErrorMessage(null)).toEqual({
    ok: false,
    message: "unknown_error",
    stack: null,
  });
});
