import { vi } from "vitest";
import type { TestContext } from "vitest";

type ConsoleMethod = "error" | "warn";

function isStructuredLogMessage(value: unknown, expectedMessage: string) {
  if (typeof value !== "string") {
    return false;
  }

  try {
    const record = JSON.parse(value) as { message?: unknown };
    return record.message === expectedMessage;
  } catch {
    return value === expectedMessage;
  }
}

export function muteExpectedStructuredLog(
  testContext: TestContext,
  method: ConsoleMethod,
  expectedMessage: string,
) {
  const consoleObject = globalThis.console;
  const originalWriter = consoleObject[method].bind(consoleObject);
  const spy = vi.spyOn(consoleObject, method).mockImplementation((...args) => {
    if (isStructuredLogMessage(args[0], expectedMessage)) {
      return;
    }

    originalWriter(...args);
  });

  testContext.onTestFinished(() => {
    spy.mockRestore();
  });
}
