import { test, expect } from "vitest";
import {
  buildRegenerateSelectedPrompt,
  buildRegenerateSelectedSystemPrompt,
} from "./regenerateSelected.js";

test("regenerateSelected barrel exposes pure prompt helpers only", () => {
  expect(typeof buildRegenerateSelectedPrompt).toBe("function");
  expect(typeof buildRegenerateSelectedSystemPrompt).toBe("function");
});
