import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  applyCapsuleFilters,
  duplicateCurrentCapsule,
  importSharedCapsuleToApp
} from "./capsuleActions";
import { createActionContext, createTestCapsule, createTestDraft } from "./testUtils";
import {
  duplicateCapsule,
  fetchRecentCapsules,
  importSharedCapsule,
  revertCapsule,
  updateCapsuleFilters
} from "../api/capsules";

vi.mock("../api/capsules", () => ({
  createCapsule: vi.fn(),
  deleteCapsule: vi.fn(),
  duplicateCapsule: vi.fn(),
  fetchCapsule: vi.fn(),
  fetchRecentCapsules: vi.fn(),
  importSharedCapsule: vi.fn(),
  renameCapsule: vi.fn(),
  revertCapsule: vi.fn(),
  saveCapsule: vi.fn(),
  searchCapsules: vi.fn(),
  shareCapsule: vi.fn(),
  updateCapsuleFilters: vi.fn()
}));

describe("capsuleActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchRecentCapsules).mockResolvedValue({ capsules: [createTestCapsule()] });
  });

  test("does not write capsule draft before filters are explicitly applied", () => {
    const context = createActionContext({
      setSelectedStyle: vi.fn()
    });

    expect(updateCapsuleFilters).not.toHaveBeenCalled();
    expect(context.setSelectedStyle).not.toHaveBeenCalled();
  });

  test("applyCapsuleFilters preserves optional text in the API payload", async () => {
    vi.mocked(updateCapsuleFilters).mockResolvedValue({ capsule: createTestCapsule() });
    const context = createActionContext({
      buildCurrentDraftSnapshot: vi.fn(() => createTestDraft({ text: "Prefer natural fabrics" }))
    });

    await applyCapsuleFilters(context);

    expect(updateCapsuleFilters).toHaveBeenCalledWith(
      "capsule-1",
      expect.objectContaining({ text: "Prefer natural fabrics" }),
      { regenerate: true }
    );
    expect(context.setIsLoadingItems).toHaveBeenCalledWith(false);
  });

  test("duplicateCurrentCapsule switches to the duplicate without reverting the source capsule", async () => {
    vi.mocked(duplicateCapsule).mockResolvedValue({
      capsule: createTestCapsule({ id: "capsule-2", name: "Copied capsule", status: "saved" })
    });
    const context = createActionContext();

    await duplicateCurrentCapsule(context, "Copied capsule", "capsule-1");

    expect(duplicateCapsule).toHaveBeenCalledWith("capsule-1", "Copied capsule");
    expect(context.applyCapsuleState).toHaveBeenCalledWith(expect.objectContaining({
      id: "capsule-2",
      name: "Copied capsule"
    }));
    expect(revertCapsule).not.toHaveBeenCalled();
  });

  test("importSharedCapsuleToApp imports, refreshes list, and clears the share route", async () => {
    vi.mocked(importSharedCapsule).mockResolvedValue({
      capsule: createTestCapsule({ id: "capsule-2", name: "Shared edit" })
    });
    const context = createActionContext();

    await importSharedCapsuleToApp(context, "share-1");

    expect(context.setIsShareLoading).toHaveBeenCalledWith(true);
    expect(importSharedCapsule).toHaveBeenCalledWith("share-1");
    expect(context.applyCapsuleState).toHaveBeenCalledWith(expect.objectContaining({ id: "capsule-2" }));
    expect(fetchRecentCapsules).toHaveBeenCalled();
    expect(context.clearShareRoute).toHaveBeenCalled();
    expect(context.setIsShareLoading).toHaveBeenLastCalledWith(false);
  });
});
