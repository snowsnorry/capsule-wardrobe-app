import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  readStoredMyWardrobeMobileCardColumns,
  writeStoredMyWardrobeMobileCardColumns,
} from "./MyWardrobeCardLayoutStorage";

describe("MyWardrobeCardLayoutStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("reads and writes valid mobile card column preferences", () => {
    expect(readStoredMyWardrobeMobileCardColumns()).toBe(2);

    writeStoredMyWardrobeMobileCardColumns(3);

    expect(window.localStorage.getItem("myWardrobe.mobileCardColumns")).toBe(
      "3",
    );
    expect(readStoredMyWardrobeMobileCardColumns()).toBe(3);

    window.localStorage.setItem("myWardrobe.mobileCardColumns", "4");
    expect(readStoredMyWardrobeMobileCardColumns()).toBe(2);
  });

  test("uses the default when window is unavailable", () => {
    vi.stubGlobal("window", undefined);

    expect(readStoredMyWardrobeMobileCardColumns()).toBe(2);
    expect(() => writeStoredMyWardrobeMobileCardColumns(1)).not.toThrow();
  });
});
