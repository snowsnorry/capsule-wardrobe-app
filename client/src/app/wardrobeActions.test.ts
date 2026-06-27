import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Mock } from "vitest";
import { downloadCapsulePdf } from "../api/capsules";
import {
  removeCatalogItemFromPersonalItems,
  saveCatalogItemToPersonalItems,
  updateUploadedWardrobeItem,
} from "../api/personalItems";
import {
  deleteOutfitSetImage,
  generateOutfitSetImage,
  regenerateCapsuleWardrobe,
  regenerateSelectedWardrobeItems,
  subscribeCapsuleEvents,
} from "../api/wardrobe";
import {
  deleteGeneratedOutfitSetImage,
  downloadWardrobePdf,
  generateOutfitSetImage as generateOutfitSetImageAction,
  handleWardrobeError,
  removeItemFromPersonalItems,
  refreshWardrobe,
  regenerateSelectedItems,
  saveItemToPersonalItems,
  startCapsuleEventStream,
  stopCapsuleEventStream,
  toggleRegenerationSelection,
  updateUploadedItemInPersonalItems,
} from "./wardrobeActions";
import { createActionContext } from "./testUtils";

vi.mock("../api/capsules", () => ({
  downloadCapsulePdf: vi.fn(),
}));
vi.mock("../api/personalItems", () => ({
  removeCatalogItemFromPersonalItems: vi.fn(),
  saveCatalogItemToPersonalItems: vi.fn(),
  updateUploadedWardrobeItem: vi.fn(),
}));
vi.mock("../api/wardrobe", () => ({
  deleteOutfitSetImage: vi.fn(),
  generateOutfitSetImage: vi.fn(),
  regenerateCapsuleWardrobe: vi.fn(),
  regenerateSelectedWardrobeItems: vi.fn(),
  subscribeCapsuleEvents: vi.fn(),
}));

function createJobResponse(id = "job-1") {
  return {
    ok: true,
    job: {
      id,
      kind: "capsuleGenerate",
      status: "queued",
      phase: "queued",
      progress: { current: 0, total: null, label: null },
      entity: { type: "capsule", id: "capsule-1" },
      result: null,
      error: null,
      createdAt: "",
      updatedAt: "",
      startedAt: null,
      completedAt: null,
      failedAt: null,
    },
  } as const;
}

function createFailedJobResponse() {
  const response = createJobResponse();
  return {
    ...response,
    job: {
      ...response.job,
      status: "failed",
      phase: "failed",
      error: { code: "service_unavailable", message: "failed" },
      failedAt: "",
    },
  } as const;
}

function mockCalls(fn: unknown) {
  return (fn as Mock).mock.calls;
}

