import { vi } from "vitest";
import type { TestContext } from "vitest";

type ConsoleMethod = "error" | "warn";

function isStructuredLogEvent(value: unknown, expectedEvent: string) {
  if (typeof value !== "string") {
    return false;
  }

  return value.includes(`event=${expectedEvent}`);
}

export function muteExpectedStructuredLog(
  testContext: TestContext,
  method: ConsoleMethod,
  expectedEvent: string,
) {
  const consoleObject = globalThis.console;
  const originalWriter = consoleObject[method].bind(consoleObject);
  const spy = vi.spyOn(consoleObject, method).mockImplementation((...args) => {
    if (isStructuredLogEvent(args[0], expectedEvent)) {
      return;
    }

    originalWriter(...args);
  });

  testContext.onTestFinished(() => {
    spy.mockRestore();
  });
}
