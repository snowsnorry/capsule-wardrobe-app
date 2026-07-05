import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { usePaginatedPersonalItems } from "./usePaginatedPersonalItems";

const api = vi.hoisted(() => ({
  fetchPersonalItems: vi.fn(),
}));

vi.mock("../api/personalItems", () => api);

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchPersonalItems.mockResolvedValue({
    items: [],
    pagination: { hasMore: false, limit: 48, nextCursor: null },
  });
});

afterEach(cleanup);

describe("usePaginatedPersonalItems", () => {
  test("loads the next page with the returned cursor", async () => {
    api.fetchPersonalItems
      .mockResolvedValueOnce({
        items: [{ id: "1", source: "uploaded", url: "wardrobe://1" }],
        pagination: { hasMore: true, limit: 48, nextCursor: "cursor-2" },
      })
      .mockResolvedValueOnce({
        items: [{ id: "2", source: "uploaded", url: "wardrobe://2" }],
        pagination: { hasMore: false, limit: 48, nextCursor: null },
      });

    const { result } = renderHook(() => usePaginatedPersonalItems());

    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.items).toHaveLength(2);
    expect(api.fetchPersonalItems).toHaveBeenNthCalledWith(2, {
      cursor: "cursor-2",
      force: false,
      likedOnly: false,
      limit: 48,
      source: null,
    });
  });

  test("uses the completed full cache for source and liked filters", async () => {
    api.fetchPersonalItems.mockResolvedValueOnce({
      items: [
        { id: "1", source: "uploaded", url: "wardrobe://1", isLiked: true },
        {
          id: "2",
          source: "from_catalog",
          url: "https://example.com/2",
          isLiked: true,
        },
        { id: "3", source: "uploaded", url: "wardrobe://3", isLiked: false },
      ],
      pagination: { hasMore: false, limit: 48, nextCursor: null },
    });

    const { rerender, result } = renderHook(
      ({ likedOnly, source }) =>
        usePaginatedPersonalItems({ likedOnly, source }),
      {
        initialProps: { likedOnly: false, source: null },
      },
    );

    await waitFor(() => expect(result.current.items).toHaveLength(3));

    rerender({ likedOnly: true, source: "uploaded" });

    expect(result.current.items).toEqual([
      { id: "1", source: "uploaded", url: "wardrobe://1", isLiked: true },
    ]);
    expect(api.fetchPersonalItems).toHaveBeenCalledTimes(1);
  });

  test("ignores stale responses after a filter change", async () => {
    const allPage = createDeferredPage();
    const uploadedPage = createDeferredPage();
    api.fetchPersonalItems
      .mockReturnValueOnce(allPage.promise)
      .mockReturnValueOnce(uploadedPage.promise);

    const { rerender, result } = renderHook(
      ({ source }) => usePaginatedPersonalItems({ source }),
      {
        initialProps: { source: null },
      },
    );

    rerender({ source: "uploaded" });

    allPage.resolve({
      items: [{ id: "catalog-1", source: "from_catalog" }],
      pagination: { hasMore: false, limit: 48, nextCursor: null },
    });
    uploadedPage.resolve({
      items: [{ id: "uploaded-1", source: "uploaded" }],
      pagination: { hasMore: false, limit: 48, nextCursor: null },
    });

    await waitFor(() =>
      expect(result.current.items).toEqual([
        { id: "uploaded-1", source: "uploaded" },
      ]),
    );
  });

  test("refresh resets loaded state and fetches the first page again", async () => {
    api.fetchPersonalItems
      .mockResolvedValueOnce({
        items: [{ id: "1", source: "uploaded" }],
        pagination: { hasMore: false, limit: 48, nextCursor: null },
      })
      .mockResolvedValueOnce({
        items: [{ id: "2", source: "uploaded" }],
        pagination: { hasMore: false, limit: 48, nextCursor: null },
      });

    const { rerender, result } = renderHook(
      ({ forceKey }) => usePaginatedPersonalItems({ forceKey }),
      {
        initialProps: { forceKey: 0 },
      },
    );

    await waitFor(() => expect(result.current.items).toHaveLength(1));

    rerender({ forceKey: 1 });

    await waitFor(() =>
      expect(result.current.items).toEqual([{ id: "2", source: "uploaded" }]),
    );
    expect(api.fetchPersonalItems).toHaveBeenNthCalledWith(2, {
      cursor: null,
      force: true,
      likedOnly: false,
      limit: 48,
      source: null,
    });
  });

  test("force refresh ignores an older in-flight page for the same filter", async () => {
    const stalePage = createDeferredPage();
    api.fetchPersonalItems
      .mockReturnValueOnce(stalePage.promise)
      .mockResolvedValueOnce({
        items: [{ id: "fresh", source: "uploaded" }],
        pagination: { hasMore: false, limit: 48, nextCursor: null },
      });

    const { rerender, result } = renderHook(
      ({ forceKey }) => usePaginatedPersonalItems({ forceKey }),
      {
        initialProps: { forceKey: 0 },
      },
    );

    await waitFor(() =>
      expect(api.fetchPersonalItems).toHaveBeenCalledTimes(1),
    );

    rerender({ forceKey: 1 });

    await waitFor(() =>
      expect(api.fetchPersonalItems).toHaveBeenCalledTimes(2),
    );
    stalePage.resolve({
      items: [{ id: "stale", source: "uploaded" }],
      pagination: { hasMore: false, limit: 48, nextCursor: null },
    });

    await waitFor(() =>
      expect(result.current.items).toEqual([
        { id: "fresh", source: "uploaded" },
      ]),
    );
    expect(api.fetchPersonalItems).toHaveBeenNthCalledWith(2, {
      cursor: null,
      force: true,
      likedOnly: false,
      limit: 48,
      source: null,
    });
  });
});

function createDeferredPage() {
  let resolve: (value: unknown) => void = () => {};
  const promise = new Promise((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}
