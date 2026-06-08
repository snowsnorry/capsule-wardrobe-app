import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  readStoredWardrobeMobileCardColumns,
  writeStoredWardrobeMobileCardColumns,
} from "./WardrobeCardLayoutStorage";

describe("WardrobeCardLayoutStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("reads and writes valid mobile card column preferences", () => {
    expect(readStoredWardrobeMobileCardColumns()).toBe(2);

    writeStoredWardrobeMobileCardColumns(3);

    expect(window.localStorage.getItem("wardrobe.mobileCardColumns")).toBe("3");
    expect(readStoredWardrobeMobileCardColumns()).toBe(3);

    window.localStorage.setItem("wardrobe.mobileCardColumns", "4");
    expect(readStoredWardrobeMobileCardColumns()).toBe(2);
  });

  test("uses the default when window is unavailable", () => {
    vi.stubGlobal("window", undefined);

    expect(readStoredWardrobeMobileCardColumns()).toBe(2);
    expect(() => writeStoredWardrobeMobileCardColumns(1)).not.toThrow();
  });
});
