import { test, expect } from "vitest";
import {
  buildProfileCapsuleContext,
  buildSharedCapsuleOgMetadata,
  createCapsuleStore,
  normalizeCapsuleFilters,
  normalizeCapsuleSnapshot,
} from "./capsuleStore.js";

const timestamp = new Date(0).toISOString();
type StoreCall = {
  type: string;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
};

function capsuleRow(overrides = {}) {
  return {
    id: "capsule-1",
    profileEmail: "person@example.com",
    name: "Spring edit",
    draft: null,
    saved: {
      filters: {
        sourceMode: "catalog_only",
        formalityLevel: "casual",
        style: "minimalistic",
        occasions: ["office"],
        season: ["spring"],
        audience: "woman",
        color: null,
        pattern: "solid",
        text: "",
      },
      data: {
        wardrobe: {
          items: [
            {
              id: "top-1",
              url: "https://example.com/top",
              name: "Top",
              audience: "woman",
              category: "top",
              imageUrl: "https://images.example.com/top.jpg",
            },
          ],
        },
        rejectedUrls: [],
      },
    },
    status: "saved",
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

test("normalizeCapsuleFilters drops removed profile occasions and keeps supported values", () => {
  expect(
    normalizeCapsuleFilters({
      occasions: [
        "office",
        "school_drop-off",
        "everyday_errands",
        "weekend_with_family",
        "office",
      ],
    }).occasions,
  ).toEqual(["office", "everyday_errands"]);
  expect(normalizeCapsuleFilters({}).sourceMode).toBe("catalog_only");
  expect(
    normalizeCapsuleFilters({ sourceMode: "wardrobe_preferred" }).sourceMode,
  ).toBe("wardrobe_preferred");
  expect(
    normalizeCapsuleFilters({ sourceMode: "wardrobe_only" }).sourceMode,
  ).toBe("wardrobe_only");
  expect(
    normalizeCapsuleFilters({ sourceMode: "owned_first" }).sourceMode,
  ).toBe("catalog_only");
});

test("normalizeCapsuleSnapshot sanitizes saved profile occasions on read and write", () => {
  expect(
    normalizeCapsuleSnapshot({
      filters: {
        formalityLevel: "",
        style: null,
        occasions: ["office", "school_drop-off", "weekend_with_family"],
        season: [],
        audience: "",
        color: null,
        pattern: "solid",
        text: "",
      },
      data: {
        wardrobe: null,
        rejectedUrls: [],
      },
    })?.filters?.occasions,
  ).toEqual(["office"]);
});

test("normalizeCapsuleSnapshot preserves outfit set image payloads", () => {
  expect(
    normalizeCapsuleSnapshot({
      filters: {},
      data: {
        wardrobe: {
          items: [],
          outfitSets: [
            {
              itemIds: ["top-1", "bottom-1", "bag-1"],
              image: "base64-image",
              imageObsolete: true,
            },
          ],
        },
        rejectedUrls: [],
      },
    })?.data?.wardrobe?.outfitSets,
  ).toEqual([
    {
      itemIds: ["top-1", "bottom-1", "bag-1"],
      image: "base64-image",
      imageObsolete: true,
    },
  ]);
});

test("normalizeCapsuleSnapshot reads raw selection text only from current field", () => {
  expect(
    normalizeCapsuleSnapshot({
      filters: {},
      data: {
        wardrobe: {
          items: [],
          outfitSets: [],
          rawSelectionText: " raw ",
          reasoning: "legacy reasoning",
        },
        rejectedUrls: [],
      },
    })?.data.wardrobe?.rawSelectionText,
  ).toBe("raw");
  expect(
    normalizeCapsuleSnapshot({
      filters: {},
      data: {
        wardrobe: {
          items: [],
          outfitSets: [],
          reasoning: "legacy reasoning",
        },
        rejectedUrls: [],
      },
    })?.data.wardrobe?.rawSelectionText,
  ).toBeNull();
});

test("buildProfileCapsuleContext forwards source mode and rejected urls", () => {
  const context = buildProfileCapsuleContext(
    { email: "person@example.com", locale: "en" },
    {
      draft: {
        filters: {
          sourceMode: "wardrobe_preferred",
          formalityLevel: "casual",
          style: "minimalistic",
          occasions: ["office"],
          season: ["spring"],
          audience: "woman",
          color: null,
          pattern: "solid",
          text: "",
        },
        data: {
          wardrobe: null,
          rejectedUrls: ["https://example.com/rejected"],
        },
      },
    },
  );

  expect(context).toMatchObject({
    email: "person@example.com",
    sourceMode: "wardrobe_preferred",
    rejected: ["https://example.com/rejected"],
  });
});

test("buildSharedCapsuleOgMetadata formats English filter sentences and prefers outfit set images", () => {
  const metadata = buildSharedCapsuleOgMetadata({
    name: "Spring <edit>",
    content: {
      filters: {
        sourceMode: "catalog_only",
        formalityLevel: "casual",
        style: "minimalistic",
        occasions: ["office", "date_night"],
        season: ["spring"],
        audience: "woman",
        color: "light blue",
        pattern: "solid",
        text: "Do not include this",
      },
      data: {
        wardrobe: {
          items: [{ imageUrl: "https://images.example.com/item.jpg" }],
          outfitSets: [
            { itemIds: ["top-1"], image: "", imageObsolete: false },
            {
              itemIds: ["top-2"],
              image: "https://images.example.com/outfit.jpg",
              imageObsolete: false,
            },
          ],
        },
        rejectedUrls: [],
      },
    },
  });

  expect(metadata).toEqual({
    title: "Spring <edit>",
    description:
      "Formality: Casual. Style: Minimalistic. Occasions: Office, Date night. Season: Spring. Audience: Woman. Color: Light blue. Pattern: Solid.",
    image: "https://images.example.com/outfit.jpg",
  });
});

test("buildSharedCapsuleOgMetadata falls back to the first item imageUrl", () => {
  expect(
    buildSharedCapsuleOgMetadata({
      name: "Spring edit",
      content: {
        filters: {},
        data: {
          wardrobe: {
            items: [{ imageUrl: "https://images.example.com/item.jpg" }],
            outfitSets: [
              { itemIds: ["top-1"], image: null, imageObsolete: false },
            ],
          },
          rejectedUrls: [],
        },
      },
    })?.image,
  ).toBe("https://images.example.com/item.jpg");
});

test("createCapsuleStore creates unique capsules without resolving active capsules", async () => {
  const calls: StoreCall[] = [];
  let names = ["Spring edit", "Spring edit (1)"];
  const store = createCapsuleStore({
    listCapsuleNamesByEmailImpl: async () => names,
    createCapsuleRecordImpl: async (payload) => {
      calls.push({ type: "create", payload });
      return capsuleRow({
        id: "capsule-new",
        name: payload.name,
        draft: payload.draft,
        saved: payload.saved,
        status: "new",
      });
    },
    getProfileImpl: async () => ({
      email: "person@example.com",
      audience: "woman",
    }),
    getCapsuleByIdForEmailImpl: async () => null,
    listRecentCapsulesByEmailImpl: async () => [
      capsuleRow({ id: "recent-1", name: "Recent" }),
    ],
  });

  const created = await store.createCapsule("person@example.com", {
    name: "Spring edit",
    draft: {
      filters: { audience: "woman" },
      data: { wardrobe: null, rejectedUrls: [] },
    },
  });
  expect(created?.name).toBe("Spring edit (2)");

  const active = await store.resolveActiveCapsule();
  expect(active).toBe(null);
  expect(calls.map((call) => call.type)).toEqual(["create"]);

  names = [];
  const bootstrap = await store.createBootstrapCapsule("person@example.com");
  expect(bootstrap?.id).toBe("capsule-new");
});

test("createCapsuleStore delegates lookup, update, duplicate, state, and delete operations", async () => {
  const calls: StoreCall[] = [];
  const store = createCapsuleStore({
    listCapsuleNamesByEmailImpl: async () => ["Copy"],
    getCapsuleByIdForEmailImpl: async ({ capsuleId }) =>
      capsuleId === "missing" ? null : capsuleRow({ id: capsuleId }),
    listRecentCapsulesByEmailImpl: async ({ limit }) => {
      calls.push({ type: "recent", limit });
      return [capsuleRow({ id: "recent-1" })];
    },
    searchCapsulesByEmailImpl: async ({ query, limit }) => {
      calls.push({ type: "search", query, limit });
      return [capsuleRow({ id: "search-1" })];
    },
    updateCapsuleSnapshotByIdForEmailImpl: async (payload) => {
      calls.push({ type: "update", payload });
      return capsuleRow({
        id: payload.capsuleId,
        draft: payload.draft,
        saved: null,
        status: "new",
      });
    },
    updateCapsuleReportByIdForEmailImpl: async (payload) => {
      calls.push({ type: "report", payload });
      return capsuleRow({
        id: payload.capsuleId,
        draft: {
          filters: {},
          data: { wardrobe: null, rejectedUrls: [] },
          report: payload.report,
        },
        saved: null,
        status: "new",
      });
    },
    renameCapsuleByIdForEmailImpl: async (payload) => {
      calls.push({ type: "rename", payload });
      return capsuleRow({ id: payload.capsuleId, name: payload.name });
    },
    saveCapsuleByIdForEmailImpl: async (payload) =>
      capsuleRow({ id: payload.capsuleId, draft: null, status: "saved" }),
    revertCapsuleDraftByIdForEmailImpl: async (payload) =>
      capsuleRow({ id: payload.capsuleId, draft: null, status: "saved" }),
    createCapsuleRecordImpl: async (payload) => {
      calls.push({ type: "create", payload });
      return capsuleRow({
        id: "copy-1",
        name: payload.name,
        draft: payload.draft,
        saved: payload.saved,
      });
    },
    deleteCapsuleByIdForEmailImpl: async ({ capsuleId }) =>
      capsuleId !== "missing",
    getProfileImpl: async () => ({
      email: "person@example.com",
    }),
  });

  expect((await store.getCapsule("person@example.com", "capsule-1"))?.id).toBe(
    "capsule-1",
  );
  expect(await store.getCapsule("person@example.com", "missing")).toBe(null);
  expect((await store.listRecentCapsules("person@example.com", 3))[0].id).toBe(
    "recent-1",
  );
  expect(
    (await store.searchCapsules("person@example.com", "spring", 4))[0].id,
  ).toBe("search-1");
  expect(
    (
      await store.updateCapsuleSnapshot("person@example.com", "capsule-1", {
        filters: {},
      })
    )?.draft?.data?.rejectedUrls?.length,
  ).toBe(0);
  expect(
    (
      await store.updateCapsuleReport("person@example.com", "capsule-1", {
        verdict: { score: 0.9 },
      })
    )?.draft?.report,
  ).toEqual({ verdict: { score: 0.9 } });
  expect(
    (await store.updateCapsuleReport("person@example.com", "capsule-1", null))
      ?.draft?.report,
  ).toBe(null);
  expect(
    (await store.renameCapsule("person@example.com", "capsule-1", "Copy"))
      ?.name,
  ).toBe("Copy (1)");
  expect(
    (await store.saveCapsule("person@example.com", "capsule-1"))?.status,
  ).toBe("saved");
  expect(
    (await store.revertCapsule("person@example.com", "capsule-1"))?.status,
  ).toBe("saved");
  expect(
    (await store.duplicateCapsule("person@example.com", "capsule-1", "Copy"))
      ?.id,
  ).toBe("copy-1");
  expect(
    await store.duplicateCapsule("person@example.com", "missing", "Copy"),
  ).toBe(null);
  expect(await store.deleteCapsule("person@example.com", "missing")).toBe(
    false,
  );
  expect(await store.deleteCapsule("person@example.com", "capsule-1")).toBe(
    true,
  );
  expect(calls.some((call) => call.type === "active")).toBe(false);
});

test("createCapsuleStore shares, imports, prunes, and rejects unshareable capsules", async () => {
  const calls: StoreCall[] = [];
  const sharedContent = capsuleRow().saved;
  const store = createCapsuleStore({
    nowImpl: () => 0,
    getCapsuleByIdForEmailImpl: async ({ capsuleId }) =>
      capsuleId === "missing"
        ? null
        : capsuleRow({
            id: capsuleId,
            draft:
              capsuleId === "unshareable"
                ? { filters: {}, data: { wardrobe: null, rejectedUrls: [] } }
                : null,
          }),
    pruneExpiredSharedCapsulesImpl: async () => {
      calls.push({ type: "prune" });
    },
    upsertSharedCapsuleImpl: async (payload) => {
      calls.push({ type: "upsert", payload });
      return { id: "share id", expiresAt: payload.expiresAt.toISOString() };
    },
    hashCapsuleContentImpl: () => "content-hash",
    getValidSharedCapsuleByIdImpl: async (id) =>
      id === "share-1"
        ? {
            id,
            name: "Shared capsule",
            content: sharedContent,
            expiresAt: timestamp,
          }
        : id === "bad-share"
          ? {
              id,
              name: "Bad",
              content: { filters: {}, data: { wardrobe: null } },
              expiresAt: timestamp,
            }
          : null,
    listCapsuleNamesByEmailImpl: async () => [],
    createCapsuleRecordImpl: async (payload) => {
      calls.push({ type: "create", payload });
      return capsuleRow({
        id: "imported-1",
        name: payload.name,
        draft: payload.draft,
        saved: payload.saved,
      });
    },
  });

  expect(
    await store.createCapsuleShare(
      "person@example.com",
      "missing",
      "https://client.example",
    ),
  ).toBe(null);
  const share = await store.createCapsuleShare(
    "person@example.com",
    "capsule-1",
    "https://client.example/",
  );
  expect(share).toEqual({
    id: "share id",
    url: "https://client.example/share/share%20id",
    expiresAt: new Date(604800000).toISOString(),
  });
  await expect(() =>
    store.createCapsuleShare("person@example.com", "unshareable", ""),
  ).rejects.toThrow(/capsule_not_shareable/);

  expect(await store.getSharedCapsule(" share-1 ")).toEqual({
    id: "share-1",
    name: "Shared capsule",
    expiresAt: timestamp,
  });
  expect(await store.getSharedCapsule("missing")).toBe(null);
  expect((await store.getSharedCapsuleOgMetadata("share-1"))?.title).toBe(
    "Shared capsule",
  );
  expect(await store.getSharedCapsuleOgMetadata("missing")).toBe(null);
  expect(
    (await store.importSharedCapsule("person@example.com", "share-1"))?.id,
  ).toBe("imported-1");
  expect(
    await store.importSharedCapsule("missing@example.com", "missing"),
  ).toBe(null);
  await expect(() =>
    store.importSharedCapsule("person@example.com", "bad-share"),
  ).rejects.toThrow(/capsule_not_shareable/);
  expect(
    calls.filter((call) => call.type === "prune").length >= 3,
  ).toBeTruthy();
});

test("createCapsuleStore normalizes catalog wardrobe items for shares", async () => {
  const calls: StoreCall[] = [];
  const store = createCapsuleStore({
    nowImpl: () => 0,
    getCapsuleByIdForEmailImpl: async () =>
      capsuleRow({
        saved: {
          filters: {},
          data: {
            wardrobe: {
              items: [
                {
                  id: "catalog-7",
                  source: "from_catalog",
                  url: "https://example.com/catalog-7",
                  name: "Catalog shirt",
                  audience: "woman",
                  category: "top",
                  imageUrl: "https://example.com/catalog-7.jpg",
                  brand: "Dropped",
                },
                {
                  id: "catalog-8",
                  url: "https://example.com/catalog-8",
                  name: "Catalog jeans",
                  audience: "woman",
                  category: "bottom",
                  imageUrl: "https://example.com/catalog-8.jpg",
                  brand: "Dropped",
                },
              ],
              outfitSets: [{ itemIds: ["catalog-7", "catalog-8"] }],
            },
            rejectedUrls: [],
          },
        },
      }),
    pruneExpiredSharedCapsulesImpl: async () => {
      calls.push({ type: "prune" });
    },
    upsertSharedCapsuleImpl: async (payload) => {
      calls.push({ type: "upsert", payload });
      return { id: "share-1", expiresAt: payload.expiresAt.toISOString() };
    },
    hashCapsuleContentImpl: (content) => {
      calls.push({ type: "hash", payload: content });
      return "content-hash";
    },
  });

  await expect(
    store.createCapsuleShare(
      "person@example.com",
      "capsule-1",
      "https://client.example",
    ),
  ).resolves.toEqual({
    id: "share-1",
    url: "https://client.example/share/share-1",
    expiresAt: new Date(604800000).toISOString(),
  });

  const upsert = calls.find((call) => call.type === "upsert");
  const content = upsert?.payload?.content as {
    data?: { wardrobe?: { items?: unknown[]; outfitSets?: unknown[] } };
  };
  expect(content?.data?.wardrobe?.items).toEqual([
    {
      id: "catalog-7",
      url: "https://example.com/catalog-7",
      name: "Catalog shirt",
      audience: "woman",
      category: "top",
      imageUrl: "https://example.com/catalog-7.jpg",
    },
    {
      id: "catalog-8",
      url: "https://example.com/catalog-8",
      name: "Catalog jeans",
      audience: "woman",
      category: "bottom",
      imageUrl: "https://example.com/catalog-8.jpg",
    },
  ]);
  expect(content?.data?.wardrobe?.outfitSets).toEqual([
    {
      itemIds: ["catalog-7", "catalog-8"],
      image: null,
      imageObsolete: false,
    },
  ]);
  expect(
    Object.keys(
      (content?.data?.wardrobe?.items as Record<string, unknown>[])[0],
    ).sort(),
  ).toEqual(["audience", "category", "id", "imageUrl", "name", "url"]);
});

test("createCapsuleStore rejects uploaded personal items in shared capsules", async () => {
  const uploadedSnapshot = {
    filters: {},
    data: {
      wardrobe: {
        items: [
          {
            id: "Wuploaded-1",
            url: "wardrobe://uploaded-1",
            name: "Uploaded shirt",
            source: "uploaded",
            audience: "woman",
            category: "top",
            imageUrl: "https://example.com/uploaded.jpg",
          },
        ],
      },
      rejectedUrls: [],
    },
  };
  const store = createCapsuleStore({
    getCapsuleByIdForEmailImpl: async () =>
      capsuleRow({ saved: uploadedSnapshot }),
    getValidSharedCapsuleByIdImpl: async () => ({
      id: "share-1",
      name: "Shared capsule",
      content: uploadedSnapshot,
      expiresAt: timestamp,
    }),
  });

  await expect(() =>
    store.createCapsuleShare(
      "person@example.com",
      "capsule-1",
      "https://client.example",
    ),
  ).rejects.toThrow(/capsule_contains_personal_items/);
  await expect(() =>
    store.importSharedCapsule("person@example.com", "share-1"),
  ).rejects.toThrow(/capsule_contains_personal_items/);
});
