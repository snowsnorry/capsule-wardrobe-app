import { describe, expect, test, vi } from "vitest";
import { buildUniqueOutfitNameForStore } from "./outfitStoreNaming.js";

describe("buildUniqueOutfitNameForStore", () => {
  test("keeps a trimmed preferred name when it is unused", async () => {
    const listNames = vi.fn(async () => ["Work", "Travel"]);

    await expect(
      buildUniqueOutfitNameForStore(
        "person@example.com",
        "  Weekend  ",
        listNames,
      ),
    ).resolves.toBe("Weekend");
    expect(listNames).toHaveBeenCalledWith("person@example.com");
  });

  test("uses the default name and increments past existing suffixes", async () => {
    const listNames = vi.fn(async () => [
      "<New outfit>",
      "<New outfit> (1)",
      "<New outfit> (2)",
    ]);

    await expect(
      buildUniqueOutfitNameForStore("person@example.com", " ", listNames),
    ).resolves.toBe("<New outfit> (3)");
  });
});
