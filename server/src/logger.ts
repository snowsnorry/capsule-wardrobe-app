import { inspect } from "node:util";

function formatLogValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Error) {
    return value.stack || value.message;
  }

  return inspect(value, { depth: 6, breakLength: 120 });
}

function writeLog(stream: NodeJS.WriteStream, values: readonly unknown[]): void {
  stream.write(`${values.map(formatLogValue).join(" ")}\n`);
}

export function logInfo(...values: unknown[]): void {
  writeLog(process.stdout, values);
}

export function logWarn(...values: unknown[]): void {
  globalThis.console.warn(...values);
}

export function logError(...values: unknown[]): void {
  globalThis.console.error(...values);
}
