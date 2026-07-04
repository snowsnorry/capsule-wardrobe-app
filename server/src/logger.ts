import crypto from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";

type RequestLogContext = {
  requestId?: string;
};

type LogLevel = "info" | "warn" | "error";

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,63}/gi;
const EMAIL_KEY_PATTERN = /(^email$|email$)/i;
const MAX_SANITIZE_DEPTH = 8;
const requestLogStorage = new AsyncLocalStorage<RequestLogContext>();
const isTestEnv =
  process.env.NODE_ENV === "test" || process.env.VITEST === "true";
const defaultStdoutWrite = process.stdout.write;
const defaultConsoleWarn = globalThis.console.warn;
const defaultConsoleError = globalThis.console.error;

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function hashEmail(value: string): string {
  return crypto
    .createHash("sha256")
    .update(normalizeEmail(value))
    .digest("hex")
    .slice(0, 12);
}

function maskEmail(value: string): string {
  const [localPart = "", domain = ""] = normalizeEmail(value).split("@");
  if (!domain) {
    return "***";
  }

  const maskedLocal =
    localPart.length <= 1
      ? "*"
      : localPart.length === 2
        ? `${localPart[0]}*`
        : `${localPart[0]}***${localPart[localPart.length - 1]}`;
  return `${maskedLocal}@${domain}`;
}

function redactEmailsInString(value: string): string {
  return value.replace(EMAIL_PATTERN, (match) => maskEmail(match));
}

function sanitizeEmailField(value: unknown) {
  if (typeof value !== "string") {
    return sanitizeLogValue(value);
  }

  return {
    masked: maskEmail(value),
    hash: hashEmail(value),
  };
}

function sanitizeError(error: Error, depth: number, seen: WeakSet<object>) {
  const result: Record<string, unknown> = {
    name: redactEmailsInString(error.name || "Error"),
    message: redactEmailsInString(error.message || ""),
  };
  if (error.stack) {
    result.stack = redactEmailsInString(error.stack);
  }

  for (const key of Object.keys(error)) {
    const errorRecord = error as unknown as Record<string, unknown>;
    result[key] = EMAIL_KEY_PATTERN.test(key)
      ? sanitizeEmailField(errorRecord[key])
      : sanitizeLogValue(errorRecord[key], depth + 1, seen);
  }
  return result;
}

function sanitizeObject(
  value: Record<string, unknown>,
  depth: number,
  seen: WeakSet<object>,
) {
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = EMAIL_KEY_PATTERN.test(key)
      ? sanitizeEmailField(item)
      : sanitizeLogValue(item, depth + 1, seen);
  }
  return result;
}

function sanitizeScalarLogValue(value: unknown): { value: unknown } | null {
  if (typeof value === "string") {
    return { value: redactEmailsInString(value) };
  }
  if (
    value === null ||
    value === undefined ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return { value };
  }
  if (typeof value === "bigint") {
    return { value: value.toString() };
  }
  if (typeof value === "symbol" || typeof value === "function") {
    return { value: String(value) };
  }
  return null;
}

function sanitizeStructuredLogValue(
  value: object,
  depth: number,
  seen: WeakSet<object>,
): unknown {
  if (value instanceof Error) {
    return sanitizeError(value, depth, seen);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogValue(item, depth + 1, seen));
  }
  if (seen.has(value)) {
    return "[Circular]";
  }
  seen.add(value);
  return sanitizeObject(value as Record<string, unknown>, depth, seen);
}

function sanitizeLogValue(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
): unknown {
  const scalar = sanitizeScalarLogValue(value);
  if (scalar) return scalar.value;
  if (depth >= MAX_SANITIZE_DEPTH) {
    return "[MaxDepth]";
  }
  if (typeof value === "object") {
    return sanitizeStructuredLogValue(value, depth, seen);
  }

  return String(value);
}

function buildLogRecord(level: LogLevel, values: readonly unknown[]) {
  const context = requestLogStorage.getStore();
  const sanitizedValues = values.map((value) => sanitizeLogValue(value));
  const firstValue = sanitizedValues[0];
  return {
    time: new Date().toISOString(),
    level,
    ...(context?.requestId ? { requestId: context.requestId } : {}),
    ...(typeof firstValue === "string" ? { message: firstValue } : {}),
    values: sanitizedValues,
  };
}

function writeStructuredLog(
  stream: NodeJS.WriteStream,
  level: LogLevel,
  values: readonly unknown[],
): void {
  stream.write(`${JSON.stringify(buildLogRecord(level, values))}\n`);
}

function writeConsoleLog(
  writer: (...values: unknown[]) => void,
  level: LogLevel,
  values: readonly unknown[],
): void {
  writer(JSON.stringify(buildLogRecord(level, values)));
}

export function runWithRequestLogContext<T>(
  context: RequestLogContext,
  callback: () => T,
): T {
  return requestLogStorage.run(context, callback);
}

export function getRequestLogContext(): RequestLogContext | undefined {
  return requestLogStorage.getStore();
}

export function sanitizeForLog(value: unknown): unknown {
  return sanitizeLogValue(value);
}

export function logInfo(...values: unknown[]): void {
  if (isTestEnv && process.stdout.write === defaultStdoutWrite) return;
  writeStructuredLog(process.stdout, "info", values);
}

export function logWarn(...values: unknown[]): void {
  if (isTestEnv && globalThis.console.warn === defaultConsoleWarn) return;
  writeConsoleLog(globalThis.console.warn, "warn", values);
}

export function logError(...values: unknown[]): void {
  if (isTestEnv && globalThis.console.error === defaultConsoleError) return;
  writeConsoleLog(globalThis.console.error, "error", values);
}
