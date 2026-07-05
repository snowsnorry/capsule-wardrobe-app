import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Mock } from "vitest";
import {
  createOutfit,
  deleteOutfit,
  deleteOutfitImage,
  deleteOutfitReport,
  downloadOutfitPdf,
  duplicateOutfit,
  fetchOutfit,
  fetchRecentOutfits,
  generateOutfitImage,
  generateOutfitReport,
  renameOutfit,
  revertOutfit,
  saveOutfit,
  searchOutfits,
  selectOutfit,
  setOutfitPin,
  subscribeOutfitEvents,
  updateOutfitItems,
} from "../api/outfits";
import {
  copyOutfitSetToOutfits,
  createNewOutfit,
  deleteCurrentOutfit,
  deleteCurrentOutfitImage,
  deleteCurrentOutfitReport,
  downloadCurrentOutfitPdf,
  duplicateCurrentOutfit,
  generateCurrentOutfitImage,
  generateCurrentOutfitReport,
  loadMoreRecentOutfits,
  openOutfit,
  refreshOutfitList,
  renameCurrentOutfit,
  replaceCurrentOutfitItems,
  revertCurrentOutfit,
  saveCurrentOutfit,
  searchUserOutfits,
  selectUserOutfit,
  setCurrentOutfitPin,
} from "./outfitActions";
import { createActionContext } from "./testUtils";

vi.mock("../api/outfits", () => ({
  createOutfit: vi.fn(),
  deleteOutfit: vi.fn(),
  deleteOutfitImage: vi.fn(),
  deleteOutfitReport: vi.fn(),
  downloadOutfitPdf: vi.fn(),
  duplicateOutfit: vi.fn(),
  fetchOutfit: vi.fn(),
  fetchRecentOutfits: vi.fn(),
  generateOutfitImage: vi.fn(),
  generateOutfitReport: vi.fn(),
  renameOutfit: vi.fn(),
  revertOutfit: vi.fn(),
  saveOutfit: vi.fn(),
  searchOutfits: vi.fn(),
  selectOutfit: vi.fn(),
  setOutfitPin: vi.fn(),
  subscribeOutfitEvents: vi.fn(),
  updateOutfitItems: vi.fn(),
}));

function mockCalls(fn: unknown) {
  return (fn as Mock).mock.calls;
}

