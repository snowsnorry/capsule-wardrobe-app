import { describe, expect, test } from "vitest";
import { shouldPreloadMainScreenForRoute } from "./mainScreenLoader";

describe("mainScreenLoader", () => {
  test.each([
    ["capsule", true],
    ["share", true],
    ["explore", false],
    ["statistics", false],
  ] as const)("preload predicate for %s returns %s", (route, expected) => {
    expect(shouldPreloadMainScreenForRoute(route)).toBe(expected);
  });
});
