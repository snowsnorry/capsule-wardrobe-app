import { describe, expect, test } from "vitest";
import { getItemFromResponse, getItemsFromResponse } from "./wardrobeResponse";

describe("wardrobeResponse", () => {
  test("reads item arrays and single items defensively", () => {
    const item = { id: "wardrobe-1", name: "Linen shirt" };

    expect(getItemsFromResponse({ items: [item] })).toEqual([item]);
    expect(getItemsFromResponse({ items: item })).toEqual([]);
    expect(getItemsFromResponse(null)).toEqual([]);

    expect(getItemFromResponse({ item })).toEqual(item);
    expect(getItemFromResponse({ item: [item] })).toBeNull();
    expect(getItemFromResponse(undefined)).toBeNull();
  });
});
