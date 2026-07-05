import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useWardrobeItems } from "./useWardrobeItems";

const api = vi.hoisted(() => ({
  deleteUploadedWardrobeItem: vi.fn(),
  downloadPersonalItemsPdf: vi.fn(),
  fetchPersonalItems: vi.fn(),
  removeCatalogItemFromPersonalItems: vi.fn(),
  updateUploadedWardrobeItem: vi.fn(),
  uploadWardrobeImages: vi.fn(),
  uploadWardrobeUrls: vi.fn(),
}));
const likedApi = vi.hoisted(() => ({
  likeItem: vi.fn(),
  removeItemLike: vi.fn(),
}));
const personalItems = vi.hoisted(() => ({
  notifyPersonalItemsChanged: vi.fn(),
}));

vi.mock("../api/personalItems", () => api);
vi.mock("../api/likedItems", () => likedApi);
vi.mock("../app/personalItemsCount", () => personalItems);

const t = (key: string) => key;
const waitForJobCompletion = vi.fn().mockResolvedValue({
  status: "completed",
});

function createJobResponse(
  kind = "personalItemUploadUrls",
  status: "queued" | "completed" | "failed" = "queued",
) {
  return {
    ok: true,
    job: {
      id: "job-1",
      kind,
      status,
      phase: "queued",
      progress: { current: 0, total: null, label: null },
      entity: { type: "wardrobe", id: null },
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

beforeEach(() => {
  vi.clearAllMocks();
  waitForJobCompletion.mockResolvedValue({ status: "completed" });
  api.fetchPersonalItems.mockResolvedValue({ items: [] });
  api.deleteUploadedWardrobeItem.mockResolvedValue({ ok: true });
  api.downloadPersonalItemsPdf.mockResolvedValue(undefined);
  api.removeCatalogItemFromPersonalItems.mockResolvedValue({ ok: true });
  api.updateUploadedWardrobeItem.mockResolvedValue({ item: null });
  api.uploadWardrobeImages.mockResolvedValue(
    createJobResponse("personalItemUploadFiles"),
  );
  api.uploadWardrobeUrls.mockResolvedValue(
    createJobResponse("personalItemUploadUrls"),
  );
  likedApi.likeItem.mockResolvedValue({ ok: true });
  likedApi.removeItemLike.mockResolvedValue({ ok: true });
});

afterEach(cleanup);

describe("useWardrobeItems", () => {
  test("ignores a late item load after unmount", async () => {
    let resolveItems: (response: { items: never[] }) => void = () => {};
    api.fetchPersonalItems.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveItems = resolve;
      }),
    );
    const { unmount } = renderHook(() =>
      useWardrobeItems("all", false, 0, t, waitForJobCompletion),
    );

    unmount();

    await act(async () => {
      resolveItems({ items: [] });
    });
    expect(api.fetchPersonalItems).toHaveBeenCalledWith({
      cursor: null,
      force: false,
      likedOnly: false,
      limit: 48,
      source: null,
    });
  });

  test("loads items and handles successful catalog and uploaded mutations", async () => {
    api.fetchPersonalItems.mockResolvedValueOnce({
      items: [
        {
          id: "uploaded-1",
          name: "Uploaded shirt",
          source: "uploaded",
          imageUrl: "https://example.com/uploaded.jpg",
        },
        {
          id: "catalog-1",
          name: "Catalog jacket",
          source: "from_catalog",
          url: "https://example.com/catalog",
          isLiked: true,
        },
      ],
    });
    const onItemsChanged = vi.fn();
    const { result } = renderHook(() =>
      useWardrobeItems("all", false, 0, t, waitForJobCompletion, {
        onItemsChanged,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.handleDownloadPdf();
    });
    expect(api.downloadPersonalItemsPdf).toHaveBeenCalledWith({
      source: null,
    });

    await act(async () => {
      expect(
        await result.current.handleUploadUrls(["https://shop.test/a"]),
      ).toBe(true);
    });
    expect(api.uploadWardrobeUrls).toHaveBeenCalledWith(
      ["https://shop.test/a"],
      expect.objectContaining({ onProgress: expect.any(Function) }),
    );
    expect(waitForJobCompletion).toHaveBeenCalledWith("job-1");
    await waitFor(() =>
      expect(onItemsChanged).toHaveBeenNthCalledWith(1, "upload"),
    );

    act(() => {
      result.current.handleProductMenuOpen(
        document.createElement("button"),
        "https://example.com/catalog",
        result.current.items[1],
        {
          originRect: { top: 1, left: 2, width: 3, height: 4 },
          presentation: "mobile-context",
        },
      );
    });
    expect(result.current.productMenu.originRect).toEqual({
      top: 1,
      left: 2,
      width: 3,
      height: 4,
    });
    act(() => {
      result.current.closeProductMenu();
    });
    expect(result.current.productMenu.anchor).toBeNull();

    const catalogItem = result.current.items.find(
      (item) => item.url === "https://example.com/catalog",
    );
    await act(async () => {
      await result.current.handleSetItemLike(catalogItem!, false);
    });
    expect(likedApi.removeItemLike).toHaveBeenCalledWith(
      "https://example.com/catalog",
    );

    const uploadedItem = result.current.items.find(
      (item) => item.id === "uploaded-1",
    );
    await act(async () => {
      await result.current.handleUpdateUploadedItem(uploadedItem!, {
        name: "Updated uploaded shirt",
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
        composition: "linen",
        silhouette: null,
        fit: null,
        closureType: [],
      });
    });
    expect(api.updateUploadedWardrobeItem).toHaveBeenCalledWith(
      "uploaded-1",
      expect.objectContaining({
        category: "top",
        name: "Updated uploaded shirt",
      }),
    );
    expect(onItemsChanged).toHaveBeenNthCalledWith(2, "metadata");

    personalItems.notifyPersonalItemsChanged.mockClear();
    await act(async () => {
      await result.current.handleConfirmRemove(uploadedItem!);
    });
    expect(api.deleteUploadedWardrobeItem).toHaveBeenCalledWith("uploaded-1");
    expect(onItemsChanged).toHaveBeenNthCalledWith(3, "items");

    await act(async () => {
      await result.current.handleConfirmRemove({
        id: "catalog-1",
        url: "https://example.com/catalog",
      });
    });
    expect(api.removeCatalogItemFromPersonalItems).toHaveBeenCalledWith(
      "https://example.com/catalog",
    );
    expect(personalItems.notifyPersonalItemsChanged).toHaveBeenCalledTimes(2);
    expect(onItemsChanged).toHaveBeenNthCalledWith(4, "items");
  });

  test("handles an upload job that completed in the upload response", async () => {
    api.uploadWardrobeImages.mockResolvedValueOnce(
      createJobResponse("personalItemUploadFiles", "completed"),
    );
    const onItemsChanged = vi.fn();
    const { result } = renderHook(() =>
      useWardrobeItems("uploaded", false, 0, t, waitForJobCompletion, {
        onItemsChanged,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      expect(
        await result.current.handleUploadImages([
          new File(["image"], "shirt.png", { type: "image/png" }),
        ]),
      ).toBe(true);
    });

    expect(waitForJobCompletion).not.toHaveBeenCalled();
    expect(personalItems.notifyPersonalItemsChanged).toHaveBeenCalledTimes(1);
    expect(onItemsChanged).toHaveBeenCalledWith("upload");
  });

  test("handles empty and failing operations", async () => {
    api.fetchPersonalItems.mockRejectedValueOnce(new Error("load failed"));
    const { result } = renderHook(() =>
      useWardrobeItems("all", false, 1, t, waitForJobCompletion),
    );

    await waitFor(() =>
      expect(result.current.error).toBe("wardrobe.loadFailed"),
    );

    await act(async () => {
      expect(await result.current.handleUploadImages([])).toBe(false);
      expect(await result.current.handleUploadUrls([])).toBe(false);
      await result.current.handleConfirmRemove({ id: "" });
      await result.current.handleSetItemLike({ name: "No URL" }, true);
    });
    expect(api.uploadWardrobeImages).not.toHaveBeenCalled();
    expect(api.uploadWardrobeUrls).not.toHaveBeenCalled();
    expect(likedApi.likeItem).not.toHaveBeenCalled();

    api.uploadWardrobeImages.mockRejectedValueOnce(new Error("upload failed"));
    await act(async () => {
      expect(
        await result.current.handleUploadImages([
          new File(["image"], "shirt.png", { type: "image/png" }),
        ]),
      ).toBe(false);
    });
    expect(result.current.error).toBe("wardrobe.uploadFailed");

    api.uploadWardrobeUrls.mockRejectedValueOnce(
      new Error("url upload failed"),
    );
    await act(async () => {
      expect(
        await result.current.handleUploadUrls(["https://shop.test/b"]),
      ).toBe(false);
    });
    expect(result.current.error).toBe("wardrobe.urlUploadFailed");

    api.downloadPersonalItemsPdf.mockRejectedValueOnce(
      new Error("download failed"),
    );
    await act(async () => {
      await result.current.handleDownloadPdf();
    });
    expect(result.current.error).toBe("wardrobe.downloadFailed");

    likedApi.likeItem.mockRejectedValueOnce(new Error("like failed"));
    await act(async () => {
      await result.current.handleSetItemLike(
        { url: "https://example.com/liked", isLiked: false },
        true,
      );
    });
    expect(result.current.error).toBe("wardrobe.likeFailed");

    api.updateUploadedWardrobeItem.mockRejectedValueOnce(
      new Error("update failed"),
    );
    let updateError: unknown;
    await act(async () => {
      try {
        await result.current.handleUpdateUploadedItem(
          { id: "uploaded-1", source: "uploaded" },
          {
            name: "Updated",
            description: null,
            brand: null,
            audience: "all",
            category: "top",
            season: [],
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
          },
        );
      } catch (error) {
        updateError = error;
      }
    });
    expect(updateError).toEqual(new Error("update failed"));
    await waitFor(() =>
      expect(result.current.error).toBe("wardrobe.updateFailed"),
    );

    api.updateUploadedWardrobeItem.mockResolvedValueOnce({
      item: { id: "uploaded-1", name: "Updated from API" },
    });
    await act(async () => {
      await result.current.handleUpdateUploadedItem(
        { id: "uploaded-1", source: "uploaded" },
        {
          name: "Updated",
          description: null,
          brand: null,
          audience: "all",
          category: "top",
          season: [],
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
        },
      );
    });
    expect(result.current.error).toBe("");
  });
});
