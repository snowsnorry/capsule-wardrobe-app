import { expect, test } from "vitest";
import { filterWardrobeItemsBySource } from "./wardrobeItemMappers";

test("filterWardrobeItemsBySource uses only explicit current source values", () => {
  const items = [
    { id: "uploaded", source: "uploaded" },
    { id: "catalog", source: "from_catalog" },
    { id: "legacy-catalog", source: "catalog" },
    { id: "missing" },
    { id: "unknown", source: "other" },
  ];

  expect(filterWardrobeItemsBySource(items, "uploaded")).toEqual([
    { id: "uploaded", source: "uploaded" },
  ]);
  expect(filterWardrobeItemsBySource(items, "from_catalog")).toEqual([
    { id: "catalog", source: "from_catalog" },
  ]);
  expect(filterWardrobeItemsBySource(items, null)).toBe(items);
});
