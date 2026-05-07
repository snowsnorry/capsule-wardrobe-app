import { test, expect } from "vitest";
import {
  cleanupUploadedGeminiFiles,
  uploadBufferToGemini
} from "./geminiUploads.js";

test("uploadBufferToGemini writes temp file, uploads it, and deletes local temp file", async () => {
  const calls = [];
  const uploaded = await uploadBufferToGemini({
    files: {
      upload: async (payload) => {
        calls.push(["upload", payload]);
        return { name: "files/123", uri: "gs://gemini/files/123", mimeType: "image/png" };
      },
      delete: async () => ({})
    }
  }, {
    filename: "capsule.png",
    mimeType: "image/png",
    buffer: Buffer.from("image-one")
  }, {
    writeFileSyncImpl: (filePath, buffer) => calls.push(["write", filePath, Buffer.from(buffer).toString("utf8")]),
    unlinkSyncImpl: (filePath) => calls.push(["unlink", filePath]),
    tmpdirImpl: () => "/tmp/gemini-tests",
    joinImpl: (...parts) => parts.join("/"),
    randomUUIDImpl: () => "123e4567-e89b-12d3-a456-426614174000"
  });

  expect(uploaded).toEqual({ name: "files/123", uri: "gs://gemini/files/123", mimeType: "image/png" });
  expect(calls).toEqual([
    ["write", "/tmp/gemini-tests/123e4567-e89b-12d3-a456-426614174000.png", "image-one"],
    ["upload", {
      file: "/tmp/gemini-tests/123e4567-e89b-12d3-a456-426614174000.png",
      config: {
        mimeType: "image/png",
        displayName: "capsule.png"
      }
    }],
    ["unlink", "/tmp/gemini-tests/123e4567-e89b-12d3-a456-426614174000.png"]
  ]);
});

test("cleanupUploadedGeminiFiles deletes uploaded files and ignores nameless entries", async () => {
  const deleted = [];
  await cleanupUploadedGeminiFiles({
    files: {
      delete: async ({ name }) => {
        deleted.push(name);
        return {};
      },
      upload: async () => ({ name: "files/ignore" })
    }
  }, [
    { name: "files/123" },
    { uri: "gs://gemini/files/without-name" },
    { name: "files/456" }
  ]);

  expect(deleted).toEqual(["files/123", "files/456"]);
});
