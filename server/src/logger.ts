import crypto from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";

type RequestLogContext = {
  requestId?: string;
};

type LogLevel = "info" | "warn" | "error";
type LogFields = Record<string, unknown>;

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,63}/gi;
const EMAIL_KEY_PATTERN = /(^email$|email$)/i;
const MAX_SANITIZE_DEPTH = 8;
const MAX_ERROR_STACK_LENGTH = 4_096;
const CORRELATION_FIELD_ORDER = ["requestId", "jobId", "capsuleRequestId"];
const requestLogStorage = new AsyncLocalStorage<RequestLogContext>();
const isTestEnv =
  process.env.NODE_ENV === "test" || process.env.VITEST === "true";
const defaultStdoutWrite = process.stdout.write;
const defaultConsoleWarn = globalThis.console.warn;
const defaultConsoleError = globalThis.console.error;
const SCALAR_LOG_VALUE_SANITIZERS: Record<string, (value: unknown) => unknown> =
  {
    string: (value) => redactEmailsInString(String(value)),
    number: (value) => value,
    boolean: (value) => value,
    undefined: () => undefined,
    bigint: (value) => (value as bigint).toString(),
    symbol: (value) => String(value),
    function: (value) => String(value),
  };

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
  if (!domain) return "***";
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
  if (typeof value !== "string") return sanitizeLogValue(value);
  return { masked: maskEmail(value), hash: hashEmail(value) };
}

function sanitizeError(error: Error, depth: number, seen: WeakSet<object>) {
  const result: Record<string, unknown> = {
    name: redactEmailsInString(error.name || "Error"),
    message: redactEmailsInString(error.message || ""),
  };
  if (error.stack) {
    result.stack = redactEmailsInString(error.stack).slice(
      0,
      MAX_ERROR_STACK_LENGTH,
    );
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

function sanitizeLogValue(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
): unknown {
  if (value === null) return null;
  const scalarSanitizer = SCALAR_LOG_VALUE_SANITIZERS[typeof value];
  if (scalarSanitizer) return scalarSanitizer(value);
  if (depth >= MAX_SANITIZE_DEPTH) return "[MaxDepth]";
  if (value instanceof Error) return sanitizeError(value, depth, seen);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogValue(item, depth + 1, seen));
  }
  if (typeof value === "object") {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    return sanitizeObject(value as Record<string, unknown>, depth, seen);
  }
  return "[Unsupported]";
}

function normalizeEvent(event: string): string {
  return (
    event
      .trim()
      .replace(/[\s/_-]+/g, ".")
      .replace(/\.+/g, ".")
      .replace(/^\.|\.$/g, "")
      .toLowerCase() || "server.log"
  );
}

function isFields(value: unknown): value is LogFields {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(value instanceof Error)
  );
}

function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  return new Error(typeof value === "string" ? value : "unknown_error");
}

function formatLogfmtValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (typeof value === "string" && /^[A-Za-z0-9._:/@+-]+$/.test(value)) {
    return value;
  }
  return JSON.stringify(value).replace(/\n/g, "\\n");
}

function orderedFieldEntries(fields: LogFields): [string, unknown][] {
  const correlation = CORRELATION_FIELD_ORDER.flatMap((key) =>
    fields[key] === undefined
      ? []
      : ([[key, fields[key]]] as [string, unknown][]),
  );
  const rest = Object.entries(fields)
    .filter(
      ([key, value]) =>
        value !== undefined && !CORRELATION_FIELD_ORDER.includes(key),
    )
    .sort(([left], [right]) => left.localeCompare(right));
  return [...correlation, ...rest];
}

function buildLogLine(
  level: LogLevel,
  event: string,
  fields: LogFields = {},
  error?: unknown,
): string {
  const context = requestLogStorage.getStore();
  const fieldsWithContext: LogFields = {
    ...(context?.requestId ? { requestId: context.requestId } : {}),
    ...fields,
  };
  const sanitizedFields = sanitizeLogValue(fieldsWithContext) as LogFields;
  if (error !== undefined) {
    const sanitizedError = sanitizeError(
      toError(error),
      0,
      new WeakSet<object>(),
    );
    sanitizedFields.errorName = sanitizedError.name;
    sanitizedFields.errorMessage = sanitizedError.message;
    if (sanitizedError.stack)
      sanitizedFields.errorStack = String(sanitizedError.stack).replace(
        /\s*\n\s*/g,
        " | ",
      );
    for (const [key, value] of Object.entries(sanitizedError)) {
      if (
        !(key in sanitizedFields) &&
        key !== "name" &&
        key !== "message" &&
        key !== "stack"
      ) {
        sanitizedFields[`error.${key}`] = value;
      }
    }
  }
  const serializedFields = orderedFieldEntries(sanitizedFields)
    .map(([key, value]) => `${key}=${formatLogfmtValue(value)}`)
    .join(" ");
  return [
    new Date().toISOString(),
    level.toUpperCase(),
    `event=${normalizeEvent(event)}`,
    serializedFields,
  ]
    .filter(Boolean)
    .join(" ");
}

function writeLog(
  level: LogLevel,
  event: string,
  fields: LogFields = {},
  error?: unknown,
): void {
  const line = buildLogLine(level, event, fields, error);
  if (level === "info") {
    if (isTestEnv && process.stdout.write === defaultStdoutWrite) return;
    process.stdout.write(`${line}\n`);
    return;
  }
  const writer =
    level === "warn" ? globalThis.console.warn : globalThis.console.error;
  const defaultWriter =
    level === "warn" ? defaultConsoleWarn : defaultConsoleError;
  if (isTestEnv && writer === defaultWriter) return;
  writer(line);
}

export function runWithRequestLogContext<T>(
  context: RequestLogContext,
  callback: () => T,
): T {
  return requestLogStorage.run(context, callback);
}

export function sanitizeForLog(value: unknown): unknown {
  return sanitizeLogValue(value);
}

export function logInfo(event: string, fields?: LogFields): void {
  writeLog("info", event, fields);
}

export function logWarn(event: string, fields?: LogFields): void {
  writeLog("warn", event, fields);
}

export function logError(event: string, fields?: LogFields): void;
export function logError(
  event: string,
  error: unknown,
  fields?: LogFields,
): void;
export function logError(
  event: string,
  errorOrFields?: unknown,
  fields?: LogFields,
): void {
  if (fields === undefined && isFields(errorOrFields)) {
    writeLog("error", event, errorOrFields);
    return;
  }
  writeLog("error", event, fields, errorOrFields);
}
