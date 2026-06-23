import { test, expect } from "vitest";
import {
  buildWardrobeOwnedR2KeyPrefix,
  getOwnedWardrobeR2KeysFromItem,
  mergeOwnedWardrobeR2Keys,
  normalizeOwnedWardrobeR2Keys,
} from "./wardrobeR2Keys.js";

const email = "person@example.com";
const prefix = "wardrobe/542d240129883c01/";

test("owned wardrobe R2 keys are scoped to the profile hash", () => {
  expect(buildWardrobeOwnedR2KeyPrefix(email)).toBe(prefix);
  expect(
    normalizeOwnedWardrobeR2Keys({
      email,
      keys: [
        `${prefix}image.webp`,
        `${prefix}image.webp`,
        `${prefix}image_clean.png`,
      ],
    }),
  ).toEqual([`${prefix}image.webp`, `${prefix}image_clean.png`]);
});

test("owned wardrobe R2 key normalization rejects unsafe and unowned values", () => {
  expect(
    normalizeOwnedWardrobeR2Keys({
      email,
      keys: [
        "",
        `/${prefix}image.webp`,
        `https://images.example.com/${prefix}image.webp`,
        "wardrobe/other-profile/image.webp",
        `${prefix}../image.webp`,
        `${prefix}nested\\image.webp`,
        `${prefix}nested/image.webp`,
      ],
    }),
  ).toEqual([`${prefix}nested/image.webp`]);
});

test("owned wardrobe R2 helpers merge and read item keys defensively", () => {
  expect(
    mergeOwnedWardrobeR2Keys({
      email,
      existingKeys: [`${prefix}source.webp`, "wardrobe/other/image.webp"],
      newKeys: [`${prefix}clean.webp`, `${prefix}source.webp`],
    }),
  ).toEqual([`${prefix}source.webp`, `${prefix}clean.webp`]);
  expect(
    getOwnedWardrobeR2KeysFromItem(
      {
        ownedR2ImageKeys: [`${prefix}source.webp`, "https://bad.example/key"],
      },
      email,
    ),
  ).toEqual([`${prefix}source.webp`]);
});
