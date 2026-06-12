import { test, expect, vi } from "vitest";
import { writeFile } from "node:fs/promises";
import { buildWardrobePdfInChild } from "./wardrobePdfChildRunner.js";
import {
  resolveWardrobePdfChildEntryUrl,
  resolveWardrobePdfChildExecArgv,
} from "./wardrobePdfCore.js";

test("buildWardrobePdfInChild uses the runtime-matching child entry and execArgv", async () => {
  const handlers = new Map();
  let forkPath = "";
  let forkOptions = null;
  let sentMessage: ChildSendMessage | null = null;
  type ChildSendMessage = {
    outputFilePath?: string | null;
    outfit?: unknown;
  };

  const outfit = { title: "Weekend", imageUrl: "https://example.com/look.jpg" };
  const pdfBuffer = await buildWardrobePdfInChild([{ id: "top-1" }], "en", {
    outfit,
    forkImpl(modulePath, options) {
      forkPath = String(modulePath);
      forkOptions = options;

      return {
        on(event, handler) {
          handlers.set(event, handler);
        },
        removeListener(event) {
          handlers.delete(event);
        },
        kill() {},
        send(message: ChildSendMessage, callback) {
          sentMessage = message;
          void writeFile(
            String(message.outputFilePath),
            Buffer.from("pdf"),
          ).then(() => {
            handlers.get("message")?.({
              ok: true,
              outputFilePath: message.outputFilePath,
            });
            callback?.(null);
          });
        },
      };
    },
  });

  const childEntryUrl = resolveWardrobePdfChildEntryUrl();
  expect(forkPath).toBe(childEntryUrl.pathname);
  expect(forkOptions?.execArgv).toEqual(
    resolveWardrobePdfChildExecArgv(childEntryUrl),
  );
  expect(sentMessage?.outfit).toEqual(outfit);
  expect(String(pdfBuffer)).toBe("pdf");
});

function createControllableChild() {
  const handlers = new Map();
  return {
    handlers,
    child: {
      killed: false,
      on(event, handler) {
        handlers.set(event, handler);
      },
      removeListener(event) {
        handlers.delete(event);
      },
      kill() {
        this.killed = true;
      },
      send(_message, callback) {
        callback?.(null);
      },
    },
  };
}

async function waitForHandler(handlers, event) {
  await vi.waitFor(() => {
    expect(handlers.has(event)).toBe(true);
  });
}

test("buildWardrobePdfInChild rejects send, error, and exit failures", async () => {
  await expect(
    buildWardrobePdfInChild([], "en", {
      forkImpl: () => ({
        on() {},
        removeListener() {},
        kill() {},
        send(_message, callback) {
          callback?.(new Error("send failed"));
        },
      }),
    }),
  ).rejects.toThrow(/send failed/);

  const errored = createControllableChild();
  const errorPromise = buildWardrobePdfInChild([], "en", {
    forkImpl: () => errored.child,
  });
  await waitForHandler(errored.handlers, "error");
  errored.handlers.get("error")?.(new Error("child failed"));
  await expect(errorPromise).rejects.toThrow(/child failed/);

  const exited = createControllableChild();
  const exitPromise = buildWardrobePdfInChild([], "en", {
    forkImpl: () => exited.child,
  });
  await waitForHandler(exited.handlers, "exit");
  exited.handlers.get("exit")?.(2, "SIGTERM");
  await expect(exitPromise).rejects.toThrow(
    /wardrobe_pdf_child_exit:2:SIGTERM/,
  );
});

test("buildWardrobePdfInChild rejects invalid and failed child payloads", async () => {
  const invalid = createControllableChild();
  const invalidPromise = buildWardrobePdfInChild([], "en", {
    forkImpl: () => invalid.child,
  });
  await waitForHandler(invalid.handlers, "message");
  invalid.handlers.get("message")?.({ ok: true, outputFilePath: " " });
  await expect(invalidPromise).rejects.toThrow(
    /wardrobe_pdf_child_invalid_payload/,
  );

  const failed = createControllableChild();
  const failedPromise = buildWardrobePdfInChild([], "en", {
    forkImpl: () => failed.child,
  });
  await waitForHandler(failed.handlers, "message");
  failed.handlers.get("message")?.({
    ok: false,
    message: "render failed",
    stack: "Error: render failed\n    at child",
  });
  await expect(failedPromise).rejects.toMatchObject({
    message: "render failed",
    stack: "Error: render failed\n    at child",
  });
});

test("buildWardrobePdfInChild rejects when output file cannot be read", async () => {
  const missing = createControllableChild();
  const promise = buildWardrobePdfInChild([], "en", {
    forkImpl: () => missing.child,
  });

  await waitForHandler(missing.handlers, "message");
  missing.handlers.get("message")?.({
    ok: true,
    outputFilePath: "/tmp/capsule-wardrobe-missing.pdf",
  });

  await expect(promise).rejects.toThrow();
});

test("buildWardrobePdfInChild kills timed out children", async () => {
  vi.spyOn(globalThis, "setTimeout").mockImplementationOnce(((
    callback: () => void,
  ) => {
    queueMicrotask(callback);
    return { unref() {} };
  }) as never);
  const timedOut = createControllableChild();
  const promise = buildWardrobePdfInChild([], "en", {
    forkImpl: () => timedOut.child,
  });
  const rejection = expect(promise).rejects.toThrow(
    /wardrobe_pdf_child_timeout/,
  );

  await waitForHandler(timedOut.handlers, "message");

  await rejection;
  expect(timedOut.child.killed).toBe(true);
  vi.restoreAllMocks();
});
