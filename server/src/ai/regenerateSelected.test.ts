import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRegenerateSelectedPrompt,
  buildRegenerateSelectedSystemPrompt,
  createPartialRegenerationService,
  getPartialRegenerationJob,
  regenerateSelectedWardrobeItems,
  startPartialRegenerationJob
} from "./regenerateSelected.js";

test("regenerateSelected barrel exposes prompt and service entrypoints", () => {
  assert.equal(typeof buildRegenerateSelectedPrompt, "function");
  assert.equal(typeof buildRegenerateSelectedSystemPrompt, "function");
  assert.equal(typeof createPartialRegenerationService, "function");
  assert.equal(typeof getPartialRegenerationJob, "function");
  assert.equal(typeof regenerateSelectedWardrobeItems, "function");
  assert.equal(typeof startPartialRegenerationJob, "function");
  assert.equal(getPartialRegenerationJob("missing@example.com", "capsule-1"), null);
});
