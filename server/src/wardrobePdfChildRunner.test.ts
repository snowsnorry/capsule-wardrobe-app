import { test, expect } from "vitest";
import { writeFile } from "node:fs/promises";
import {
  buildWardrobePdfInChild
} from "./wardrobePdfChildRunner.js";
import {
  resolveWardrobePdfChildEntryUrl,
  resolveWardrobePdfChildExecArgv
} from "./wardrobePdfCore.js";

test("buildWardrobePdfInChild uses the runtime-matching child entry and execArgv", async () => {
  const handlers = new Map();
  let forkPath = "";
  let forkOptions = null;
  type ChildSendMessage = {
    outputFilePath?: string | null;
  };

  const pdfBuffer = await buildWardrobePdfInChild(
    [{ id: "top-1" }],
    "en",
    {
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
            void writeFile(String(message.outputFilePath), Buffer.from("pdf")).then(() => {
              handlers.get("message")?.({
                ok: true,
                outputFilePath: message.outputFilePath
              });
              callback?.(null);
            });
          }
        };
      }
    }
  );

  const childEntryUrl = resolveWardrobePdfChildEntryUrl();
  expect(forkPath).toBe(childEntryUrl.pathname);
  expect(forkOptions?.execArgv).toEqual(resolveWardrobePdfChildExecArgv(childEntryUrl));
  expect(String(pdfBuffer)).toBe("pdf");
});
