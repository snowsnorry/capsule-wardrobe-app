import { test, expect } from "vitest";
import {
  enforceCategoryCounts,
  getSelectedIdsFromCapsule,
  getStoredWardrobePayload,
  getWardrobeSelectionPrompt,
  toWardrobeUiItem,
} from "./ai.js";

test("ai barrel exposes pure AI helpers without legacy job service singletons", () => {
  expect(typeof enforceCategoryCounts).toBe("function");
  expect(typeof getSelectedIdsFromCapsule).toBe("function");
  expect(typeof getStoredWardrobePayload).toBe("function");
  expect(typeof getWardrobeSelectionPrompt).toBe("function");
  expect(typeof toWardrobeUiItem).toBe("function");
});
