import { expect, test } from "vitest";
import { toAnchorItem } from "./ProfileFiltersAnchorUtils";

test("toAnchorItem maps only explicit current source values", () => {
  expect(
    toAnchorItem({
      id: 7,
      source: "from_catalog",
      url: "https://example.com/catalog",
      name: "Catalog coat",
    }),
  ).toMatchObject({
    id: "W7",
    source: "catalog",
    url: "https://example.com/catalog",
  });
  expect(
    toAnchorItem({
      id: 8,
      source: "uploaded",
      url: "wardrobe://8",
    }),
  ).toMatchObject({
    id: "W8",
    source: "uploaded",
  });
  expect(toAnchorItem({ id: 9, source: "catalog" })).toBeNull();
  expect(toAnchorItem({ id: 10, sourceType: "uploaded" })).toBeNull();
  expect(toAnchorItem({ id: 11, itemSource: "wardrobe" })).toBeNull();
  expect(toAnchorItem({ id: 12 })).toBeNull();
});
