import { test, expect } from "vitest";
import {
  buildRegenerateSelectedPrompt,
  buildRegenerateSelectedSystemPrompt,
  createPartialRegenerationService,
  getPartialRegenerationJob,
  regenerateSelectedWardrobeItems,
  startPartialRegenerationJob,
} from "./regenerateSelected.js";

test("regenerateSelected barrel exposes prompt and service entrypoints", () => {
  expect(typeof buildRegenerateSelectedPrompt).toBe("function");
  expect(typeof buildRegenerateSelectedSystemPrompt).toBe("function");
  expect(typeof createPartialRegenerationService).toBe("function");
  expect(typeof getPartialRegenerationJob).toBe("function");
  expect(typeof regenerateSelectedWardrobeItems).toBe("function");
  expect(typeof startPartialRegenerationJob).toBe("function");
  expect(getPartialRegenerationJob("missing@example.com", "capsule-1")).toBe(
    null,
  );
});
