import { describe, expect, test } from "vitest";
import { buildOutfitGridSectionSx } from "./OutfitScreenStyles";

describe("OutfitScreenStyles", () => {
  test("uses tighter mobile padding for multi-column grids", () => {
    expect(buildOutfitGridSectionSx(1).px).toEqual({
      xs: 1.25,
      sm: 2,
      md: 3,
    });
    expect(buildOutfitGridSectionSx(2).px).toEqual({ xs: 0, sm: 2, md: 3 });
  });

  test("removes mobile grid top padding after a compact report", () => {
    expect(buildOutfitGridSectionSx(2).pt).toEqual({ xs: 1.25, md: 2 });
    expect(buildOutfitGridSectionSx(2, true).pt).toEqual({ xs: 0, md: 2 });
  });
});
