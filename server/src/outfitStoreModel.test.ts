import { describe, expect, test } from "vitest";
import {
  DEFAULT_OUTFIT_NAME,
  getEffectiveOutfitSnapshot,
  normalizeOutfitRecord,
  normalizeOutfitSnapshot,
} from "./outfitStoreModel.js";

describe("outfitStoreModel", () => {
  test("normalizes outfit item refs", () => {
    expect(
      normalizeOutfitSnapshot({
        items: [
          null,
          { url: "https://example.com/legacy", source: "catalog" },
          { url: " ", source: "uploaded" },
          { url: "wardrobe://1", source: "personal" },
          { url: " wardrobe://42 ", source: "uploaded", item: { id: 42 } },
          { url: " https://example.com/jacket ", source: "from_catalog" },
        ],
      }),
    ).toEqual({
      items: [
        { url: "wardrobe://42", source: "uploaded" },
        { url: "https://example.com/jacket", source: "from_catalog" },
      ],
    });
  });

  test("rejects non-object snapshots and preserves empty item lists", () => {
    expect(normalizeOutfitSnapshot(null)).toBeNull();
    expect(normalizeOutfitSnapshot([] as never)).toBeNull();
    expect(normalizeOutfitSnapshot({})).toEqual({ items: [] });
  });

  test("normalizes records and resolves status from draft and saved snapshots", () => {
    const saved = {
      items: [{ url: "https://example.com/saved", source: "from_catalog" }],
    };
    const draft = {
      items: [{ url: "wardrobe://draft", source: "uploaded" }],
    };

    expect(normalizeOutfitRecord(null)).toBeNull();
    expect(normalizeOutfitRecord({ id: "new", draft, saved: null })).toEqual({
      id: "new",
      draft,
      saved: null,
      status: "new",
    });
    expect(normalizeOutfitRecord({ id: "saved", draft: null, saved })).toEqual({
      id: "saved",
      draft: null,
      saved,
      status: "saved",
    });
    expect(normalizeOutfitRecord({ id: "same", draft: saved, saved })).toEqual({
      id: "same",
      draft: saved,
      saved,
      status: "saved",
    });
    expect(
      normalizeOutfitRecord({ id: "modified", draft, saved }),
    ).toMatchObject({
      id: "modified",
      draft,
      saved,
      status: "modified",
    });
  });

  test("uses draft before saved when resolving the effective snapshot", () => {
    const saved = {
      items: [{ url: "https://example.com/saved", source: "from_catalog" }],
    };
    const draft = {
      items: [{ url: "wardrobe://draft", source: "uploaded" }],
    };

    expect(getEffectiveOutfitSnapshot({ draft, saved })).toEqual(draft);
    expect(getEffectiveOutfitSnapshot({ draft: null, saved })).toEqual(saved);
    expect(getEffectiveOutfitSnapshot(null)).toBeNull();
    expect(DEFAULT_OUTFIT_NAME).toBe("<New outfit>");
  });
});
