import { beforeEach, describe, expect, test, vi } from "vitest";
import { createOutfitStore } from "./outfitStore.js";

const row = {
  id: "outfit-1",
  name: "Weekend",
  draft: {
    items: [
      {
        url: "https://example.com/jacket",
        source: "from_catalog",
      },
    ],
    image: null,
    imageObsolete: false,
    report: null,
  },
  saved: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

function createDeps() {
  return {
    countOutfitsByEmailImpl: vi.fn(async () => 2),
    createOutfitRecordImpl: vi.fn(async (payload) => ({
      ...row,
      name: payload.name,
      draft: payload.draft,
      saved: payload.saved,
    })),
    deleteOutfitByIdForEmailImpl: vi.fn(async () => true),
    getOutfitByIdForEmailImpl: vi.fn(async () => row),
    listOutfitNamesByEmailImpl: vi.fn(async () => ["Weekend"]),
    listRecentOutfitsByEmailImpl: vi.fn(async () => [row, null]),
    renameOutfitByIdForEmailImpl: vi.fn(async (payload) => ({
      ...row,
      name: payload.name,
    })),
    revertOutfitDraftByIdForEmailImpl: vi.fn(async () => ({
      ...row,
      draft: null,
      saved: row.draft,
    })),
    saveOutfitByIdForEmailImpl: vi.fn(async () => ({
      ...row,
      draft: null,
      saved: row.draft,
    })),
    searchOutfitsByEmailImpl: vi.fn(async () => [row, null]),
    updateOutfitReportByIdForEmailImpl: vi.fn(async (payload) => ({
      ...row,
      draft: null,
      saved: {
        ...row.draft,
        report: payload.report,
      },
    })),
    updateOutfitSnapshotByIdForEmailImpl: vi.fn(async (payload) => ({
      ...row,
      draft: payload.draft,
    })),
  };
}

describe("createOutfitStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("normalizes read results and forwards pagination/search inputs", async () => {
    const deps = createDeps();
    const store = createOutfitStore(deps);

    await expect(
      store.getOutfit("person@example.com", "outfit-1"),
    ).resolves.toMatchObject({
      id: "outfit-1",
      status: "new",
    });
    await expect(
      store.listRecentOutfits("person@example.com", 5, 10),
    ).resolves.toHaveLength(1);
    await expect(
      store.searchOutfits("person@example.com", "weekend", 7),
    ).resolves.toHaveLength(1);
    await expect(store.countOutfits("person@example.com")).resolves.toBe(2);

    expect(deps.getOutfitByIdForEmailImpl).toHaveBeenCalledWith({
      email: "person@example.com",
      outfitId: "outfit-1",
    });
    expect(deps.listRecentOutfitsByEmailImpl).toHaveBeenCalledWith({
      email: "person@example.com",
      limit: 5,
      offset: 10,
    });
    expect(deps.searchOutfitsByEmailImpl).toHaveBeenCalledWith({
      email: "person@example.com",
      query: "weekend",
      limit: 7,
    });
  });

  test("creates and renames outfits with unique normalized names", async () => {
    const deps = createDeps();
    const store = createOutfitStore(deps);
    const draft = {
      items: [
        {
          url: "https://example.com/jacket",
          source: "from_catalog",
          item: { id: "catalog-1", name: "Jacket" },
        },
        { url: "wardrobe://legacy", source: "personal" },
      ],
    };

    await expect(
      store.createOutfit("person@example.com", { name: "Weekend", draft }),
    ).resolves.toMatchObject({
      name: "Weekend (1)",
      draft: {
        items: [
          {
            url: "https://example.com/jacket",
            source: "from_catalog",
          },
        ],
      },
    });
    await expect(
      store.renameOutfit("person@example.com", "outfit-1", "Weekend"),
    ).resolves.toMatchObject({ name: "Weekend (1)" });

    expect(deps.createOutfitRecordImpl).toHaveBeenCalledWith({
      email: "person@example.com",
      name: "Weekend (1)",
      draft: {
        items: [
          {
            url: "https://example.com/jacket",
            source: "from_catalog",
          },
        ],
        image: null,
        imageObsolete: false,
        report: null,
      },
      saved: null,
    });
  });

  test("updates, saves, reverts, duplicates, and deletes by profile ownership", async () => {
    const deps = createDeps();
    const store = createOutfitStore(deps);

    await expect(
      store.updateOutfitSnapshot("person@example.com", "outfit-1", {
        items: [],
      }),
    ).resolves.toMatchObject({
      draft: { items: [], image: null, imageObsolete: false },
    });
    await expect(
      store.saveOutfit("person@example.com", "outfit-1"),
    ).resolves.toMatchObject({
      status: "saved",
    });
    await expect(
      store.revertOutfit("person@example.com", "outfit-1"),
    ).resolves.toMatchObject({
      status: "saved",
    });
    await expect(
      store.duplicateOutfit("person@example.com", "outfit-1", "Weekend"),
    ).resolves.toMatchObject({
      name: "Weekend (1)",
      saved: row.draft,
      status: "saved",
    });
    await expect(
      store.deleteOutfit("person@example.com", "outfit-1"),
    ).resolves.toBe(true);

    expect(deps.updateOutfitSnapshotByIdForEmailImpl).toHaveBeenCalledWith({
      email: "person@example.com",
      outfitId: "outfit-1",
      draft: { items: [], image: null, imageObsolete: false, report: null },
    });
    expect(deps.deleteOutfitByIdForEmailImpl).toHaveBeenCalledWith({
      email: "person@example.com",
      outfitId: "outfit-1",
    });
  });

  test("returns null when duplicating a missing outfit", async () => {
    const deps = createDeps();
    deps.getOutfitByIdForEmailImpl.mockResolvedValueOnce(null);
    const store = createOutfitStore(deps);

    await expect(
      store.duplicateOutfit("person@example.com", "missing"),
    ).resolves.toBeNull();
    expect(deps.createOutfitRecordImpl).not.toHaveBeenCalled();
  });

  test("updates outfit report through the effective snapshot helper", async () => {
    const deps = createDeps();
    const store = createOutfitStore(deps);
    const report = { schemaVersion: 1, itemsHash: "items-hash" };

    await expect(
      store.updateOutfitReport("person@example.com", "outfit-1", report),
    ).resolves.toMatchObject({
      draft: null,
      saved: {
        report,
      },
      status: "saved",
    });
    expect(deps.updateOutfitReportByIdForEmailImpl).toHaveBeenCalledWith({
      email: "person@example.com",
      outfitId: "outfit-1",
      report,
    });
  });
});
