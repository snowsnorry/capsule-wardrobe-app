import { inspect } from "node:util";

const isTestEnv =
  process.env.NODE_ENV === "test" || process.env.VITEST === "true";
const defaultStdoutWrite = process.stdout.write;
const defaultConsoleError = globalThis.console.error;

function formatLogValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Error) {
    return value.stack || value.message;
  }

  return inspect(value, { depth: 6, breakLength: 120 });
}

function writeLog(
  stream: NodeJS.WriteStream,
  values: readonly unknown[],
): void {
  stream.write(`${values.map(formatLogValue).join(" ")}\n`);
}

export function logInfo(...values: unknown[]): void {
  if (isTestEnv && process.stdout.write === defaultStdoutWrite) return;
  writeLog(process.stdout, values);
}

export function logWarn(...values: unknown[]): void {
  globalThis.console.warn(...values);
}

export function logError(...values: unknown[]): void {
  if (isTestEnv && globalThis.console.error === defaultConsoleError) return;
  globalThis.console.error(...values);
}
