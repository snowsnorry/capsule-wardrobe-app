import { EventEmitter } from "node:events";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, vi } from "vitest";
import { normalizeWardrobeUploadImagesInChild } from "./wardrobeUploadImagesRunner.ts";
import type { WardrobeUploadForkLike } from "./wardrobeUploadImagesCore.ts";

type FakeChildMode =
  | "success"
  | "child-failure"
  | "invalid-payload"
  | "exit"
  | "send-error";

class FakeWardrobeUploadChild extends EventEmitter {
  killed = false;

  constructor(private readonly mode: FakeChildMode) {
    super();
  }

  kill() {
    this.killed = true;
    return true;
  }

  send(message: unknown, callback?: (error: Error | null) => void) {
    if (this.mode === "send-error") {
      callback?.(new Error("send_failed"));
      return true;
    }

    callback?.(null);
    this.scheduleResponse(message);
    return true;
  }

  private scheduleResponse(message: unknown) {
    const payload = message as {
      images?: Array<{ originalName?: string }>;
      outputDir?: string;
    };

    if (this.mode === "success") {
      const filePath = path.join(String(payload.outputDir), "image.webp");
      void writeFile(filePath, Buffer.from("webp")).then(() => {
        this.emit("message", {
          ok: true,
          images: [
            {
              filePath,
              mimeType: "image/webp",
              originalName: payload.images?.[0]?.originalName,
              width: 800,
              height: 1000,
              size: 4,
            },
          ],
        });
      });
      return;
    }

    setImmediate(() => {
      if (this.mode === "child-failure") {
        this.emit("message", {
          ok: false,
          message: "child_failed",
          stack: "Error: child_failed",
        });
      } else if (this.mode === "invalid-payload") {
        this.emit("message", { ok: true, images: [] });
      } else if (this.mode === "exit") {
        this.emit("exit", 1, "SIGTERM");
      }
    });
  }
}

function createFork(mode: FakeChildMode) {
  const child = new FakeWardrobeUploadChild(mode);
  const forkImpl = vi.fn(() => child) as unknown as WardrobeUploadForkLike;
  return { child, forkImpl };
}

test("wardrobe upload runner reads normalized files returned by child process", async () => {
  const { child, forkImpl } = createFork("success");

  const images = await normalizeWardrobeUploadImagesInChild(
    [
      {
        buffer: Buffer.from("source"),
        mimeType: "image/png",
        originalName: "dress.png",
      },
    ],
    { forkImpl },
  );

  expect(forkImpl).toHaveBeenCalledWith(
    expect.stringMatching(/wardrobeUploadImages\.child\.[jt]s$/),
    expect.objectContaining({
      stdio: ["ignore", "inherit", "inherit", "ipc"],
    }),
  );
  expect(images).toEqual([
    {
      buffer: Buffer.from("webp"),
      mimeType: "image/webp",
      originalName: "dress.png",
      width: 800,
      height: 1000,
      size: 4,
    },
  ]);
  expect(child.listenerCount("message")).toBe(0);
});

test("wardrobe upload runner rejects child failures and malformed payloads", async () => {
  const failed = createFork("child-failure");
  const malformed = createFork("invalid-payload");

  await expect(
    normalizeWardrobeUploadImagesInChild(
      [
        {
          buffer: Buffer.from("x"),
          mimeType: "image/png",
          originalName: "a.png",
        },
      ],
      { forkImpl: failed.forkImpl },
    ),
  ).rejects.toThrow("child_failed");
  await expect(
    normalizeWardrobeUploadImagesInChild(
      [
        {
          buffer: Buffer.from("x"),
          mimeType: "image/png",
          originalName: "a.png",
        },
      ],
      { forkImpl: malformed.forkImpl },
    ),
  ).rejects.toThrow("wardrobe_upload_child_invalid_payload");
});

test("wardrobe upload runner rejects child exits and send failures", async () => {
  const exited = createFork("exit");
  const sendFailure = createFork("send-error");

  await expect(
    normalizeWardrobeUploadImagesInChild(
      [
        {
          buffer: Buffer.from("x"),
          mimeType: "image/png",
          originalName: "a.png",
        },
      ],
      { forkImpl: exited.forkImpl },
    ),
  ).rejects.toThrow("wardrobe_upload_child_exit:1:SIGTERM");
  await expect(
    normalizeWardrobeUploadImagesInChild(
      [
        {
          buffer: Buffer.from("x"),
          mimeType: "image/png",
          originalName: "a.png",
        },
      ],
      { forkImpl: sendFailure.forkImpl },
    ),
  ).rejects.toThrow("send_failed");
});
