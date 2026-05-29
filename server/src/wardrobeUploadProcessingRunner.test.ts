import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import {
  WARDROBE_UPLOAD_PROCESSING_CHILD_KILL_GRACE_MS,
  WARDROBE_UPLOAD_PROCESSING_CHILD_TIMEOUT_MS,
  type WardrobeUploadProcessingForkLike,
} from "./wardrobeUploadProcessingCore.ts";
import {
  processWardrobeUploadFilesInChild,
  runWardrobeUploadProcessingChild,
} from "./wardrobeUploadProcessingRunner.ts";

type FakeChildMode =
  | "success"
  | "child-failure"
  | "invalid-payload"
  | "exit"
  | "never"
  | "send-error";

class FakeWardrobeUploadProcessingChild extends EventEmitter {
  killedWith: Array<NodeJS.Signals | number | undefined> = [];

  constructor(private readonly mode: FakeChildMode) {
    super();
  }

  kill(signal?: NodeJS.Signals | number) {
    this.killedWith.push(signal);
    if (signal === "SIGTERM" && this.mode !== "never") {
      setImmediate(() => this.emit("exit", null, signal));
    }
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
      items?: Array<{ inputIndex?: number; kind?: string }>;
    };

    if (this.mode === "never") {
      return;
    }

    setImmediate(() => {
      if (this.mode === "success") {
        this.emit("message", {
          event: "item-started",
          inputIndex: 0,
          kind: payload.items?.[0]?.kind || "file",
          type: "event",
        });
        this.emit("message", {
          ok: true,
          results: [
            {
              analysis: null,
              cleanup: null,
              inputIndex: payload.items?.[0]?.inputIndex ?? 0,
              ok: true,
              source: {
                imageUrl: "https://images.example.com/wardrobe/item.webp",
                kind: "file",
                productPageUrl: "https://images.example.com/wardrobe/item.webp",
                rawImageUrl: "https://images.example.com/wardrobe/item.webp",
                sourceImageKey: "wardrobe/item.webp",
                sourceImageUrl: "https://images.example.com/wardrobe/item.webp",
              },
            },
          ],
          type: "result",
        });
        return;
      }

      if (this.mode === "child-failure") {
        this.emit("message", {
          ok: false,
          message: "child_failed",
          stack: "Error: child_failed",
          type: "result",
        });
        return;
      }

      if (this.mode === "invalid-payload") {
        this.emit("message", { ok: true, results: [{}], type: "result" });
        return;
      }

      if (this.mode === "exit") {
        this.emit("exit", 1, "SIGTERM");
      }
    });
  }
}

function createFork(mode: FakeChildMode) {
  const child = new FakeWardrobeUploadProcessingChild(mode);
  const forkImpl = vi.fn(
    () => child,
  ) as unknown as WardrobeUploadProcessingForkLike;
  return { child, forkImpl };
}

afterEach(() => {
  vi.useRealTimers();
});

test("wardrobe upload processing runner resolves child results and relays events", async () => {
  const { child, forkImpl } = createFork("success");
  const events: unknown[] = [];

  const results = await runWardrobeUploadProcessingChild({
    forkImpl,
    onEvent: (event) => events.push(event),
    payload: {
      email: "person@example.com",
      imageLlm: "openai:gpt-image-2",
      items: [
        {
          filePath: "/tmp/item.png",
          inputIndex: 0,
          kind: "file",
          mimeType: "image/png",
          originalName: "item.png",
        },
      ],
    },
  });

  expect(forkImpl).toHaveBeenCalledWith(
    expect.stringMatching(/wardrobeUploadProcessing\.child\.[jt]s$/),
    expect.objectContaining({
      stdio: ["ignore", "inherit", "inherit", "ipc"],
    }),
  );
  expect(events).toEqual([
    expect.objectContaining({ event: "item-started", inputIndex: 0 }),
  ]);
  expect(results).toEqual([
    expect.objectContaining({
      inputIndex: 0,
      ok: true,
      source: expect.objectContaining({
        sourceImageKey: "wardrobe/item.webp",
      }),
    }),
  ]);
  expect(child.listenerCount("message")).toBe(0);
  expect(child.listenerCount("error")).toBe(0);
  expect(child.listenerCount("exit")).toBe(0);
});

