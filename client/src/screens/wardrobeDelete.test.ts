import { describe, expect, test } from "vitest";
import {
  getWardrobeDeletionTarget,
  isDifferentWardrobeItem,
} from "./wardrobeDelete";

describe("wardrobeDelete", () => {
  test("builds deletion targets for uploaded and catalog items", () => {
    expect(
      getWardrobeDeletionTarget({
        id: " uploaded-1 ",
        source: "uploaded",
      }),
    ).toEqual({ kind: "uploaded", id: "uploaded-1" });
    expect(
      getWardrobeDeletionTarget({
        url: " https://example.com/1 ",
        source: "from_catalog",
      }),
    ).toEqual({ kind: "from_catalog", url: "https://example.com/1" });
  });

  test("rejects incomplete deletion targets", () => {
    expect(getWardrobeDeletionTarget({ source: "uploaded" })).toBeNull();
    expect(getWardrobeDeletionTarget({ source: "from_catalog" })).toBeNull();
  });

  test("matches local wardrobe items by deletion target", () => {
    const uploaded = { id: "uploaded-1", source: "uploaded" };
    const catalog = {
      id: "catalog-1",
      url: "https://example.com/1",
      source: "from_catalog",
    };

    expect(
      isDifferentWardrobeItem(uploaded, uploaded, {
        kind: "uploaded",
        id: "uploaded-1",
      }),
    ).toBe(false);
    expect(
      isDifferentWardrobeItem(
        { id: "uploaded-1" },
        { id: "other" },
        { kind: "uploaded", id: "uploaded-1" },
      ),
    ).toBe(false);
    expect(
      isDifferentWardrobeItem(
        { id: "uploaded-2" },
        { id: "other" },
        { kind: "uploaded", id: "uploaded-1" },
      ),
    ).toBe(true);
    expect(
      isDifferentWardrobeItem(
        catalog,
        { id: "other" },
        {
          kind: "from_catalog",
          url: "https://example.com/1",
        },
      ),
    ).toBe(false);
    expect(
      isDifferentWardrobeItem(
        { url: "https://example.com/2" },
        { id: "other" },
        { kind: "from_catalog", url: "https://example.com/1" },
      ),
    ).toBe(true);
  });
});
