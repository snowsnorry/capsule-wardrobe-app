import { afterEach, expect, test, vi } from "vitest";
import { logError, logInfo, logWarn } from "./logger.js";

afterEach(() => {
  vi.restoreAllMocks();
});

test("logInfo writes formatted string, error, and object values to stdout", () => {
  const writes: string[] = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
    writes.push(String(chunk));
    return true;
  });
  const error = new Error("logger failed");

  logInfo("event", error, { ok: true, nested: { value: 1 } });

  expect(writes).toHaveLength(1);
  expect(writes[0]).toContain("event Error: logger failed");
  expect(writes[0]).toContain("{ ok: true, nested: { value: 1 } }");
  expect(writes[0].endsWith("\n")).toBe(true);
});

test("logInfo falls back to an error message when stack is empty", () => {
  const writes: string[] = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
    writes.push(String(chunk));
    return true;
  });
  const error = new Error("message only");
  error.stack = "";

  logInfo(error);

  expect(writes).toEqual(["message only\n"]);
});

test("logWarn and logError delegate to console methods", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});

  logWarn("warn", { code: 1 });
  logError("error", { code: 2 });

  expect(warn).toHaveBeenCalledWith("warn", { code: 1 });
  expect(error).toHaveBeenCalledWith("error", { code: 2 });
});
