import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import {
  applyCapsuleFilters,
  createNewCapsule,
  deleteCurrentCapsule,
  duplicateCurrentCapsule,
  importSharedCapsuleToApp,
  openCapsule,
  renameCurrentCapsule,
  resetProfileFilters,
  revertCurrentCapsule,
  refreshCapsuleList,
  saveCurrentCapsule,
  searchUserCapsules,
  shareCurrentCapsule,
} from "./capsuleActions";
import {
  createActionContext,
  createTestCapsule,
  createTestDraft,
} from "./testUtils";
import {
  duplicateCapsule,
  createCapsule,
  deleteCapsule,
  fetchCapsule,
  fetchRecentCapsules,
  importSharedCapsule,
  renameCapsule,
  revertCapsule,
  saveCapsule,
  searchCapsules,
  shareCapsule,
  updateCapsuleFilters,
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
  updateCapsuleFilters: vi.fn(),
}));

describe("capsuleActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchRecentCapsules).mockResolvedValue({
      capsules: [createTestCapsule()],
    });
  });

  test("does not write capsule draft before filters are explicitly applied", () => {
    const context = createActionContext({
      setSelectedStyle: vi.fn(),
    });

    expect(updateCapsuleFilters).not.toHaveBeenCalled();
    expect(context.setSelectedStyle).not.toHaveBeenCalled();
  });

  test("applyCapsuleFilters preserves generation filters in the API payload", async () => {
    vi.mocked(updateCapsuleFilters).mockResolvedValue({
      capsule: createTestCapsule(),
    });
    const context = createActionContext({
      buildCurrentDraftSnapshot: vi.fn(() =>
        createTestDraft({
          sourceMode: "wardrobe_preferred",
          text: "Prefer natural fabrics",
        }),
      ),
    });

    await applyCapsuleFilters(context);

    expect(updateCapsuleFilters).toHaveBeenCalledWith(
      "capsule-1",
      expect.objectContaining({
        sourceMode: "wardrobe_preferred",
        text: "Prefer natural fabrics",
      }),
      { regenerate: true },
    );
    expect(context.setIsLoadingItems).toHaveBeenCalledWith(false);
  });

  test("createNewCapsule creates an empty capsule and refreshes the list", async () => {
    vi.mocked(createCapsule).mockResolvedValue({
      capsule: createTestCapsule({ id: "capsule-2" }),
    });
    const context = createActionContext();

    await createNewCapsule(context);

    expect(context.setIsContentOperationLoading).toHaveBeenNthCalledWith(
      1,
      true,
    );
    expect(createCapsule).toHaveBeenCalledWith({
      filters: expect.objectContaining({ pattern: "solid" }),
    });
    expect(context.applyCapsuleState).toHaveBeenCalledWith(
      expect.objectContaining({ id: "capsule-2" }),
    );
    expect(context.setCapsuleList).toHaveBeenCalledWith([
      expect.objectContaining({ id: "capsule-1" }),
    ]);
    expect(context.setIsContentOperationLoading).toHaveBeenLastCalledWith(
      false,
    );
  });

  test("openCapsule applies capsule state and resumes snapshot events", async () => {
    vi.mocked(fetchCapsule).mockResolvedValue({
      capsule: createTestCapsule({ id: "capsule-2" }),
      snapshot: { status: "ready", items: [{ id: "top-1" }] },
    });
    const context = createActionContext({
      restoreCapsuleSnapshot: vi.fn(async () => undefined),
    });

    await openCapsule(context, "capsule-2");

    expect(fetchCapsule).toHaveBeenCalledWith("capsule-2");
    expect(context.applyCapsuleState).toHaveBeenCalledWith(
      expect.objectContaining({ id: "capsule-2" }),
    );
    expect(context.restoreCapsuleSnapshot).toHaveBeenCalledWith(
      "capsule-2",
      { status: "ready", items: [{ id: "top-1" }] },
      { shouldResumeEvents: true },
    );
  });

  test("current capsule mutations update only the active capsule", async () => {
    vi.mocked(saveCapsule).mockResolvedValue({
      capsule: createTestCapsule({ status: "saved" }),
    });
    vi.mocked(revertCapsule).mockResolvedValue({
      capsule: createTestCapsule({ status: "saved" }),
    });
    vi.mocked(renameCapsule).mockResolvedValue({
      capsule: createTestCapsule({ name: "Renamed" }),
    });
    vi.mocked(deleteCapsule).mockResolvedValue({
      activeCapsule: createTestCapsule({ id: "capsule-2" }),
    });
    const context = createActionContext();

    await saveCurrentCapsule(context, "capsule-1");
    await revertCurrentCapsule(context, "capsule-1");
    await renameCurrentCapsule(context, "Renamed", "capsule-1");
    await deleteCurrentCapsule(context, "capsule-1");
    await saveCurrentCapsule(context, "");

    expect(saveCapsule).toHaveBeenCalledWith("capsule-1");
    expect(revertCapsule).toHaveBeenCalledWith("capsule-1");
    expect(renameCapsule).toHaveBeenCalledWith("capsule-1", "Renamed");
    expect(deleteCapsule).toHaveBeenCalledWith("capsule-1");
    expect(context.setActiveCapsuleMeta).toHaveBeenCalledWith(
      expect.objectContaining({ status: "saved" }),
    );
    expect(context.applyCapsuleState).toHaveBeenCalledWith(
      expect.objectContaining({ id: "capsule-2" }),
    );
    expect(saveCapsule).toHaveBeenCalledTimes(1);
  });

  test("duplicateCurrentCapsule switches to the duplicate without reverting the source capsule", async () => {
    vi.mocked(duplicateCapsule).mockResolvedValue({
      capsule: createTestCapsule({
        id: "capsule-2",
        name: "Copied capsule",
        status: "saved",
      }),
    });
    const context = createActionContext();

    await duplicateCurrentCapsule(context, "Copied capsule", "capsule-1");

    expect(duplicateCapsule).toHaveBeenCalledWith(
      "capsule-1",
      "Copied capsule",
    );
    expect(context.applyCapsuleState).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "capsule-2",
        name: "Copied capsule",
      }),
    );
    expect(revertCapsule).not.toHaveBeenCalled();
  });

  test("searchUserCapsules returns an empty list when response omits capsules", async () => {
    vi.mocked(searchCapsules).mockResolvedValue({});

    await expect(searchUserCapsules("spring")).resolves.toEqual([]);

    expect(searchCapsules).toHaveBeenCalledWith("spring");
  });

  test("refreshCapsuleList falls back to an empty list when the response omits capsules", async () => {
    vi.mocked(fetchRecentCapsules).mockResolvedValueOnce({});
    const context = createActionContext();

    await refreshCapsuleList(context);

    expect(context.setCapsuleList).toHaveBeenCalledWith([]);
  });

  test("resetProfileFilters restores the active capsule or reports errors", async () => {
    vi.mocked(fetchCapsule).mockResolvedValueOnce({
      capsule: createTestCapsule({ id: "capsule-1" }),
    });
    const context = createActionContext();

    await resetProfileFilters(context);

    expect(context.setSelectedRegenerationUrls).toHaveBeenCalledWith([]);
    expect(context.setPartialRegenerationPendingUrls).toHaveBeenCalledWith([]);
    expect(context.applyCapsuleState).toHaveBeenCalledWith(
      expect.objectContaining({ id: "capsule-1" }),
    );

    vi.mocked(fetchCapsule).mockRejectedValueOnce(new Error("boom"));
    await resetProfileFilters(context);

    expect(context.setStatus).toHaveBeenLastCalledWith({
      loading: false,
      error: "boom",
      infoKey: "",
      infoParams: null,
    });
  });

  test("applyCapsuleFilters handles pending and failing regeneration", async () => {
    vi.mocked(updateCapsuleFilters).mockResolvedValueOnce({
      status: "pending",
      capsule: createTestCapsule(),
    });
    const context = createActionContext();

    await applyCapsuleFilters(context);

    expect(context.startPendingNotificationFlow).toHaveBeenCalledWith("full");
    expect(context.startCapsuleEventStream).toHaveBeenCalledWith("capsule-1");
    expect(context.setIsLoadingItems).not.toHaveBeenLastCalledWith(false);

    vi.mocked(updateCapsuleFilters).mockRejectedValueOnce(
      new Error("invalid_payload"),
    );
    await applyCapsuleFilters(context);

    expect(context.setStatus).toHaveBeenLastCalledWith({
      loading: false,
      error: "invalid_payload",
      infoKey: "",
      infoParams: null,
    });
  });

  test("current capsule mutations skip inactive capsule state updates", async () => {
    vi.mocked(saveCapsule).mockResolvedValue({
      capsule: createTestCapsule({ id: "capsule-2", status: "saved" }),
    });
    vi.mocked(revertCapsule).mockResolvedValue({
      capsule: createTestCapsule({ id: "capsule-2", status: "saved" }),
    });
    vi.mocked(renameCapsule).mockResolvedValue({
      capsule: createTestCapsule({ id: "capsule-2", name: "Other" }),
    });
    vi.mocked(deleteCapsule).mockResolvedValue({});
    const context = createActionContext({ activeCapsuleId: "capsule-1" });

    await saveCurrentCapsule(context, "capsule-2");
    await revertCurrentCapsule(context, "capsule-2");
    await renameCurrentCapsule(context, "Other", "capsule-2");
    await deleteCurrentCapsule(context, "capsule-2");

    expect(context.setActiveCapsuleMeta).not.toHaveBeenCalled();
    expect(context.applyCapsuleState).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: "capsule-2" }),
    );
  });

  test("applyCapsuleFilters preserves local draft when API omits the capsule", async () => {
    vi.mocked(updateCapsuleFilters).mockResolvedValueOnce({});
    const draft = createTestDraft({ text: "Keep linen options" });
    const current = createTestCapsule({ name: "Current draft" });
    const context = createActionContext({
      buildCurrentDraftSnapshot: vi.fn(() => draft),
    });

    await applyCapsuleFilters(context);

    const updater = (context.setActiveCapsuleMeta as Mock).mock.calls[0][0] as (
      capsule: ReturnType<typeof createTestCapsule>,
    ) => ReturnType<typeof createTestCapsule>;
    expect(updater(current)).toEqual({
      ...current,
      draft: {
        filters: draft.filters,
        data: { wardrobe: null, rejectedUrls: [] },
      },
    });
    expect(updater(null)).toBeNull();
  });

  test("shareCurrentCapsule returns an empty object for missing ids and mapped errors", async () => {
    const context = createActionContext();

    await expect(shareCurrentCapsule(context, "")).resolves.toEqual({});

    vi.mocked(shareCapsule).mockResolvedValueOnce({
      url: "https://share.example.test",
    });
    await expect(shareCurrentCapsule(context, "capsule-1")).resolves.toEqual({
      url: "https://share.example.test",
    });

    vi.mocked(shareCapsule).mockRejectedValueOnce(
      new Error("capsule_not_shareable"),
    );
    await expect(shareCurrentCapsule(context, "capsule-1")).resolves.toEqual(
      {},
    );
    expect(context.setStatus).toHaveBeenLastCalledWith({
      loading: false,
      error: "capsule_not_shareable",
      infoKey: "",
      infoParams: null,
    });
  });

  test("importSharedCapsuleToApp imports, refreshes list, and clears the share route", async () => {
    vi.mocked(importSharedCapsule).mockResolvedValue({
      capsule: createTestCapsule({ id: "capsule-2", name: "Shared edit" }),
    });
    const context = createActionContext();

    await importSharedCapsuleToApp(context, "share-1");

    expect(context.setIsShareLoading).toHaveBeenCalledWith(true);
    expect(importSharedCapsule).toHaveBeenCalledWith("share-1");
    expect(context.applyCapsuleState).toHaveBeenCalledWith(
      expect.objectContaining({ id: "capsule-2" }),
    );
    expect(fetchRecentCapsules).toHaveBeenCalled();
    expect(context.clearShareRoute).toHaveBeenCalled();
    expect(context.setIsShareLoading).toHaveBeenLastCalledWith(false);
  });

  test("importSharedCapsuleToApp handles blank ids, errors, and unmounted cleanup", async () => {
    const context = createActionContext();

    await importSharedCapsuleToApp(context, "");

    expect(importSharedCapsule).not.toHaveBeenCalled();

    vi.mocked(importSharedCapsule).mockRejectedValueOnce(
      new Error("not_found"),
    );
    await importSharedCapsuleToApp(context, "share-1");

    expect(context.clearShareRoute).toHaveBeenCalled();
    expect(context.setStatus).toHaveBeenLastCalledWith({
      loading: false,
      error: "not_found",
      infoKey: "",
      infoParams: null,
    });

    vi.mocked(importSharedCapsule).mockResolvedValueOnce({});
    const unmountedContext = createActionContext({
      isMountedRef: { current: false },
    });
    await importSharedCapsuleToApp(unmountedContext, "share-2");

    expect(unmountedContext.setIsShareLoading).toHaveBeenCalledWith(true);
    expect(unmountedContext.setIsShareLoading).not.toHaveBeenCalledWith(false);
  });
});
