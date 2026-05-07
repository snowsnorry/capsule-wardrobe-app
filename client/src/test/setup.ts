import "@testing-library/jest-dom/vitest";
import { afterAll } from "vitest";

const testConsole = globalThis.console;
const originalConsoleError = testConsole.error;
const originalStderrWrite = process.stderr.write.bind(process.stderr);
type StderrWriteCallback = (error?: Error | null) => void;

function isKnownJsdomCssParseWarning(args: readonly unknown[]): boolean {
  if (!Array.isArray(args) || args.length === 0) {
    return false;
  }

  const [firstArg, secondArg] = args;
  return (
    typeof firstArg === "string" &&
    firstArg.includes("Could not parse CSS stylesheet") &&
    (secondArg === undefined ||
      String(secondArg).includes('@import "tailwindcss";'))
  );
}

testConsole.error = (...args: unknown[]) => {
  if (isKnownJsdomCssParseWarning(args)) {
    return;
  }
  originalConsoleError(...args);
};

process.stderr.write = ((
  chunk: string | Uint8Array,
  encoding?: BufferEncoding | StderrWriteCallback,
  callback?: StderrWriteCallback,
) => {
  const text =
    typeof chunk === "string"
      ? chunk
      : Buffer.from(chunk).toString(
          typeof encoding === "string" ? encoding : undefined,
        );
  const isKnownJsdomCssParseBlock =
    typeof text === "string" &&
    text.includes("Could not parse CSS stylesheet") &&
    text.includes("/client/src/index.css");

  if (isKnownJsdomCssParseBlock) {
    if (typeof encoding === "function") {
      encoding();
    } else if (typeof callback === "function") {
      callback();
    }
    return true;
  }

  if (typeof encoding === "function") {
    return originalStderrWrite(chunk, encoding);
  }

  return originalStderrWrite(chunk, encoding, callback);
}) as typeof process.stderr.write;

afterAll(() => {
  testConsole.error = originalConsoleError;
  process.stderr.write = originalStderrWrite as typeof process.stderr.write;
});
