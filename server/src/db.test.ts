import { test, expect } from "vitest";
import {
  buildPriceBuckets,
  deleteWardrobeItemFromCatalogByUrl,
  hasAffectedRows,
  hashCapsuleContent,
  listWardrobeItemsByEmail,
  saveWardrobeItemFromCatalogByUrl,
  stableStringify,
} from "./db.js";

test("db facade re-exports core and search persistence helpers", () => {
  expect(typeof hasAffectedRows).toBe("function");
  expect(typeof stableStringify).toBe("function");
  expect(typeof hashCapsuleContent).toBe("function");
  expect(typeof buildPriceBuckets).toBe("function");
  expect(typeof listWardrobeItemsByEmail).toBe("function");
  expect(typeof saveWardrobeItemFromCatalogByUrl).toBe("function");
  expect(typeof deleteWardrobeItemFromCatalogByUrl).toBe("function");
});
