import "@testing-library/jest-dom/vitest";
import { afterAll } from "vitest";

const originalConsoleError = console.error;
const originalStderrWrite = process.stderr.write.bind(process.stderr);

function isKnownJsdomCssParseWarning(args) {
  if (!Array.isArray(args) || args.length === 0) {
    return false;
  }

  const [firstArg, secondArg] = args;
  return typeof firstArg === "string"
    && firstArg.includes("Could not parse CSS stylesheet")
    && (secondArg === undefined || String(secondArg).includes("@import \"tailwindcss\";"));
}

console.error = (...args) => {
  if (isKnownJsdomCssParseWarning(args)) {
    return;
  }
  originalConsoleError(...args);
};

process.stderr.write = ((chunk, encoding, callback) => {
  const text = typeof chunk === "string" ? chunk : chunk?.toString?.(typeof encoding === "string" ? encoding : undefined);
  const isKnownJsdomCssParseBlock = typeof text === "string"
    && text.includes("Could not parse CSS stylesheet")
    && text.includes("/client/src/index.css");

  if (isKnownJsdomCssParseBlock) {
    if (typeof encoding === "function") {
      encoding();
    } else if (typeof callback === "function") {
      callback();
    }
    return true;
  }

  return originalStderrWrite(chunk, encoding, callback);
}) as typeof process.stderr.write;

afterAll(() => {
  console.error = originalConsoleError;
  process.stderr.write = originalStderrWrite as typeof process.stderr.write;
});
