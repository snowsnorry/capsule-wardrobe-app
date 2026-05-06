import test from "node:test";
import assert from "node:assert/strict";
import {
  createWardrobeService,
  enforceCategoryCounts,
  getCapsuleItems,
  getSelectedIdsFromCapsule,
  getStoredWardrobePayload,
  getWardrobeJob,
  getWardrobeSelectionPrompt,
  regenerateCapsuleWardrobe,
  startWardrobeJob,
  toWardrobeUiItem
} from "./ai.js";

test("ai facade exposes wardrobe service methods and compatibility exports", () => {
  assert.equal(typeof createWardrobeService, "function");
  assert.equal(typeof getCapsuleItems, "function");
  assert.equal(typeof getWardrobeJob, "function");
  assert.equal(typeof regenerateCapsuleWardrobe, "function");
  assert.equal(typeof startWardrobeJob, "function");
  assert.equal(typeof enforceCategoryCounts, "function");
  assert.equal(typeof getSelectedIdsFromCapsule, "function");
  assert.equal(typeof getStoredWardrobePayload, "function");
  assert.equal(typeof getWardrobeSelectionPrompt, "function");
  assert.equal(typeof toWardrobeUiItem, "function");
});
