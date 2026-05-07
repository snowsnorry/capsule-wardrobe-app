import { test, expect } from "vitest";
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
  expect(typeof createWardrobeService).toBe("function");
  expect(typeof getCapsuleItems).toBe("function");
  expect(typeof getWardrobeJob).toBe("function");
  expect(typeof regenerateCapsuleWardrobe).toBe("function");
  expect(typeof startWardrobeJob).toBe("function");
  expect(typeof enforceCategoryCounts).toBe("function");
  expect(typeof getSelectedIdsFromCapsule).toBe("function");
  expect(typeof getStoredWardrobePayload).toBe("function");
  expect(typeof getWardrobeSelectionPrompt).toBe("function");
  expect(typeof toWardrobeUiItem).toBe("function");
});
