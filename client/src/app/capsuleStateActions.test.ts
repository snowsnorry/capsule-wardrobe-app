import { describe, expect, test, vi } from "vitest";
import { applyCapsuleStateToApp } from "./capsuleStateActions";
import { createTestCapsule, createTestDraft } from "./testUtils";

function createContext() {
  return {
    clearWardrobeProgressState: vi.fn(),
    setActiveCapsuleId: vi.fn(),
    setActiveCapsuleMeta: vi.fn(),
    setCapsuleList: vi.fn(),
    setPendingImageSetIndexes: vi.fn(),
    setProfileItems: vi.fn(),
    setProfileOutfitSets: vi.fn(),
    setSelectedAudience: vi.fn(),
    setSelectedColor: vi.fn(),
    setSelectedFormalityLevel: vi.fn(),
    setSelectedOccasions: vi.fn(),
    setSelectedPattern: vi.fn(),
    setSelectedSeason: vi.fn(),
    setSelectedSourceMode: vi.fn(),
    setSelectedStyle: vi.fn(),
    setSelectedText: vi.fn(),
  };
}

describe("capsuleStateActions", () => {
  test.each([null, ""])(
    "normalizes legacy pattern %s to solid in UI state",
    (pattern) => {
      const context = createContext();
      const draft = createTestDraft({ pattern });

      applyCapsuleStateToApp(
        context,
        createTestCapsule({
          draft,
          effective: draft,
        }),
      );

      expect(context.setSelectedPattern).toHaveBeenCalledWith("solid");
    },
  );

  test("restores persisted source mode into UI state", () => {
    const context = createContext();
    const draft = createTestDraft({ sourceMode: "wardrobe_preferred" });

    applyCapsuleStateToApp(
      context,
      createTestCapsule({
        draft,
        effective: draft,
      }),
    );

    expect(context.setSelectedSourceMode).toHaveBeenCalledWith(
      "wardrobe_preferred",
    );
  });

  test("normalizes uploaded wardrobe snapshot items before rendering", () => {
    const context = createContext();
    const draft = createTestDraft({
      items: [
        {
          id: "uploaded-1",
          url: "wardrobe://uploaded-1",
          name: "Uploaded shirt",
          category: "top",
        },
      ],
    });

    applyCapsuleStateToApp(
      context,
      createTestCapsule({
        draft,
        effective: draft,
      }),
    );

    expect(context.setProfileItems).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "uploaded-1",
        source: "uploaded",
      }),
    ]);
  });
});