describe("wardrobeActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("downloadWardrobePdf toggles the PDF busy flag around the API call", async () => {
    vi.mocked(downloadCapsulePdf).mockResolvedValue(undefined);
    const context = createActionContext({
      applyWardrobeSnapshot: vi.fn(async () => undefined),
    });

    await downloadWardrobePdf(context, "capsule-1");

    expect(context.setIsDownloadingWardrobePdf).toHaveBeenNthCalledWith(
      1,
      true,
    );
    expect(downloadCapsulePdf).toHaveBeenCalledWith("capsule-1");
    expect(context.setIsDownloadingWardrobePdf).toHaveBeenLastCalledWith(false);
  });

  test("downloadWardrobePdf reports download failures and skips missing capsule ids", async () => {
    vi.mocked(downloadCapsulePdf).mockRejectedValue(new Error("network"));
    const context = createActionContext({
      applyWardrobeSnapshot: vi.fn(async () => undefined),
    });

    await downloadWardrobePdf(context, "");
    await downloadWardrobePdf(context, "capsule-1");

    expect(downloadCapsulePdf).toHaveBeenCalledTimes(1);
    expect(context.setStatus).toHaveBeenCalledWith(expect.any(Function));
    const statusUpdater = mockCalls(context.setStatus).at(-1)?.[0] as (
      current: unknown,
    ) => unknown;
    expect(statusUpdater({ error: "" })).toEqual({ error: "Download failed" });
    expect(context.setIsDownloadingWardrobePdf).toHaveBeenLastCalledWith(false);
  });

  test("handleWardrobeError clears wardrobe and pending regeneration state", () => {
    const context = createActionContext();

    handleWardrobeError(context);

    expect(context.setProfileItems).toHaveBeenCalledWith([]);
    expect(context.setProfileOutfitSets).toHaveBeenCalledWith([]);
    expect(context.setPendingImageSetIndexes).toHaveBeenCalledWith([]);
    expect(context.setIsWardrobePending).toHaveBeenCalledWith(false);
    expect(context.setHasPendingAdditionalItems).toHaveBeenCalledWith(false);
    expect(context.setIsLoadingItems).toHaveBeenCalledWith(false);
  });

  test("regenerateSelectedItems sends selected urls and subscribes to capsule events when pending", async () => {
    vi.mocked(regenerateSelectedWardrobeItems).mockResolvedValue({
      ...createJobResponse(),
    });
    const context = createActionContext({
      profileItems: [
        { id: "top-1", url: "https://example.com/top-1" },
        { id: "bottom-1", url: "https://example.com/bottom-1" },
      ],
      selectedRegenerationUrls: ["https://example.com/top-1"],
    });

    await regenerateSelectedItems(context);

    expect(context.setSelectedRegenerationUrls).toHaveBeenCalledWith([]);
    expect(context.setPartialRegenerationPendingUrls).toHaveBeenCalledWith([
      "https://example.com/top-1",
    ]);
    expect(context.setIsPartialRegenerationLoading).toHaveBeenCalledWith(true);
    expect(regenerateSelectedWardrobeItems).toHaveBeenCalledWith({
      itemUrls: ["https://example.com/top-1"],
      capsuleId: "capsule-1",
    });
    expect(context.startPendingNotificationFlow).toHaveBeenCalledWith(
      "partial",
    );
    expect(subscribeCapsuleEvents).toHaveBeenCalledWith(
      expect.objectContaining({ capsuleId: "capsule-1" }),
    );
  });

  test("regenerateSelectedItems handles guards, queued responses, and errors", async () => {
    const guardedContext = createActionContext({
      selectedRegenerationUrls: [],
      isPartialRegenerationLoading: false,
    });
    await regenerateSelectedItems(guardedContext);
    expect(regenerateSelectedWardrobeItems).not.toHaveBeenCalled();

    vi.mocked(regenerateSelectedWardrobeItems).mockResolvedValueOnce({
      ...createJobResponse(),
    });
    const readyContext = createActionContext({
      selectedRegenerationUrls: ["https://example.com/top-1"],
      profileItems: [{ id: "top-1", url: "https://example.com/top-1" }],
    });
    await regenerateSelectedItems(readyContext);
    expect(readyContext.setIsPartialRegenerationLoading).toHaveBeenCalledWith(
      true,
    );
    expect(readyContext.startPendingNotificationFlow).toHaveBeenCalledWith(
      "partial",
    );
    expect(subscribeCapsuleEvents).toHaveBeenCalledWith(
      expect.objectContaining({ capsuleId: "capsule-1" }),
    );

    vi.mocked(regenerateSelectedWardrobeItems).mockRejectedValueOnce(
      new Error("invalid_payload"),
    );
    const failingContext = createActionContext({
      selectedRegenerationUrls: ["https://example.com/top-1"],
      profileItems: [{ id: "top-1", url: "https://example.com/top-1" }],
    });
    await regenerateSelectedItems(failingContext);
    expect(failingContext.setProfileItems).toHaveBeenCalledWith([
      { id: "top-1", url: "https://example.com/top-1" },
    ]);
    expect(failingContext.closeNotificationPrompt).toHaveBeenCalled();
    expect(failingContext.setStatus).toHaveBeenCalledWith(expect.any(Function));
    const invalidPayloadUpdater = mockCalls(failingContext.setStatus).at(
      -1,
    )?.[0] as (current: unknown) => unknown;
    expect(invalidPayloadUpdater({ error: "" })).toEqual({
      error: "invalid_payload",
    });

    vi.mocked(regenerateSelectedWardrobeItems).mockRejectedValueOnce(
      new Error("network"),
    );
    const genericFailingContext = createActionContext({
      selectedRegenerationUrls: ["https://example.com/top-1"],
      profileItems: null,
    });
    await regenerateSelectedItems(genericFailingContext);
    const genericUpdater = mockCalls(genericFailingContext.setStatus).at(
      -1,
    )?.[0] as (current: unknown) => unknown;
    expect(genericUpdater({ error: "" })).toEqual({
      error: "Failed to regenerate selected items",
    });
  });

  test("saveItemToPersonalItems posts catalog item URLs and reports failures", async () => {
    vi.mocked(saveCatalogItemToPersonalItems).mockResolvedValueOnce({
      ok: true,
    });
    const context = createActionContext();

    await saveItemToPersonalItems(context, {
      url: " https://example.com/top-1 ",
    });
    await saveItemToPersonalItems(context, { url: " " });

    expect(saveCatalogItemToPersonalItems).toHaveBeenCalledTimes(1);
    expect(saveCatalogItemToPersonalItems).toHaveBeenCalledWith(
      "https://example.com/top-1",
    );
    expect(context.setIsContentOperationLoading).toHaveBeenNthCalledWith(
      1,
      true,
    );
    expect(context.setIsContentOperationLoading).toHaveBeenLastCalledWith(
      false,
    );
    const itemsUpdater = mockCalls(context.setProfileItems).at(-1)?.[0] as (
      current: unknown,
    ) => unknown;
    expect(itemsUpdater(null)).toBeNull();
    expect(itemsUpdater([{ url: "https://example.com/other" }])).toEqual([
      { url: "https://example.com/other" },
    ]);
    const successUpdater = mockCalls(context.setStatus).at(-1)?.[0] as (
      current: unknown,
    ) => unknown;
    expect(successUpdater({ error: "old" })).toEqual({
      error: "",
      infoKey: "wardrobe.saved",
      infoParams: null,
    });

    vi.mocked(saveCatalogItemToPersonalItems).mockRejectedValueOnce(
      new Error("not_found"),
    );
    await saveItemToPersonalItems(context, {
      url: "https://example.com/missing",
    });
    const notFoundUpdater = mockCalls(context.setStatus).at(-1)?.[0] as (
      current: unknown,
    ) => unknown;
    expect(notFoundUpdater({ error: "" })).toEqual({
      error: "wardrobe.saveNotFound",
      infoKey: "",
      infoParams: null,
    });

    vi.mocked(saveCatalogItemToPersonalItems).mockRejectedValueOnce(
      new Error("network"),
    );
    const genericFailureContext = createActionContext({
      isMountedRef: { current: false },
    });
    await saveItemToPersonalItems(genericFailureContext, {
      url: "https://example.com/failing",
    });
    const genericErrorUpdater = mockCalls(genericFailureContext.setStatus).at(
      -1,
    )?.[0] as (current: unknown) => unknown;
    expect(genericErrorUpdater({ error: "" })).toEqual({
      error: "wardrobe.saveFailed",
      infoKey: "",
      infoParams: null,
    });
    expect(
      genericFailureContext.setIsContentOperationLoading,
    ).toHaveBeenCalledTimes(1);
    expect(
      genericFailureContext.setIsContentOperationLoading,
    ).toHaveBeenCalledWith(true);
  });

  test("removeItemFromPersonalItems deletes catalog item URLs and clears saved state", async () => {
    vi.mocked(removeCatalogItemFromPersonalItems).mockResolvedValueOnce({
      ok: true,
      removed: true,
    });
    const context = createActionContext();

    await removeItemFromPersonalItems(context, {
      url: " https://example.com/top-1 ",
    });
    await removeItemFromPersonalItems(context, { url: " " });

    expect(removeCatalogItemFromPersonalItems).toHaveBeenCalledTimes(1);
    expect(removeCatalogItemFromPersonalItems).toHaveBeenCalledWith(
      "https://example.com/top-1",
    );
    expect(context.setIsContentOperationLoading).toHaveBeenNthCalledWith(
      1,
      true,
    );
    expect(context.setIsContentOperationLoading).toHaveBeenLastCalledWith(
      false,
    );
    const itemsUpdater = mockCalls(context.setProfileItems).at(-1)?.[0] as (
      current: unknown,
    ) => unknown;
    expect(
      itemsUpdater([
        {
          url: "https://example.com/top-1",
          isSavedToWardrobe: true,
        },
      ]),
    ).toEqual([
      {
        url: "https://example.com/top-1",
        isSavedToWardrobe: false,
      },
    ]);
    const successUpdater = mockCalls(context.setStatus).at(-1)?.[0] as (
      current: unknown,
    ) => unknown;
    expect(successUpdater({ error: "old" })).toEqual({
      error: "",
      infoKey: "wardrobe.removed",
      infoParams: null,
    });

    vi.mocked(removeCatalogItemFromPersonalItems).mockRejectedValueOnce(
      new Error("network"),
    );
    await removeItemFromPersonalItems(context, {
      url: "https://example.com/top-1",
    });
    const errorUpdater = mockCalls(context.setStatus).at(-1)?.[0] as (
      current: unknown,
    ) => unknown;
    expect(errorUpdater({ error: "" })).toEqual({
      error: "wardrobe.removeFailed",
      infoKey: "",
      infoParams: null,
    });
  });

  test("updateUploadedItemInPersonalItems patches uploaded details and preserves capsule item id", async () => {
    vi.mocked(updateUploadedWardrobeItem).mockResolvedValueOnce({
      item: {
        id: "uploaded-1",
        name: "Updated uploaded top",
        source: "uploaded",
        audience: "all",
        category: "top",
        season: ["summer"],
      },
    });
    const context = createActionContext();
    const payload = {
      name: "Updated uploaded top",
      description: null,
      brand: null,
      audience: "all",
      category: "top",
      season: ["summer"],
      formalityLevel: [],
      style: [],
      occasions: [],
      colorBase: [],
      pattern: null,
      finish: null,
      composition: null,
      silhouette: null,
      fit: null,
      closureType: [],
    };

    const updated = await updateUploadedItemInPersonalItems(
      context,
      {
        id: "Wuploaded-1",
        wardrobeId: "uploaded-1",
        url: "wardrobe://uploaded-1",
        source: "uploaded",
      },
      payload,
    );

    expect(updateUploadedWardrobeItem).toHaveBeenCalledWith(
      "uploaded-1",
      payload,
    );
    expect(updated).toEqual(
      expect.objectContaining({
        id: "Wuploaded-1",
        name: "Updated uploaded top",
        source: "uploaded",
        wardrobeId: "uploaded-1",
      }),
    );
    const itemsUpdater = mockCalls(context.setProfileItems).at(-1)?.[0] as (
      current: unknown,
    ) => unknown;
    expect(
      itemsUpdater([
        {
          id: "Wuploaded-1",
          url: "wardrobe://uploaded-1",
          name: "Old uploaded top",
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        id: "Wuploaded-1",
        name: "Updated uploaded top",
        wardrobeId: "uploaded-1",
      }),
    ]);
  });

  test("updateUploadedItemInPersonalItems accepts alternate uploaded ids and fallback payloads", async () => {
    const payload = {
      name: "Payload-only top",
      description: null,
      brand: null,
      audience: "all",
      category: "top",
      season: ["spring"],
      formalityLevel: [],
      style: [],
      occasions: [],
      colorBase: [],
      pattern: null,
      finish: null,
      composition: null,
      silhouette: null,
      fit: null,
      closureType: [],
    };
    vi.mocked(updateUploadedWardrobeItem).mockResolvedValueOnce({ item: null });
    const explicitContext = createActionContext();

    const explicitUpdated = await updateUploadedItemInPersonalItems(
      explicitContext,
      {
        wardrobeId: "explicit-uploaded-1",
        source: "uploaded",
      },
      payload,
    );

    expect(updateUploadedWardrobeItem).toHaveBeenCalledWith(
      "explicit-uploaded-1",
      payload,
    );
    expect(explicitUpdated).toEqual(
      expect.objectContaining({
        name: "Payload-only top",
        source: "uploaded",
        wardrobeId: "explicit-uploaded-1",
      }),
    );
    const explicitItemsUpdater = mockCalls(explicitContext.setProfileItems).at(
      -1,
    )?.[0] as (current: unknown) => unknown;
    expect(explicitItemsUpdater(null)).toBeNull();

    vi.mocked(updateUploadedWardrobeItem).mockResolvedValueOnce({
      item: {
        id: "uploaded-from-response",
        name: "Updated by url",
        source: "uploaded",
      },
    });
    const urlContext = createActionContext();
    await updateUploadedItemInPersonalItems(
      urlContext,
      {
        wardrobeId: "wardrobe-id-from-alias",
        url: "https://example.com/uploaded-item",
      },
      payload,
    );

    expect(updateUploadedWardrobeItem).toHaveBeenLastCalledWith(
      "wardrobe-id-from-alias",
      payload,
    );
    const urlItemsUpdater = mockCalls(urlContext.setProfileItems).at(
      -1,
    )?.[0] as (current: unknown) => unknown;
    expect(
      urlItemsUpdater([
        {
          id: "different-id",
          wardrobeId: "wardrobe-id-from-alias",
          url: " https://example.com/uploaded-item ",
          name: "Old by identity",
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        id: "uploaded-from-response",
        name: "Updated by url",
      }),
    ]);

    vi.mocked(updateUploadedWardrobeItem).mockResolvedValueOnce({
      item: {
        id: "source-uploaded-1",
        name: "Updated by source id",
        source: "uploaded",
      },
    });
    await updateUploadedItemInPersonalItems(
      createActionContext(),
      {
        id: "source-uploaded-1",
        source: "uploaded",
      },
      payload,
    );
    expect(updateUploadedWardrobeItem).toHaveBeenLastCalledWith(
      "source-uploaded-1",
      payload,
    );
  });

  test("updateUploadedItemInPersonalItems reports missing ids and update failures", async () => {
    const payload = {
      name: "Updated top",
      description: null,
      brand: null,
      audience: "all",
      category: "top",
      season: ["summer"],
      formalityLevel: [],
      style: [],
      occasions: [],
      colorBase: [],
      pattern: null,
      finish: null,
      composition: null,
      silhouette: null,
      fit: null,
      closureType: [],
    };

    await expect(
      updateUploadedItemInPersonalItems(createActionContext(), {}, payload),
    ).rejects.toThrow("missing_uploaded_item_id");

    await expect(
      updateUploadedItemInPersonalItems(
        createActionContext(),
        { url: "wardrobe:///encoded%20item", source: "uploaded" },
        payload,
      ),
    ).rejects.toThrow("missing_uploaded_item_id");

    vi.mocked(updateUploadedWardrobeItem).mockRejectedValueOnce(
      new Error("network"),
    );
    const context = createActionContext({ isMountedRef: { current: false } });

    await expect(
      updateUploadedItemInPersonalItems(
        context,
        { id: "uploaded-1", source: "uploaded" },
        payload,
      ),
    ).rejects.toThrow("network");

    expect(updateUploadedWardrobeItem).toHaveBeenCalledWith(
      "uploaded-1",
      payload,
    );
    const errorUpdater = mockCalls(context.setStatus).at(-1)?.[0] as (
      current: unknown,
    ) => unknown;
    expect(errorUpdater({ error: "" })).toEqual({
      error: "wardrobe.updateFailed",
      infoKey: "",
      infoParams: null,
    });
    expect(context.setIsContentOperationLoading).toHaveBeenCalledTimes(1);
    expect(context.setIsContentOperationLoading).toHaveBeenCalledWith(true);
  });

  test("toggleRegenerationSelection toggles valid urls only when idle", () => {
    const context = createActionContext();

    toggleRegenerationSelection(context, {
      url: " https://example.com/top-1 ",
    });
    toggleRegenerationSelection(
      createActionContext({ isPartialRegenerationLoading: true }),
      { url: "https://example.com/top-2" },
    );
    toggleRegenerationSelection(context, { url: " " });

    expect(context.setSelectedRegenerationUrls).toHaveBeenCalledWith(
      expect.any(Function),
    );
    const updater = mockCalls(context.setSelectedRegenerationUrls)[0][0] as (
      current: string[],
    ) => string[];
    expect(updater([])).toEqual(["https://example.com/top-1"]);
    expect(updater(["https://example.com/top-1"])).toEqual([]);
  });

  test("refreshWardrobe starts pending streams or reports failures", async () => {
    vi.mocked(regenerateCapsuleWardrobe).mockResolvedValueOnce({
      ...createJobResponse(),
    });
    const context = createActionContext();

    await refreshWardrobe(context);

    expect(context.setSelectedRegenerationUrls).toHaveBeenCalledWith([]);
    expect(regenerateCapsuleWardrobe).toHaveBeenCalledWith({
      capsuleId: "capsule-1",
    });
    expect(subscribeCapsuleEvents).toHaveBeenCalledWith(
      expect.objectContaining({ capsuleId: "capsule-1" }),
    );

    vi.mocked(regenerateCapsuleWardrobe).mockRejectedValueOnce(
      new Error("boom"),
    );
    await refreshWardrobe(context);

    expect(context.setStatus).toHaveBeenCalledWith(expect.any(Function));
    const updater = mockCalls(context.setStatus).at(-1)?.[0] as (
      current: unknown,
    ) => unknown;
    expect(updater({ error: "" })).toEqual({ error: "boom" });
  });

  test("refreshWardrobe reports failed queued jobs without starting a stream", async () => {
    vi.mocked(regenerateCapsuleWardrobe).mockResolvedValueOnce(
      createFailedJobResponse(),
    );
    const context = createActionContext();

    await refreshWardrobe(context);

    expect(subscribeCapsuleEvents).not.toHaveBeenCalled();
    expect(context.setStatus).toHaveBeenCalledWith(expect.any(Function));
    const updater = mockCalls(context.setStatus).at(-1)?.[0] as (
      current: unknown,
    ) => unknown;
    expect(updater({ error: "" })).toEqual({ error: "service_unavailable" });
    expect(context.setIsLoadingItems).toHaveBeenLastCalledWith(false);
  });

  test("refreshWardrobe no longer applies immediate ready responses", async () => {
    vi.mocked(regenerateCapsuleWardrobe).mockResolvedValueOnce({
      ...createJobResponse(),
    });
    const context = createActionContext();

    await refreshWardrobe(context);

    expect(context.setStatus).toHaveBeenCalledWith(expect.any(Function));
    expect(context.setIsLoadingItems).toHaveBeenCalledWith(true);
    expect(context.applyWardrobeSnapshot).not.toHaveBeenCalled();
    expect(subscribeCapsuleEvents).toHaveBeenCalledWith(
      expect.objectContaining({ capsuleId: "capsule-1" }),
    );
  });

  test("startCapsuleEventStream subscribes and stopCapsuleEventStream aborts the stream", () => {
    vi.mocked(subscribeCapsuleEvents).mockReturnValue(
      new Promise(() => undefined),
    );
    const context = createActionContext();

    startCapsuleEventStream(context, "capsule-1");
    const abortRef = context.capsuleEventsAbortRef as {
      current: AbortController | null;
    };

    expect(subscribeCapsuleEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        capsuleId: "capsule-1",
        signal: abortRef.current?.signal,
      }),
    );

    stopCapsuleEventStream(context);

    expect(abortRef.current).toBe(null);
  });

  test("startCapsuleEventStream applies snapshots and maps stream errors", async () => {
    vi.mocked(subscribeCapsuleEvents).mockImplementation(async (options) => {
      options.onMessage({ event: "snapshot", data: { status: "ready" } });
      options.onMessage({ event: "message", data: {} });
      options.onError(new Error("stream"));
    });
    const context = createActionContext({
      applyWardrobeSnapshot: vi.fn(async () => undefined),
    });

    await startCapsuleEventStream(context, " capsule-1 ");

    expect(context.applyWardrobeSnapshot).toHaveBeenCalledWith(
      { status: "ready" },
      "capsule-1",
    );
    expect(context.closeNotificationPrompt).toHaveBeenCalled();
    expect(context.setStatus).toHaveBeenCalledWith(expect.any(Function));
    const updater = mockCalls(context.setStatus).at(-1)?.[0] as (
      current: unknown,
    ) => unknown;
    expect(updater({ error: "" })).toEqual({ error: "stream" });
  });

  test("startCapsuleEventStream fails safely when snapshot application rejects or subscription rejects", async () => {
    vi.mocked(subscribeCapsuleEvents).mockImplementationOnce(
      async (options) => {
        options.onMessage({ event: "snapshot", data: { status: "ready" } });
        await Promise.resolve();
      },
    );
    const context = createActionContext({
      applyWardrobeSnapshot: vi.fn(async () => {
        throw new Error("apply failed");
      }),
    });

    await startCapsuleEventStream(context, "capsule-1");
    await Promise.resolve();

    expect(context.closeNotificationPrompt).toHaveBeenCalled();

    vi.mocked(subscribeCapsuleEvents).mockRejectedValueOnce(
      new Error("subscribe failed"),
    );
    const rejectedContext = createActionContext();
    await startCapsuleEventStream(rejectedContext, "capsule-1");
    expect(rejectedContext.setStatus).toHaveBeenCalledWith(
      expect.any(Function),
    );
  });

  test("generateOutfitSetImage handles pending, ready, invalid, and failing requests", async () => {
    vi.mocked(generateOutfitSetImage).mockResolvedValueOnce({
      status: "pending",
    });
    const context = createActionContext();

    await generateOutfitSetImageAction(context, "2");

    expect(context.setPendingImageSetIndexes).toHaveBeenCalledWith(
      expect.any(Function),
    );
    expect(generateOutfitSetImage).toHaveBeenCalledWith({
      capsuleId: "capsule-1",
      setIndex: 2,
    });
    expect(context.startPendingNotificationFlow).toHaveBeenCalledWith(
      "image",
      "openai:gpt-image-2",
    );
    const pendingUpdater = mockCalls(
      context.setPendingImageSetIndexes,
    )[0][0] as (current: number[]) => number[];
    expect(pendingUpdater([1])).toEqual([1, 2]);
    expect(pendingUpdater([2])).toEqual([2]);

    vi.mocked(generateOutfitSetImage).mockResolvedValueOnce({
      status: "ready",
      image: "https://images.example.com/generated.png",
    });
    await generateOutfitSetImageAction(context, 3);
    expect(context.setProfileOutfitSets).toHaveBeenCalledWith(
      expect.any(Function),
    );
    const outfitUpdater = mockCalls(context.setProfileOutfitSets).at(
      -1,
    )?.[0] as (
      current: { image: string | null; imageObsolete: boolean }[],
    ) => unknown;
    expect(
      outfitUpdater([
        { image: "keep.jpg", imageObsolete: true },
        { image: null, imageObsolete: true },
        { image: "old.jpg", imageObsolete: true },
        { image: null, imageObsolete: true },
      ]),
    ).toEqual([
      { image: "keep.jpg", imageObsolete: true },
      { image: null, imageObsolete: true },
      { image: "old.jpg", imageObsolete: true },
      {
        image: "https://images.example.com/generated.png",
        imageObsolete: false,
      },
    ]);
    expect(context.setPendingImageSetIndexes).toHaveBeenLastCalledWith(
      expect.any(Function),
    );
    const clearUpdater = mockCalls(context.setPendingImageSetIndexes).at(
      -1,
    )?.[0] as (current: number[]) => number[];
    expect(clearUpdater([1, 3])).toEqual([1]);

    await generateOutfitSetImageAction(context, -1);
    expect(generateOutfitSetImage).toHaveBeenCalledTimes(2);

    vi.mocked(generateOutfitSetImage).mockRejectedValueOnce(
      new Error("failed"),
    );
    await generateOutfitSetImageAction(context, 4);
    expect(context.closeNotificationPrompt).toHaveBeenCalled();
    expect(context.setStatus).toHaveBeenCalledWith(expect.any(Function));
  });

  test("deleteGeneratedOutfitSetImage clears stored image and manages busy state", async () => {
    vi.mocked(deleteOutfitSetImage).mockResolvedValue({});
    const context = createActionContext();

    await deleteGeneratedOutfitSetImage(context, "1");

    expect(context.setIsContentOperationLoading).toHaveBeenNthCalledWith(
      1,
      true,
    );
    expect(deleteOutfitSetImage).toHaveBeenCalledWith({
      capsuleId: "capsule-1",
      setIndex: 1,
    });
    expect(context.setProfileOutfitSets).toHaveBeenCalledWith(
      expect.any(Function),
    );
    const outfitUpdater = mockCalls(context.setProfileOutfitSets)[0][0] as (
      current: { image: string | null; imageObsolete: boolean }[],
    ) => unknown;
    expect(
      outfitUpdater([
        { image: "keep.jpg", imageObsolete: true },
        { image: "remove.jpg", imageObsolete: true },
      ]),
    ).toEqual([
      { image: "keep.jpg", imageObsolete: true },
      { image: null, imageObsolete: false },
    ]);
    expect(subscribeCapsuleEvents).toHaveBeenCalledWith(
      expect.objectContaining({ capsuleId: "capsule-1" }),
    );
    expect(context.setIsContentOperationLoading).toHaveBeenLastCalledWith(
      false,
    );

    vi.mocked(deleteOutfitSetImage).mockRejectedValueOnce(new Error("failed"));
    await deleteGeneratedOutfitSetImage(context, 2);
    expect(context.setStatus).toHaveBeenCalledWith(expect.any(Function));
  });
});