function createJobResponse(id = "job-1") {
  return {
    ok: true,
    job: {
      id,
      kind: "outfitReportGenerate",
      status: "queued",
      phase: "queued",
      progress: { current: 0, total: null, label: null },
      entity: { type: "outfit", id: "outfit-1" },
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

const outfit = {
  id: "outfit-1",
  name: "Weekend",
  status: "modified",
  effective: { items: [] },
};

describe("outfitActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchRecentOutfits).mockResolvedValue({
      outfits: [outfit],
      pagination: { limit: 10, offset: 0, total: 1, hasMore: false },
    });
  });

  test("refreshes and appends recent outfit sidebar pages", async () => {
    const context = createActionContext({
      outfitList: [{ id: "outfit-1", name: "Old" }, { id: "outfit-2" }],
      outfitPagination: { limit: 10, offset: 0, total: 20, hasMore: true },
      setOutfitList: vi.fn(),
      setOutfitPagination: vi.fn(),
    });

    await refreshOutfitList(context);

    expect(fetchRecentOutfits).toHaveBeenCalledWith({ limit: 10, offset: 0 });
    expect(context.setOutfitList).toHaveBeenCalledWith([outfit]);
    expect(context.setOutfitPagination).toHaveBeenCalledWith({
      limit: 10,
      offset: 0,
      total: 1,
      hasMore: false,
    });

    vi.mocked(fetchRecentOutfits).mockResolvedValueOnce({
      outfits: [{ id: "outfit-1", name: "Updated" }, { id: "outfit-3" }],
      pagination: { limit: 10, offset: 10, total: 30, hasMore: true },
    });

    await loadMoreRecentOutfits(context);

    expect(fetchRecentOutfits).toHaveBeenLastCalledWith({
      limit: 10,
      offset: 10,
    });
    expect(context.setOutfitList).toHaveBeenLastCalledWith([
      { id: "outfit-1", name: "Updated" },
      { id: "outfit-2" },
      { id: "outfit-3" },
    ]);
  });

  test("searchUserOutfits returns a safe list fallback", async () => {
    vi.mocked(searchOutfits).mockResolvedValueOnce({ outfits: [outfit] });
    await expect(searchUserOutfits("weekend")).resolves.toEqual([outfit]);

    vi.mocked(searchOutfits).mockResolvedValueOnce({});
    await expect(searchUserOutfits("missing")).resolves.toEqual([]);
  });

  test("creates and opens outfits while toggling content loading", async () => {
    vi.mocked(createOutfit).mockResolvedValueOnce({ outfit });
    vi.mocked(fetchOutfit).mockResolvedValueOnce({ outfit });
    const context = createActionContext({
      setActiveOutfitId: vi.fn(),
      setActiveOutfitMeta: vi.fn(),
      setOutfitList: vi.fn(),
      setOutfitPagination: vi.fn(),
    });

    await expect(createNewOutfit(context)).resolves.toEqual(outfit);
    expect(createOutfit).toHaveBeenCalledWith();
    expect(context.setActiveOutfitId).toHaveBeenCalledWith("outfit-1");
    expect(context.setActiveOutfitMeta).toHaveBeenCalledWith(outfit);
    expect(context.setIsContentOperationLoading).toHaveBeenNthCalledWith(
      1,
      true,
    );
    expect(context.setIsContentOperationLoading).toHaveBeenLastCalledWith(
      false,
    );

    await openOutfit(context, "outfit-1");

    expect(fetchOutfit).toHaveBeenCalledWith("outfit-1");
    expect(fetchRecentOutfits).toHaveBeenCalled();
  });

  test("copies capsule outfit sets into saved outfits without activating them", async () => {
    vi.mocked(createOutfit).mockResolvedValueOnce({
      outfit: { ...outfit, id: "copied-outfit", name: "Capsule: Outfit 1" },
    });
    vi.mocked(saveOutfit).mockResolvedValueOnce({
      outfit: {
        ...outfit,
        id: "copied-outfit",
        name: "Capsule: Outfit 1",
        status: "saved",
      },
    });
    const context = createActionContext({
      setActiveOutfitId: vi.fn(),
      setActiveOutfitMeta: vi.fn(),
      setOutfitList: vi.fn(),
      setOutfitPagination: vi.fn(),
    });
    const items = [
      {
        url: "https://example.com/top",
        source: "from_catalog",
      },
    ];

    await expect(
      copyOutfitSetToOutfits(context, "Capsule: Outfit 1", items, {
        capsuleId: "capsule-1",
        setIndex: 0,
      }),
    ).resolves.toMatchObject({ id: "copied-outfit" });

    expect(createOutfit).toHaveBeenCalledWith({
      name: "Capsule: Outfit 1",
      items,
      sourceCapsuleId: "capsule-1",
      sourceSetIndex: 0,
    });
    expect(saveOutfit).toHaveBeenCalledWith("copied-outfit");
    expect(fetchRecentOutfits).toHaveBeenCalledWith({ limit: 10, offset: 0 });
    expect(context.setActiveOutfitId).not.toHaveBeenCalled();
    expect(context.setActiveOutfitMeta).not.toHaveBeenCalled();
  });

  test("copies outfit sets without saving when no outfit id is returned", async () => {
    const draftOutfit = { name: "Draft outfit" };
    vi.mocked(createOutfit).mockResolvedValueOnce({ outfit: draftOutfit });
    const context = createActionContext({
      setOutfitList: vi.fn(),
      setOutfitPagination: vi.fn(),
    });
    const items = [{ source: "uploaded" }];

    await expect(
      copyOutfitSetToOutfits(context, "Draft outfit", items),
    ).resolves.toEqual(draftOutfit);

    expect(createOutfit).toHaveBeenCalledWith({
      name: "Draft outfit",
      items,
    });
    expect(saveOutfit).not.toHaveBeenCalled();
    expect(fetchRecentOutfits).toHaveBeenCalledWith({ limit: 10, offset: 0 });
  });

  test("mutates the active outfit and refreshes sidebar metadata", async () => {
    vi.mocked(saveOutfit).mockResolvedValue({
      outfit: { ...outfit, status: "saved" },
    });
    vi.mocked(revertOutfit).mockResolvedValue({
      outfit: { ...outfit, status: "saved" },
    });
    vi.mocked(renameOutfit).mockResolvedValue({
      outfit: { ...outfit, name: "Travel" },
    });
    vi.mocked(setOutfitPin).mockResolvedValue({
      outfit: { ...outfit, pin: true },
    });
    vi.mocked(duplicateOutfit).mockResolvedValue({
      outfit: { ...outfit, id: "copy" },
    });
    vi.mocked(updateOutfitItems).mockResolvedValue({ outfit });
    const context = createActionContext({
      setActiveOutfitId: vi.fn(),
      setActiveOutfitMeta: vi.fn(),
      setOutfitList: vi.fn(),
      setOutfitPagination: vi.fn(),
    });

    await saveCurrentOutfit(context, "outfit-1");
    await revertCurrentOutfit(context, "outfit-1");
    await renameCurrentOutfit(context, "Travel", "outfit-1");
    await setCurrentOutfitPin(context, "outfit-1", true);
    await expect(
      duplicateCurrentOutfit(context, "Copy", "outfit-1"),
    ).resolves.toMatchObject({ id: "copy" });
    await replaceCurrentOutfitItems(context, "outfit-1", []);

    expect(saveOutfit).toHaveBeenCalledWith("outfit-1");
    expect(revertOutfit).toHaveBeenCalledWith("outfit-1");
    expect(renameOutfit).toHaveBeenCalledWith("outfit-1", "Travel");
    expect(setOutfitPin).toHaveBeenCalledWith("outfit-1", true);
    expect(duplicateOutfit).toHaveBeenCalledWith("outfit-1", "Copy");
    expect(updateOutfitItems).toHaveBeenCalledWith("outfit-1", []);
    expect(context.setActiveOutfitMeta).toHaveBeenCalledWith(
      expect.objectContaining({ id: "copy" }),
    );
    expect(fetchRecentOutfits).toHaveBeenCalledTimes(6);
    expect(context.setIsContentOperationLoading).toHaveBeenCalledTimes(12);
    expect(context.setIsContentOperationLoading).toHaveBeenNthCalledWith(
      1,
      true,
    );
    expect(context.setIsContentOperationLoading).toHaveBeenNthCalledWith(
      12,
      false,
    );
  });

  test("skips current outfit mutations without an outfit id", async () => {
    const context = createActionContext({
      setActiveOutfitId: vi.fn(),
      setActiveOutfitMeta: vi.fn(),
    });

    await saveCurrentOutfit(context, "");
    await revertCurrentOutfit(context, "");
    await renameCurrentOutfit(context, "Name", "");
    await setCurrentOutfitPin(context, "", true);
    await duplicateCurrentOutfit(context, "Copy", "");
    await deleteCurrentOutfit(context, "");
    await replaceCurrentOutfitItems(context, "", []);

    expect(saveOutfit).not.toHaveBeenCalled();
    expect(context.setIsContentOperationLoading).not.toHaveBeenCalled();
  });

  test("deletes active outfits only clearing state for the current id", async () => {
    vi.mocked(deleteOutfit).mockResolvedValue({ ok: true });
    const activeContext = createActionContext({
      activeOutfitId: "outfit-1",
      setActiveOutfitId: vi.fn(),
      setActiveOutfitMeta: vi.fn(),
      setOutfitList: vi.fn(),
      setOutfitPagination: vi.fn(),
    });

    await deleteCurrentOutfit(activeContext, "outfit-1");

    expect(deleteOutfit).toHaveBeenCalledWith("outfit-1");
    expect(activeContext.setActiveOutfitId).toHaveBeenCalledWith("");
    expect(activeContext.setActiveOutfitMeta).toHaveBeenCalledWith(null);

    const inactiveContext = createActionContext({
      activeOutfitId: "outfit-2",
      setActiveOutfitId: vi.fn(),
      setActiveOutfitMeta: vi.fn(),
      setOutfitList: vi.fn(),
      setOutfitPagination: vi.fn(),
    });
    await deleteCurrentOutfit(inactiveContext, "outfit-1");

    expect(inactiveContext.setActiveOutfitId).not.toHaveBeenCalled();
    expect(inactiveContext.setActiveOutfitMeta).not.toHaveBeenCalled();
  });

  test("selects and downloads outfits through focused API calls", async () => {
    vi.mocked(selectOutfit).mockResolvedValue({ ok: true });
    vi.mocked(downloadOutfitPdf).mockResolvedValue(undefined);
    const context = createActionContext();

    await selectUserOutfit("outfit-1");
    await downloadCurrentOutfitPdf(context, "");
    await downloadCurrentOutfitPdf(context, "outfit-1");

    expect(selectOutfit).toHaveBeenCalledWith("outfit-1");
    expect(downloadOutfitPdf).toHaveBeenCalledTimes(1);
    expect(downloadOutfitPdf).toHaveBeenCalledWith("outfit-1");
    expect(context.setIsDownloadingWardrobePdf).toHaveBeenNthCalledWith(
      1,
      true,
    );
    expect(context.setIsDownloadingWardrobePdf).toHaveBeenLastCalledWith(false);
  });

  test("generates and deletes saved outfit images through focused API calls", async () => {
    vi.mocked(generateOutfitImage).mockResolvedValue({ status: "ready" });
    vi.mocked(deleteOutfitImage).mockResolvedValue({ ok: true });
    vi.mocked(fetchOutfit).mockResolvedValue({ outfit });
    const context = createActionContext({
      activeOutfitId: "outfit-1",
      setActiveOutfitId: vi.fn(),
      setActiveOutfitMeta: vi.fn(),
      setOutfitList: vi.fn(),
      setOutfitPagination: vi.fn(),
    });

    await generateCurrentOutfitImage(context, "outfit-1");
    await deleteCurrentOutfitImage(context, "outfit-1");

    expect(generateOutfitImage).toHaveBeenCalledWith("outfit-1");
    expect(deleteOutfitImage).toHaveBeenCalledWith("outfit-1");
    expect(subscribeOutfitEvents).not.toHaveBeenCalled();
    expect(fetchOutfit).toHaveBeenCalledWith("outfit-1");
    expect(context.setIsOutfitImagePending).toHaveBeenNthCalledWith(1, true);
    expect(context.setIsOutfitImagePending).toHaveBeenLastCalledWith(false);
  });

  test("waits for saved outfit image events and reports generation errors", async () => {
    vi.mocked(generateOutfitImage)
      .mockResolvedValueOnce({ status: "pending" })
      .mockRejectedValueOnce(new Error("network"));
    vi.mocked(fetchOutfit).mockResolvedValue({ outfit });
    vi.mocked(subscribeOutfitEvents).mockImplementationOnce(
      async ({ onMessage }) => {
        onMessage?.({
          event: "snapshot",
          data: { pendingImage: false, status: "ready" },
        });
      },
    );
    const context = createActionContext({
      activeOutfitId: "outfit-1",
      resolveErrorMessage: vi.fn(() => "resolved error"),
      setActiveOutfitId: vi.fn(),
      setActiveOutfitMeta: vi.fn(),
      setIsOutfitImagePending: vi.fn(),
      setOutfitList: vi.fn(),
      setOutfitPagination: vi.fn(),
      setStatus: vi.fn(),
    });

    await generateCurrentOutfitImage(context, "outfit-1");
    await vi.waitFor(() => {
      expect(context.setActiveOutfitMeta).toHaveBeenCalledWith(outfit);
    });
    await generateCurrentOutfitImage(context, "outfit-1");

    expect(subscribeOutfitEvents).toHaveBeenCalledWith(
      expect.objectContaining({ outfitId: "outfit-1" }),
    );
    expect(fetchOutfit).toHaveBeenCalledWith("outfit-1");
    expect(context.setIsOutfitImagePending).toHaveBeenLastCalledWith(false);
    expect(context.setStatus).toHaveBeenCalledWith(expect.any(Function));
    expect(
      (context.setStatus as Mock).mock.calls.at(-1)?.[0]({ previous: true }),
    ).toEqual({
      previous: true,
      error: "resolved error",
    });
  });

  test("reports saved outfit image stream errors after ignoring non-ready events", async () => {
    vi.mocked(generateOutfitImage).mockResolvedValueOnce({ status: "pending" });
    vi.mocked(subscribeOutfitEvents).mockImplementationOnce(
      async ({ onError, onMessage }) => {
        onMessage?.({
          event: "snapshot",
          data: { pendingImage: true, status: "pending" },
        });
        onError?.(new Error("stream"));
      },
    );
    const context = createActionContext({
      activeOutfitId: "outfit-1",
      resolveErrorMessage: vi.fn(() => "stream failed"),
      setIsOutfitImagePending: vi.fn(),
      setStatus: vi.fn(),
    });

    await generateCurrentOutfitImage(context, "outfit-1");

    expect(fetchOutfit).not.toHaveBeenCalled();
    expect(context.setIsOutfitImagePending).toHaveBeenLastCalledWith(false);
    expect(
      (context.setStatus as Mock).mock.calls.at(-1)?.[0]({ previous: true }),
    ).toEqual({
      previous: true,
      error: "stream failed",
    });
  });

  test("waits for queued saved outfit image jobs and refreshes on completion", async () => {
    vi.mocked(generateOutfitImage).mockResolvedValueOnce({
      ok: true,
      job: { id: "image-job-1", status: "queued" },
    });
    vi.mocked(fetchOutfit).mockResolvedValue({ outfit });
    const context = createActionContext({
      activeOutfitId: "outfit-1",
      setActiveOutfitId: vi.fn(),
      setActiveOutfitMeta: vi.fn(),
      setIsOutfitImagePending: vi.fn(),
      setOutfitList: vi.fn(),
      setOutfitPagination: vi.fn(),
      waitForJobCompletion: vi.fn(async () => ({ status: "completed" })),
    });

    await generateCurrentOutfitImage(context, "outfit-1");

    expect(context.waitForJobCompletion).toHaveBeenCalledWith("image-job-1");
    await vi.waitFor(() => {
      expect(fetchOutfit).toHaveBeenCalledWith("outfit-1");
    });
    expect(context.setActiveOutfitMeta).toHaveBeenCalledWith(outfit);
    expect(context.setIsOutfitImagePending).toHaveBeenNthCalledWith(1, true);
    await vi.waitFor(() => {
      expect(context.setIsOutfitImagePending).toHaveBeenLastCalledWith(false);
    });
  });

  test("reports queued saved outfit image job failures", async () => {
    vi.mocked(generateOutfitImage).mockResolvedValueOnce({
      ok: true,
      job: { id: "image-job-1", status: "queued" },
    });
    const context = createActionContext({
      resolveErrorMessage: vi.fn(() => "image failed"),
      setIsOutfitImagePending: vi.fn(),
      setStatus: vi.fn(),
      waitForJobCompletion: vi.fn(async () => ({
        status: "failed",
        error: { code: "image_failed" },
      })),
    });

    await generateCurrentOutfitImage(context, "outfit-1");

    expect(context.waitForJobCompletion).toHaveBeenCalledWith("image-job-1");
    await vi.waitFor(() => {
      expect(context.setStatus).toHaveBeenCalledWith(expect.any(Function));
    });
    expect(fetchOutfit).not.toHaveBeenCalled();
    expect(
      (context.setStatus as Mock).mock.calls.at(-1)?.[0]({ previous: true }),
    ).toEqual({
      previous: true,
      error: "image failed",
    });
    expect(context.setIsOutfitImagePending).toHaveBeenLastCalledWith(false);
  });

  test("generates and deletes outfit reports with pending state and errors", async () => {
    vi.mocked(generateOutfitReport).mockResolvedValueOnce({
      ...createJobResponse(),
    });
    vi.mocked(deleteOutfitReport).mockResolvedValueOnce({
      outfit: { ...outfit, effective: { items: [], report: null } },
    });
    vi.mocked(fetchOutfit).mockResolvedValue({ outfit });
    const context = createActionContext({
      activeOutfitId: "outfit-1",
      setActiveOutfitId: vi.fn(),
      setActiveOutfitMeta: vi.fn(),
      setIsOutfitReportPending: vi.fn(),
      setOutfitList: vi.fn(),
      setOutfitPagination: vi.fn(),
    });

    await generateCurrentOutfitReport(context, "outfit-1");
    await vi.waitFor(() =>
      expect(fetchOutfit).toHaveBeenCalledWith("outfit-1"),
    );
    await deleteCurrentOutfitReport(context, "outfit-1");

    expect(generateOutfitReport).toHaveBeenCalledWith("outfit-1");
    expect(deleteOutfitReport).toHaveBeenCalledWith("outfit-1");
    expect(context.waitForJobCompletion).toHaveBeenCalledWith("job-1");
    expect(context.setActiveOutfitMeta).toHaveBeenCalledWith(outfit);
    expect(context.setIsOutfitReportPending).toHaveBeenNthCalledWith(1, true);
    expect(context.setIsOutfitReportPending).toHaveBeenLastCalledWith(false);
  });

  test("reports outfit report generation failures without clearing old reports", async () => {
    vi.mocked(generateOutfitReport).mockRejectedValueOnce(new Error("network"));
    const context = createActionContext({
      activeOutfitId: "outfit-1",
      setActiveOutfitMeta: vi.fn(),
      setIsOutfitReportPending: vi.fn(),
      setStatus: vi.fn(),
      t: vi.fn((key: string) =>
        key === "errors.outfitReportGenerateFailed"
          ? "Could not generate outfit report."
          : key,
      ),
    });

    await generateCurrentOutfitReport(context, "outfit-1");

    expect(context.setActiveOutfitMeta).not.toHaveBeenCalled();
    expect(
      (context.setStatus as Mock).mock.calls.at(-1)?.[0]({ previous: true }),
    ).toEqual({
      previous: true,
      error: "Could not generate outfit report.",
    });
    expect(context.setIsOutfitReportPending).toHaveBeenLastCalledWith(false);
  });

  test("reports media deletion failures and skips missing outfit ids", async () => {
    vi.mocked(deleteOutfitReport).mockRejectedValueOnce(new Error("report"));
    vi.mocked(deleteOutfitImage).mockRejectedValueOnce(new Error("image"));
    const context = createActionContext({
      resolveErrorMessage: vi.fn((error: unknown) =>
        error instanceof Error ? `resolved ${error.message}` : "resolved",
      ),
      setIsContentOperationLoading: vi.fn(),
      setIsOutfitImagePending: vi.fn(),
      setIsOutfitReportPending: vi.fn(),
      setStatus: vi.fn(),
    });

    await generateCurrentOutfitImage(context, "");
    await generateCurrentOutfitReport(context, "");
    await deleteCurrentOutfitReport(context, "");
    await deleteCurrentOutfitImage(context, "");
    await deleteCurrentOutfitReport(context, "outfit-1");
    await deleteCurrentOutfitImage(context, "outfit-1");

    expect(generateOutfitImage).not.toHaveBeenCalled();
    expect(generateOutfitReport).not.toHaveBeenCalled();
    expect(deleteOutfitReport).toHaveBeenCalledTimes(1);
    expect(deleteOutfitImage).toHaveBeenCalledTimes(1);
    expect(context.setIsOutfitReportPending).toHaveBeenLastCalledWith(false);
    expect(mockCalls(context.setIsContentOperationLoading)).toEqual([
      [true],
      [false],
    ]);
    expect(
      (context.setStatus as Mock).mock.calls.at(-2)?.[0]({ previous: true }),
    ).toEqual({
      previous: true,
      error: "resolved report",
    });
    expect(
      (context.setStatus as Mock).mock.calls.at(-1)?.[0]({ previous: true }),
    ).toEqual({
      previous: true,
      error: "resolved image",
    });
  });

  test("does not reactivate a previous outfit when image generation finishes after navigation", async () => {
    vi.mocked(generateOutfitImage).mockResolvedValueOnce({ status: "pending" });
    vi.mocked(fetchOutfit).mockResolvedValue({ outfit });
    vi.mocked(subscribeOutfitEvents).mockImplementationOnce(
      async ({ onMessage }) => {
        onMessage?.({
          event: "snapshot",
          data: { pendingImage: false, status: "ready" },
        });
      },
    );
    const context = createActionContext({
      activeOutfitId: "outfit-2",
      setActiveOutfitId: vi.fn(),
      setActiveOutfitMeta: vi.fn(),
      setIsOutfitImagePending: vi.fn(),
      setOutfitList: vi.fn(),
      setOutfitPagination: vi.fn(),
    });

    await generateCurrentOutfitImage(context, "outfit-1");
    await vi.waitFor(() => {
      expect(context.setOutfitList).toHaveBeenCalled();
    });

    expect(fetchOutfit).not.toHaveBeenCalled();
    expect(context.setActiveOutfitId).not.toHaveBeenCalled();
    expect(context.setActiveOutfitMeta).not.toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(context.setIsOutfitImagePending).toHaveBeenLastCalledWith(false);
    });
  });

  test("does not fetch or apply a completed report for a non-active outfit", async () => {
    vi.mocked(generateOutfitReport).mockResolvedValueOnce({
      ...createJobResponse("job-2"),
    });
    const context = createActionContext({
      activeOutfitId: "outfit-2",
      setActiveOutfitId: vi.fn(),
      setActiveOutfitMeta: vi.fn(),
      setOutfitList: vi.fn(),
      setOutfitPagination: vi.fn(),
      waitForJobCompletion: vi.fn(async () => ({ status: "completed" })),
    });

    await generateCurrentOutfitReport(context, "outfit-1");
    await vi.waitFor(() => {
      expect(context.setOutfitList).toHaveBeenCalled();
    });

    expect(fetchOutfit).not.toHaveBeenCalled();
    expect(context.setActiveOutfitId).not.toHaveBeenCalled();
    expect(context.setActiveOutfitMeta).not.toHaveBeenCalled();
  });

  test("resets busy flags when outfit operations fail", async () => {
    vi.mocked(downloadOutfitPdf).mockRejectedValueOnce(new Error("network"));
    const context = createActionContext();

    await expect(downloadCurrentOutfitPdf(context, "outfit-1")).rejects.toThrow(
      "network",
    );

    expect(mockCalls(context.setIsDownloadingWardrobePdf)).toEqual([
      [true],
      [false],
    ]);
  });
});
