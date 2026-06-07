import { describe, expect, test } from "vitest";
import {
  getAppRouteState,
  getCapsuleRouteState,
  getOutfitRouteState,
} from "./appRouting";

describe("appRouting", () => {
  test.each([
    ["/", "capsule", "", "empty"],
    ["/capsule", "capsule", "", "create"],
    ["/capsule/", "capsule", "", "create"],
    ["/capsule/capsule-1", "capsule", "capsule-1", "open"],
    ["/capsule/capsule%201/", "capsule", "capsule 1", "open"],
    ["/explore", "explore", "", "empty"],
    ["/personal-items", "wardrobe", "", "empty"],
    ["/personal-items/", "wardrobe", "", "empty"],
    ["/wardrobe", "capsule", "", "empty"],
  ])("parses %s", (pathname, appRoute, capsuleRouteId, capsuleRouteMode) => {
    expect(getAppRouteState(pathname)).toEqual({
      appRoute,
      capsuleRouteId,
      capsuleRouteMode,
      outfitRouteId: "",
      outfitRouteMode: "empty",
    });
  });

  test.each([
    ["/outfit", "", "create"],
    ["/outfit/", "", "create"],
    ["/outfit/outfit-1", "outfit-1", "open"],
    ["/outfit/outfit%201/", "outfit 1", "open"],
  ])("parses outfit route %s", (pathname, outfitRouteId, outfitRouteMode) => {
    expect(getAppRouteState(pathname)).toEqual({
      appRoute: "outfit",
      capsuleRouteId: "",
      capsuleRouteMode: "empty",
      outfitRouteId,
      outfitRouteMode,
    });
  });

  test("treats missing capsule id as an empty capsule route", () => {
    expect(getCapsuleRouteState("/capsule//")).toEqual({
      capsuleRouteId: "",
      capsuleRouteMode: "empty",
    });
  });

  test("treats missing outfit id as an empty outfit route", () => {
    expect(getOutfitRouteState("/outfit//")).toEqual({
      outfitRouteId: "",
      outfitRouteMode: "empty",
    });
  });
});
