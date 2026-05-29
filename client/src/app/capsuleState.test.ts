import { describe, expect, test } from "vitest";
import {
  areFiltersEqual,
  buildCapsuleStatus,
  buildDraftSnapshotFromState,
  buildEmptyCapsuleDraft,
  getEffectiveCapsule,
  getWardrobeMetadata,
  normalizeOutfitSets,
  sortSeasonOptions,
} from "./capsuleState";
import { createTestCapsule, createTestDraft } from "./testUtils";

describe("capsuleState", () => {
  test("sortSeasonOptions applies display order before alphabetical fallback", () => {
    expect(sortSeasonOptions(["autumn", "resort", "summer", "spring"])).toEqual(
      ["spring", "summer", "autumn", "resort"],
    );
  });

  test("normalizes outfit sets to valid item ids and image state", () => {
    expect(
      normalizeOutfitSets([
        {
          itemIds: [" top-1 ", "", null],
          image: " https://image ",
          imageObsolete: 1,
        },
        { itemIds: [] },
        { itemIds: ["bottom-1"], image: " " },
      ]),
    ).toEqual([
      { itemIds: ["top-1"], image: "https://image", imageObsolete: true },
      { itemIds: ["bottom-1"], image: null, imageObsolete: false },
    ]);
    expect(normalizeOutfitSets(null)).toEqual([]);
  });

  test("builds capsule status from saved and draft snapshots", () => {
    const saved = createTestDraft();

    expect(buildCapsuleStatus(null)).toBe("new");
    expect(buildCapsuleStatus({ saved, draft: null })).toBe("saved");
    expect(buildCapsuleStatus({ saved, draft: saved })).toBe("saved");
    expect(
      buildCapsuleStatus({
        saved,
        draft: createTestDraft({ text: "changed" }),
      }),
    ).toBe("modified");
    expect(buildCapsuleStatus({ saved: null, draft: saved })).toBe("new");
  });

  test("builds empty drafts and resolves effective capsule data", () => {
    const draft = buildEmptyCapsuleDraft();
    const capsule = createTestCapsule({ draft: null, saved: draft });

    expect(draft.filters.pattern).toBe("solid");
    expect(getEffectiveCapsule(capsule)).toBe(draft);
    expect(getEffectiveCapsule(null)).toBe(null);
  });

  test("builds draft snapshots with wardrobe metadata and rejected url fallback", () => {
    const activeCapsuleMeta = createTestCapsule({
      draft: createTestDraft(),
    });

    const snapshot = buildDraftSnapshotFromState({
      activeCapsuleMeta,
      profileItems: [{ id: "top-1" }],
      profileOutfitSets: [
        { itemIds: ["top-1"], image: null, imageObsolete: false },
      ],
      selectedAudience: "woman",
      selectedColor: "blue",
      selectedFormalityLevel: "casual",
      selectedOccasions: ["office"],
      selectedPattern: "solid",
      selectedSeason: ["summer"],
      selectedSourceMode: "wardrobe_preferred",
      selectedStyle: "minimalistic",
      selectedText: "linen",
    });

    expect(snapshot.data.wardrobe?.items).toEqual([{ id: "top-1" }]);
    expect(snapshot.data.wardrobe?.outfitSets).toEqual([
      { itemIds: ["top-1"], image: null, imageObsolete: false },
    ]);
    expect(snapshot.filters).toMatchObject({
      color: "blue",
      sourceMode: "wardrobe_preferred",
      text: "linen",
    });
  });

  test("compares filters by normalized values", () => {
    expect(
      areFiltersEqual(
        {
          occasions: ["office", "travel"],
          season: ["summer", "spring"],
          text: " linen ",
        },
        {
          occasions: ["travel", "office"],
          season: ["spring", "summer"],
          sourceMode: "catalog_only",
          text: "linen",
          pattern: "",
        },
      ),
    ).toBe(true);
    expect(
      areFiltersEqual(
        { sourceMode: "catalog_only" },
        { sourceMode: "wardrobe_preferred" },
      ),
    ).toBe(false);
    expect(
      areFiltersEqual(
        { sourceMode: "wardrobe_only" },
        { sourceMode: "wardrobe_preferred" },
      ),
    ).toBe(false);
    expect(areFiltersEqual({ color: "blue" }, { color: "green" })).toBe(false);
  });

  test("extracts wardrobe metadata with null fallbacks", () => {
    expect(
      getWardrobeMetadata({
        items: [],
        rawSelectionText: "raw",
        swimwearReasoning: "reason",
        swimwearRawSelectionText: "swim raw",
      }),
    ).toEqual({
      rawSelectionText: "raw",
      swimwearReasoning: "reason",
      swimwearRawSelectionText: "swim raw",
    });
    expect(getWardrobeMetadata(null)).toEqual({
      rawSelectionText: null,
      swimwearReasoning: null,
      swimwearRawSelectionText: null,
    });
  });
});
