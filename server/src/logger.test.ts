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

test("logInfo writes one readable logfmt line without duplicated payloads", () => {
  const writes: string[] = [];
  vi.spyOn(process.stdout, "write").mockImplementation(
    (chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    },
  );

  logInfo("ai.capsule.llm.completed", {
    llmModel: "gpt-5.6-terra",
    capsuleRequestId: "capsule-1",
    durationMs: 42,
    nested: { value: 1 },
  });

  expect(writes).toEqual([
    expect.stringMatching(
      /^\d{4}-\d{2}-\d{2}T.*Z INFO event=ai\.capsule\.llm\.completed capsuleRequestId=capsule-1 durationMs=42 llmModel=gpt-5\.6-terra nested=\{"value":1\}\n$/,
    ),
  ]);
  expect(writes[0]).not.toContain("values=");
  expect(writes[0]).not.toContain('"message"');
});

test("logger includes request id from async context before other fields", () => {
  const writes: string[] = [];
  vi.spyOn(process.stdout, "write").mockImplementation(
    (chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    },
  );

  runWithRequestLogContext({ requestId: "req-1" }, () => {
    logInfo("inside-request", {
      jobId: "job-1",
      capsuleRequestId: "capsule-1",
    });
  });

  expect(writes[0]).toContain(
    "event=inside.request requestId=req-1 jobId=job-1 capsuleRequestId=capsule-1",
  );
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

test("logger serializes bigint values in logfmt fields", () => {
  const writes: string[] = [];
  vi.spyOn(process.stdout, "write").mockImplementation(
    (chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    },
  );

  logInfo("counter.updated", { count: 1n });

  expect(writes[0]).toContain("event=counter.updated count=1");
});

test("logError keeps one sanitized, single-line stack capped at 4 KB", () => {
  const error = new Error("failed for Person@example.com");
  error.stack = `Error: failed for Person@example.com\n${"x".repeat(5_000)}`;
  const output = vi.spyOn(console, "error").mockImplementation(() => {});

  logError("auth.session.create.failed", error, { jobId: "job-1" });

  const line = String(output.mock.calls[0][0]);
  expect(line).toContain("ERROR event=auth.session.create.failed jobId=job-1");
  expect(line).toContain('errorMessage="failed for p***n@example.com"');
  expect(line).toContain("errorStack=");
  expect(line).not.toContain("Person@example.com");
  expect(line).not.toContain("\n");
  expect(line.length).toBeLessThan(5_000);
});

test("logWarn keeps canonical event names", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

  logWarn("jobs.run.started", { jobId: "job-1" });

  expect(String(warn.mock.calls[0][0])).toContain(
    "WARN event=jobs.run.started jobId=job-1",
  );
});

test("logError does not write to stderr in tests unless console.error is mocked", () => {
  const writes: string[] = [];
  vi.spyOn(process.stderr, "write").mockImplementation(
    (chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    },
  );

  logError("expected.test.failure", new Error("expected"));

  expect(writes).toEqual([]);
});
