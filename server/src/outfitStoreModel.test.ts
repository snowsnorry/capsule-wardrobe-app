import { describe, expect, test } from "vitest";
import {
  DEFAULT_OUTFIT_NAME,
  getEffectiveOutfitSnapshot,
  normalizeOutfitRecord,
  normalizeOutfitSnapshot,
} from "./outfitStoreModel.js";

describe("outfitStoreModel", () => {
  test("normalizes outfit item snapshots and derives stable keys", () => {
    expect(
      normalizeOutfitSnapshot({
        items: [
          null,
          { item: null },
          { key: " explicit-key ", source: "personal", item: { id: 1 } },
          {
            source: "unknown",
            item: { url: " https://example.com/jacket ", name: "Jacket" },
          },
          { source: "personal", item: { wardrobeId: "42", name: "Hat" } },
          { item: { id: "catalog-7", name: "Shoes" } },
          { item: { name: "Missing key" } },
        ],
      }),
    ).toEqual({
      items: [
        { key: "explicit-key", source: "personal", item: { id: 1 } },
        {
          key: "https://example.com/jacket",
          source: "catalog",
          item: { url: " https://example.com/jacket ", name: "Jacket" },
        },
        {
          key: "wardrobe://42",
          source: "personal",
          item: { wardrobeId: "42", name: "Hat" },
        },
        {
          key: "wardrobe://catalog-7",
          source: "catalog",
          item: { id: "catalog-7", name: "Shoes" },
        },
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
      items: [{ key: "saved", source: "catalog", item: { url: "saved" } }],
    };
    const draft = {
      items: [{ key: "draft", source: "catalog", item: { url: "draft" } }],
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
      items: [{ key: "saved", source: "catalog", item: { url: "saved" } }],
    };
    const draft = {
      items: [{ key: "draft", source: "catalog", item: { url: "draft" } }],
    };

    expect(getEffectiveOutfitSnapshot({ draft, saved })).toEqual(draft);
    expect(getEffectiveOutfitSnapshot({ draft: null, saved })).toEqual(saved);
    expect(getEffectiveOutfitSnapshot(null)).toBeNull();
    expect(DEFAULT_OUTFIT_NAME).toBe("<New outfit>");
  });
});
