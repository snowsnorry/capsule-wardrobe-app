import { test, expect } from "vitest";
import {
  cleanupUploadedGeminiFiles,
  uploadBufferToGemini,
  uploadImagesToGemini,
} from "./geminiUploads.js";

test("uploadBufferToGemini writes temp file, uploads it, and deletes local temp file", async () => {
  const calls = [];
  const uploaded = await uploadBufferToGemini(
    {
      files: {
        upload: async (payload) => {
          calls.push(["upload", payload]);
          return {
            name: "files/123",
            uri: "gs://gemini/files/123",
            mimeType: "image/png",
          };
        },
        delete: async () => ({}),
      },
    },
    {
      filename: "capsule.png",
      mimeType: "image/png",
      buffer: Buffer.from("image-one"),
    },
    {
      writeFileSyncImpl: (filePath, buffer) =>
        calls.push(["write", filePath, Buffer.from(buffer).toString("utf8")]),
      unlinkSyncImpl: (filePath) => calls.push(["unlink", filePath]),
      tmpdirImpl: () => "/tmp/gemini-tests",
      joinImpl: (...parts) => parts.join("/"),
      randomUUIDImpl: () => "123e4567-e89b-12d3-a456-426614174000",
    },
  );

  expect(uploaded).toEqual({
    name: "files/123",
    uri: "gs://gemini/files/123",
    mimeType: "image/png",
  });
  expect(calls).toEqual([
    [
      "write",
      "/tmp/gemini-tests/123e4567-e89b-12d3-a456-426614174000.png",
      "image-one",
    ],
    [
      "upload",
      {
        file: "/tmp/gemini-tests/123e4567-e89b-12d3-a456-426614174000.png",
        config: {
          mimeType: "image/png",
          displayName: "capsule.png",
        },
      },
    ],
    ["unlink", "/tmp/gemini-tests/123e4567-e89b-12d3-a456-426614174000.png"],
  ]);
});

test("cleanupUploadedGeminiFiles deletes uploaded files and ignores nameless entries", async () => {
  const deleted = [];
  await cleanupUploadedGeminiFiles(
    {
      files: {
        delete: async ({ name }) => {
          deleted.push(name);
          return {};
        },
        upload: async () => ({ name: "files/ignore" }),
      },
    },
    [
      { name: "files/123" },
      { uri: "gs://gemini/files/without-name" },
      { name: "files/456" },
    ],
  );

  expect(deleted).toEqual(["files/123", "files/456"]);
});

test("uploadBufferToGemini uses default jpeg settings and ignores local cleanup errors", async () => {
  const calls = [];
  const uploaded = await uploadBufferToGemini(
    {
      files: {
        upload: async (payload) => {
          calls.push(["upload", payload]);
          return {
            name: "files/jpeg",
            uri: "gs://gemini/files/jpeg",
            mimeType: "image/jpeg",
          };
        },
        delete: async () => ({}),
      },
    },
    {
      filename: "  ",
      mimeType: "  ",
      buffer: Buffer.from("image-two"),
    },
    {
      writeFileSyncImpl: (filePath, buffer) =>
        calls.push(["write", filePath, Buffer.from(buffer).toString("utf8")]),
      unlinkSyncImpl: () => {
        calls.push(["unlink"]);
        throw new Error("cleanup failed");
      },
      tmpdirImpl: () => "/tmp/gemini-tests",
      joinImpl: (...parts) => parts.join("/"),
      randomUUIDImpl: () => "jpeg-id",
    },
  );

  expect(uploaded?.name).toBe("files/jpeg");
  expect(calls).toEqual([
    ["write", "/tmp/gemini-tests/jpeg-id.jpg", "image-two"],
    [
      "upload",
      {
        file: "/tmp/gemini-tests/jpeg-id.jpg",
        config: {
          mimeType: "image/jpeg",
          displayName: undefined,
        },
      },
    ],
    ["unlink"],
  ]);
});

test("uploadBufferToGemini skips missing buffers with a warning", async () => {
  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args);

  try {
    const uploaded = await uploadBufferToGemini(
      {
        files: {
          upload: async () => {
            throw new Error("should not upload");
          },
          delete: async () => ({}),
        },
      },
      {
        category: "top",
        filename: "top.jpg",
        buffer: Buffer.alloc(0),
      },
    );

    expect(uploaded).toBeNull();
    const warning = String(warnings[0][0]);
    expect(warning).toContain("WARN event=ai.gemini.image.skipped");
    expect(warning).toContain(
      "category=top filename=top.jpg reason=missing_buffer",
    );
  } finally {
    console.warn = originalWarn;
  }
});

test("uploadImagesToGemini aggregates only uploaded files", async () => {
  const uploaded = await uploadImagesToGemini(
    {
      files: {
        upload: async () => ({ name: "unused" }),
        delete: async () => ({}),
      },
    },
    [
      { filename: "one.jpg", buffer: Buffer.from("one") },
      { filename: "two.jpg", buffer: Buffer.from("two") },
    ],
    async (_client, image) =>
      image.filename === "one.jpg" ? { name: "files/one" } : null,
  );

  expect(uploaded).toEqual([{ name: "files/one" }]);
});

test("cleanupUploadedGeminiFiles logs delete failures", async () => {
  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args);

  try {
    await cleanupUploadedGeminiFiles(
      {
        files: {
          upload: async () => ({ name: "files/ignore" }),
          delete: async () => {
            throw new Error("delete failed");
          },
        },
      },
      [{ name: "files/fail" }],
    );

    const warning = String(warnings[0][0]);
    expect(warning).toContain("WARN event=ai.gemini.file.delete.failed");
    expect(warning).toContain('message="delete failed" name=files/fail');
  } finally {
    console.warn = originalWarn;
  }
});
