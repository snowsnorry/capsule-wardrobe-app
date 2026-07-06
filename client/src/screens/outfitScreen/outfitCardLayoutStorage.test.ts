import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  readStoredOutfitMobileCardColumns,
  writeStoredOutfitMobileCardColumns,
} from "./outfitCardLayoutStorage";

describe("outfitCardLayoutStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("reads and writes valid outfit mobile card column preferences", () => {
    expect(readStoredOutfitMobileCardColumns()).toBe(2);

    writeStoredOutfitMobileCardColumns(3);

    expect(window.localStorage.getItem("outfit.mobileCardColumns")).toBe("3");
    expect(readStoredOutfitMobileCardColumns()).toBe(3);

    window.localStorage.setItem("outfit.mobileCardColumns", "4");
    expect(readStoredOutfitMobileCardColumns()).toBe(2);
  });

  test("falls back to default outfit mobile card columns when localStorage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    expect(readStoredOutfitMobileCardColumns()).toBe(2);
    expect(() => writeStoredOutfitMobileCardColumns(3)).not.toThrow();
  });
});
