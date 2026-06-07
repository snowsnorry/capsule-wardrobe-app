import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Mock } from "vitest";
import {
  createOutfit,
  deleteOutfit,
  downloadOutfitPdf,
  duplicateOutfit,
  fetchOutfit,
  fetchRecentOutfits,
  renameOutfit,
  revertOutfit,
  saveOutfit,
  searchOutfits,
  selectOutfit,
  updateOutfitItems,
} from "../api/outfits";
import {
  createNewOutfit,
  deleteCurrentOutfit,
  downloadCurrentOutfitPdf,
  duplicateCurrentOutfit,
  loadMoreRecentOutfits,
  openOutfit,
  refreshOutfitList,
  renameCurrentOutfit,
  replaceCurrentOutfitItems,
  revertCurrentOutfit,
  saveCurrentOutfit,
  searchUserOutfits,
  selectUserOutfit,
} from "./outfitActions";
import { createActionContext } from "./testUtils";

vi.mock("../api/outfits", () => ({
  createOutfit: vi.fn(),
  deleteOutfit: vi.fn(),
  downloadOutfitPdf: vi.fn(),
  duplicateOutfit: vi.fn(),
  fetchOutfit: vi.fn(),
  fetchRecentOutfits: vi.fn(),
  renameOutfit: vi.fn(),
  revertOutfit: vi.fn(),
  saveOutfit: vi.fn(),
  searchOutfits: vi.fn(),
  selectOutfit: vi.fn(),
  updateOutfitItems: vi.fn(),
}));

function mockCalls(fn: unknown) {
  return (fn as Mock).mock.calls;
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
    await expect(
      duplicateCurrentOutfit(context, "Copy", "outfit-1"),
    ).resolves.toMatchObject({ id: "copy" });
    await replaceCurrentOutfitItems(context, "outfit-1", []);

    expect(saveOutfit).toHaveBeenCalledWith("outfit-1");
    expect(revertOutfit).toHaveBeenCalledWith("outfit-1");
    expect(renameOutfit).toHaveBeenCalledWith("outfit-1", "Travel");
    expect(duplicateOutfit).toHaveBeenCalledWith("outfit-1", "Copy");
    expect(updateOutfitItems).toHaveBeenCalledWith("outfit-1", []);
    expect(context.setActiveOutfitMeta).toHaveBeenCalledWith(
      expect.objectContaining({ id: "copy" }),
    );
    expect(fetchRecentOutfits).toHaveBeenCalledTimes(5);
  });

  test("skips current outfit mutations without an outfit id", async () => {
    const context = createActionContext({
      setActiveOutfitId: vi.fn(),
      setActiveOutfitMeta: vi.fn(),
    });

    await saveCurrentOutfit(context, "");
    await revertCurrentOutfit(context, "");
    await renameCurrentOutfit(context, "Name", "");
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
