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

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchPersonalItems.mockResolvedValue({ items: [] });
  api.deleteUploadedWardrobeItem.mockResolvedValue({ ok: true });
  api.downloadPersonalItemsPdf.mockResolvedValue(undefined);
  api.removeCatalogItemFromPersonalItems.mockResolvedValue({ ok: true });
  api.updateUploadedWardrobeItem.mockResolvedValue({ item: null });
  api.uploadWardrobeImages.mockResolvedValue({ ok: true });
  api.uploadWardrobeUrls.mockResolvedValue({ ok: true });
  likedApi.likeItem.mockResolvedValue({ ok: true });
  likedApi.removeItemLike.mockResolvedValue({ ok: true });
});

afterEach(cleanup);

describe("useWardrobeItems", () => {
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
    const { result } = renderHook(() => useWardrobeItems("uploaded", 0, t));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.handleDownloadPdf();
    });
    expect(api.downloadPersonalItemsPdf).toHaveBeenCalledWith({
      source: "uploaded",
    });

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
      await result.current.handleConfirmRemove(uploadedItem!);
    });
    expect(api.deleteUploadedWardrobeItem).toHaveBeenCalledWith("uploaded-1");

    await act(async () => {
      await result.current.handleConfirmRemove({
        id: "catalog-1",
        url: "https://example.com/catalog",
      });
    });
    expect(api.removeCatalogItemFromPersonalItems).toHaveBeenCalledWith(
      "https://example.com/catalog",
    );
    expect(personalItems.notifyPersonalItemsChanged).toHaveBeenCalled();
  });

  test("handles empty and failing operations", async () => {
    api.fetchPersonalItems.mockRejectedValueOnce(new Error("load failed"));
    const { result } = renderHook(() => useWardrobeItems("all", 1, t));

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
  });
});
