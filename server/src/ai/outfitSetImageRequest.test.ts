import { test, expect } from "vitest";
import {
  getOutfitSetImageRequestContext,
  isValidOutfitSetImageRequest,
} from "./outfitSetImageRequest.js";

test("outfit set image request helpers normalize and validate route input", () => {
  expect(
    getOutfitSetImageRequestContext({
      user: { email: " PERSON@example.com " },
      params: { id: " capsule-1 ", setIndex: "2" },
    }),
  ).toEqual({
    email: "person@example.com",
    capsuleId: "capsule-1",
    setIndex: 2,
  });

  expect(
    isValidOutfitSetImageRequest({ capsuleId: "capsule-1", setIndex: 0 }),
  ).toBe(true);
  expect(isValidOutfitSetImageRequest({ capsuleId: "", setIndex: 0 })).toBe(
    false,
  );
  expect(
    isValidOutfitSetImageRequest({ capsuleId: "capsule-1", setIndex: -1 }),
  ).toBe(false);
  expect(
    isValidOutfitSetImageRequest({ capsuleId: "capsule-1", setIndex: NaN }),
  ).toBe(false);
});
