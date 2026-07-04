import { afterEach, expect, test, vi } from "vitest";
import {
  logError,
  logInfo,
  logWarn,
  runWithRequestLogContext,
  sanitizeForLog,
} from "./logger.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function parseLogLine(line: string) {
  return JSON.parse(line.trim());
}

test("logInfo writes structured JSON values to stdout", () => {
  const writes: string[] = [];
  vi.spyOn(process.stdout, "write").mockImplementation(
    (chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    },
  );

  logInfo("event", { ok: true, nested: { value: 1 } });

  expect(writes).toHaveLength(1);
  const record = parseLogLine(writes[0]);
  expect(record).toMatchObject({
    level: "info",
    message: "event",
    values: ["event", { ok: true, nested: { value: 1 } }],
  });
  expect(typeof record.time).toBe("string");
});

test("logger includes request id from async context", () => {
  const writes: string[] = [];
  vi.spyOn(process.stdout, "write").mockImplementation(
    (chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    },
  );

  runWithRequestLogContext({ requestId: "req-1" }, () => {
    logInfo("inside-request");
  });

  expect(parseLogLine(writes[0])).toMatchObject({
    requestId: "req-1",
    message: "inside-request",
  });
});

test("logger masks and hashes email fields recursively", () => {
  const sanitized = sanitizeForLog({
    email: "Person@example.com",
    nested: {
      profileEmail: "Another.User@example.org",
      text: "contact Person@example.com for details",
    },
  });

  expect(sanitized).toEqual({
    email: {
      masked: "p***n@example.com",
      hash: expect.stringMatching(/^[a-f0-9]{12}$/),
    },
    nested: {
      profileEmail: {
        masked: "a***r@example.org",
        hash: expect.stringMatching(/^[a-f0-9]{12}$/),
      },
      text: "contact p***n@example.com for details",
    },
  });
});

test("logger sanitizes bigint values before JSON serialization", () => {
  const writes: string[] = [];
  vi.spyOn(process.stdout, "write").mockImplementation(
    (chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    },
  );

  logInfo("bigint", { count: 1n });

  expect(parseLogLine(writes[0])).toMatchObject({
    values: ["bigint", { count: "1" }],
  });
});

test("logger masks emails in error message and stack", () => {
  const error = new Error("failed for Person@example.com");
  error.stack = "Error: failed for Person@example.com\n    at test";
  (error as Error & { userEmail?: string }).userEmail = "Person@example.com";

  const sanitized = sanitizeForLog(error);

  expect(sanitized).toMatchObject({
    name: "Error",
    message: "failed for p***n@example.com",
    stack: "Error: failed for p***n@example.com\n    at test",
    userEmail: {
      masked: "p***n@example.com",
      hash: expect.stringMatching(/^[a-f0-9]{12}$/),
    },
  });
});

test("logWarn and logError write structured JSON through console methods", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});

  logWarn("warn", { code: 1 });
  logError("error", { code: 2 });

  expect(parseLogLine(String(warn.mock.calls[0][0]))).toMatchObject({
    level: "warn",
    message: "warn",
    values: ["warn", { code: 1 }],
  });
  expect(parseLogLine(String(error.mock.calls[0][0]))).toMatchObject({
    level: "error",
    message: "error",
    values: ["error", { code: 2 }],
  });
});

test("logError does not write to stderr in tests unless console.error is mocked", () => {
  const writes: string[] = [];
  vi.spyOn(process.stderr, "write").mockImplementation(
    (chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    },
  );

  logError("expected test failure path");

  expect(writes).toEqual([]);
});
