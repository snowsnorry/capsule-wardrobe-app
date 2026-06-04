import { describe, expect, test } from "vitest";
import { getAppRouteState, getCapsuleRouteState } from "./appRouting";

describe("appRouting", () => {
  test.each([
    ["/", "capsule", "", "empty"],
    ["/capsule", "capsule", "", "create"],
    ["/capsule/", "capsule", "", "create"],
    ["/capsule/capsule-1", "capsule", "capsule-1", "open"],
    ["/capsule/capsule%201/", "capsule", "capsule 1", "open"],
    ["/explore", "explore", "", "empty"],
  ])("parses %s", (pathname, appRoute, capsuleRouteId, capsuleRouteMode) => {
    expect(getAppRouteState(pathname)).toEqual({
      appRoute,
      capsuleRouteId,
      capsuleRouteMode,
    });
  });

  test("treats missing capsule id as an empty capsule route", () => {
    expect(getCapsuleRouteState("/capsule//")).toEqual({
      capsuleRouteId: "",
      capsuleRouteMode: "empty",
    });
  });
});
