import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Mock } from "vitest";
import { likeItem, removeItemLike } from "../api/likedItems";
import { createActionContext } from "./testUtils";
import { setItemLike } from "./likedItemActions";

vi.mock("../api/likedItems", () => ({
  likeItem: vi.fn(),
  removeItemLike: vi.fn(),
}));

function getLastUpdater(fn: unknown) {
  return (fn as Mock).mock.calls.at(-1)?.[0] as (current: unknown) => unknown;
}

describe("likedItemActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(likeItem).mockResolvedValue({ ok: true });
    vi.mocked(removeItemLike).mockResolvedValue({ ok: true });
  });

  test("setItemLike optimistically patches all app-visible item instances", async () => {
    const context = createActionContext();

    await setItemLike(context, { url: "https://example.com/1" }, true);

    expect(likeItem).toHaveBeenCalledWith("https://example.com/1");
    expect(
      getLastUpdater(context.setProfileItems)([
        { url: "https://example.com/1", isLiked: false },
      ]),
    ).toEqual([{ url: "https://example.com/1", isLiked: true }]);
    expect(
      getLastUpdater(context.setActiveCapsuleMeta)({
        draft: {
          data: { wardrobe: { items: [{ url: "https://example.com/1" }] } },
        },
      }),
    ).toEqual({
      draft: {
        data: {
          wardrobe: {
            items: [{ url: "https://example.com/1", isLiked: true }],
          },
        },
      },
    });
  });

  test("setItemLike removes likes and skips missing URLs", async () => {
    const context = createActionContext();

    await setItemLike(context, { url: "wardrobe://uploaded-1" }, false);
    await setItemLike(context, { name: "missing" }, true);

    expect(removeItemLike).toHaveBeenCalledWith("wardrobe://uploaded-1");
    expect(likeItem).not.toHaveBeenCalled();
  });

  test("setItemLike rolls back and reports errors when the API fails", async () => {
    vi.mocked(likeItem).mockRejectedValueOnce(new Error("network"));
    const profileItems = [{ url: "https://example.com/1", isLiked: false }];
    const activeCapsuleMeta = {
      draft: {
        data: {
          wardrobe: {
            items: [{ url: "https://example.com/1", isLiked: true }],
          },
        },
      },
    };
    const capsuleList = [{ id: "capsule-1", draft: null, saved: null }];
    const context = createActionContext({
      activeCapsuleMeta,
      capsuleList,
      profileItems,
    });

    await expect(
      setItemLike(context, { url: "https://example.com/1" }, true),
    ).rejects.toThrow("network");

    expect(context.setProfileItems).toHaveBeenCalledTimes(2);
    expect((context.setProfileItems as Mock).mock.calls.at(-1)?.[0]).toBe(
      profileItems,
    );
    expect((context.setActiveCapsuleMeta as Mock).mock.calls.at(-1)?.[0]).toBe(
      activeCapsuleMeta,
    );
    expect((context.setCapsuleList as Mock).mock.calls.at(-1)?.[0]).toBe(
      capsuleList,
    );
    const statusUpdater = getLastUpdater(context.setStatus);
    expect(statusUpdater({ error: "" })).toEqual({
      error: "wardrobe.likeFailed",
    });
  });
});