test("wardrobe upload processing runner rejects child failures and malformed payloads", async () => {
  const failed = createFork("child-failure");
  const malformed = createFork("invalid-payload");

  await expect(
    runWardrobeUploadProcessingChild({
      forkImpl: failed.forkImpl,
      payload: {
        email: "person@example.com",
        imageLlm: "openai:gpt-image-2",
        items: [{ inputIndex: 0, kind: "url", url: "https://example.com" }],
      },
    }),
  ).rejects.toThrow("child_failed");

  await expect(
    runWardrobeUploadProcessingChild({
      forkImpl: malformed.forkImpl,
      payload: {
        email: "person@example.com",
        imageLlm: "openai:gpt-image-2",
        items: [{ inputIndex: 0, kind: "url", url: "https://example.com" }],
      },
    }),
  ).rejects.toThrow("wardrobe_upload_processing_child_invalid_payload");
});

test("wardrobe upload processing runner rejects child exits and send failures", async () => {
  const exited = createFork("exit");
  const sendFailure = createFork("send-error");

  await expect(
    runWardrobeUploadProcessingChild({
      forkImpl: exited.forkImpl,
      payload: {
        email: "person@example.com",
        imageLlm: "openai:gpt-image-2",
        items: [{ inputIndex: 0, kind: "url", url: "https://example.com" }],
      },
    }),
  ).rejects.toThrow("wardrobe_upload_processing_child_exit:1:SIGTERM");

  await expect(
    runWardrobeUploadProcessingChild({
      forkImpl: sendFailure.forkImpl,
      payload: {
        email: "person@example.com",
        imageLlm: "openai:gpt-image-2",
        items: [{ inputIndex: 0, kind: "url", url: "https://example.com" }],
      },
    }),
  ).rejects.toThrow("send_failed");
});

test("wardrobe upload processing runner times out and escalates stuck workers", async () => {
  vi.useFakeTimers();
  const { child, forkImpl } = createFork("never");

  const promise = runWardrobeUploadProcessingChild({
    forkImpl,
    payload: {
      email: "person@example.com",
      imageLlm: "openai:gpt-image-2",
      items: [{ inputIndex: 0, kind: "url", url: "https://example.com" }],
    },
  });
  const expectation = expect(promise).rejects.toThrow(
    "wardrobe_upload_processing_child_timeout",
  );

  await vi.advanceTimersByTimeAsync(
    WARDROBE_UPLOAD_PROCESSING_CHILD_TIMEOUT_MS,
  );
  await expectation;
  expect(child.killedWith).toContain("SIGTERM");

  await vi.advanceTimersByTimeAsync(
    WARDROBE_UPLOAD_PROCESSING_CHILD_KILL_GRACE_MS,
  );
  expect(child.killedWith).toContain("SIGKILL");
});

test("wardrobe upload processing runner kills workers on abort", async () => {
  const { child, forkImpl } = createFork("never");
  const abortController = new AbortController();

  const promise = runWardrobeUploadProcessingChild({
    forkImpl,
    payload: {
      email: "person@example.com",
      imageLlm: "openai:gpt-image-2",
      items: [{ inputIndex: 0, kind: "url", url: "https://example.com" }],
    },
    signal: abortController.signal,
  });

  abortController.abort();

  await expect(promise).rejects.toThrow("wardrobe_upload_processing_aborted");
  expect(child.killedWith).toContain("SIGTERM");
});

test("wardrobe upload processing runner cleans temporary paths", async () => {
  const { forkImpl } = createFork("success");
  const tempDir = await mkdtemp(
    path.join(os.tmpdir(), "wardrobe-upload-processing-runner-test-"),
  );

  await processWardrobeUploadFilesInChild({
    cleanupPaths: [tempDir],
    email: "person@example.com",
    files: [
      {
        filePath: path.join(tempDir, "item.png"),
        mimeType: "image/png",
        originalName: "item.png",
      },
    ],
    forkImpl,
    imageLlm: "openai:gpt-image-2",
  });

  expect(existsSync(tempDir)).toBe(false);
});
