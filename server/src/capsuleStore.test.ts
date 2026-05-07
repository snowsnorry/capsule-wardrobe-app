import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSharedCapsuleOgMetadata,
  createCapsuleStore,
  normalizeCapsuleFilters,
  normalizeCapsuleSnapshot
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
        formalityLevel: "casual",
        style: "minimalistic",
        occasions: ["office"],
        season: ["spring"],
        audience: "woman",
        color: null,
        pattern: "solid",
        text: ""
      },
      data: {
        wardrobe: { items: [{ id: "top-1", image_url: "https://images.example.com/top.jpg" }] },
        rejectedUrls: []
      }
    },
    status: "saved",
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides
  };
}

test("normalizeCapsuleFilters drops removed profile occasions and keeps supported values", () => {
  assert.deepEqual(
    normalizeCapsuleFilters({
      occasions: ["office", "school_drop-off", "everyday_errands", "weekend_with_family", "office"]
    }).occasions,
    ["office", "everyday_errands"]
  );
});

test("normalizeCapsuleSnapshot sanitizes saved profile occasions on read and write", () => {
  assert.deepEqual(
    normalizeCapsuleSnapshot({
      filters: {
        formalityLevel: "",
        style: null,
        occasions: ["office", "school_drop-off", "weekend_with_family"],
        season: [],
        audience: "",
        color: null,
        pattern: "solid",
        text: ""
      },
      data: {
        wardrobe: null,
        rejectedUrls: []
      }
    })?.filters?.occasions,
    ["office"]
  );
});

test("normalizeCapsuleSnapshot preserves outfit set image payloads", () => {
  assert.deepEqual(
    normalizeCapsuleSnapshot({
      filters: {},
      data: {
        wardrobe: {
          items: [],
          outfitSets: [{
            itemIds: ["top-1", "bottom-1", "bag-1"],
            image: "base64-image",
            imageObsolete: true
          }]
        },
        rejectedUrls: []
      }
    })?.data?.wardrobe?.outfitSets,
    [{
      itemIds: ["top-1", "bottom-1", "bag-1"],
      image: "base64-image",
      imageObsolete: true
    }]
  );
});

test("buildSharedCapsuleOgMetadata formats English filter sentences and prefers outfit set images", () => {
  const metadata = buildSharedCapsuleOgMetadata({
    name: "Spring <edit>",
    content: {
      filters: {
        formalityLevel: "casual",
        style: "minimalistic",
        occasions: ["office", "date_night"],
        season: ["spring"],
        audience: "woman",
        color: "light blue",
        pattern: "solid",
        text: "Do not include this"
      },
      data: {
        wardrobe: {
          items: [{ image_url: "https://images.example.com/item.jpg" }],
          outfitSets: [
            { itemIds: ["top-1"], image: "", imageObsolete: false },
            { itemIds: ["top-2"], image: "https://images.example.com/outfit.jpg", imageObsolete: false }
          ]
        },
        rejectedUrls: []
      }
    }
  });

  assert.deepEqual(metadata, {
    title: "Spring <edit>",
    description: "Formality: Casual. Style: Minimalistic. Occasions: Office, Date night. Season: Spring. Audience: Woman. Color: Light blue. Pattern: Solid.",
    image: "https://images.example.com/outfit.jpg"
  });
});

test("buildSharedCapsuleOgMetadata falls back to the first item image_url", () => {
  assert.equal(
    buildSharedCapsuleOgMetadata({
      name: "Spring edit",
      content: {
        filters: {},
        data: {
          wardrobe: {
            items: [{ image_url: "https://images.example.com/item.jpg" }],
            outfitSets: [{ itemIds: ["top-1"], image: null, imageObsolete: false }]
          },
          rejectedUrls: []
        }
      }
    })?.image,
    "https://images.example.com/item.jpg"
  );
});

test("createCapsuleStore creates unique capsules and resolves active capsules", async () => {
  const calls: StoreCall[] = [];
  let names = ["Spring edit", "Spring edit (1)"];
  const store = createCapsuleStore({
    listCapsuleNamesByEmailImpl: async () => names,
    createCapsuleRecordImpl: async (payload) => {
      calls.push({ type: "create", payload });
      return capsuleRow({ id: "capsule-new", name: payload.name, draft: payload.draft, saved: payload.saved, status: "new" });
    },
    updateProfileActiveCapsuleIdByEmailImpl: async (payload) => {
      calls.push({ type: "active", payload });
      return payload;
    },
    getProfileImpl: async () => ({ email: "person@example.com", activeCapsuleId: "missing-capsule", audience: "woman" }),
    getCapsuleByIdForEmailImpl: async () => null,
    listRecentCapsulesByEmailImpl: async () => [capsuleRow({ id: "recent-1", name: "Recent" })]
  });

  const created = await store.createCapsule("person@example.com", {
    name: "Spring edit",
    draft: { filters: { audience: "woman" }, data: { wardrobe: null, rejectedUrls: [] } }
  });
  assert.equal(created?.name, "Spring edit (2)");

  const active = await store.resolveActiveCapsule("person@example.com");
  assert.equal(active?.id, "recent-1");
  assert.deepEqual(calls.map((call) => call.type), ["create", "active", "active"]);

  names = [];
  const bootstrap = await store.createBootstrapCapsule("person@example.com");
  assert.equal(bootstrap?.id, "capsule-new");
});

test("createCapsuleStore delegates lookup, update, duplicate, state, and delete operations", async () => {
  const calls: StoreCall[] = [];
  const store = createCapsuleStore({
    listCapsuleNamesByEmailImpl: async () => ["Copy"],
    getCapsuleByIdForEmailImpl: async ({ capsuleId }) => (
      capsuleId === "missing" ? null : capsuleRow({ id: capsuleId })
    ),
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
      return capsuleRow({ id: payload.capsuleId, draft: payload.draft, saved: null, status: "new" });
    },
    renameCapsuleByIdForEmailImpl: async (payload) => {
      calls.push({ type: "rename", payload });
      return capsuleRow({ id: payload.capsuleId, name: payload.name });
    },
    saveCapsuleByIdForEmailImpl: async (payload) => capsuleRow({ id: payload.capsuleId, draft: null, status: "saved" }),
    revertCapsuleDraftByIdForEmailImpl: async (payload) => capsuleRow({ id: payload.capsuleId, draft: null, status: "saved" }),
    createCapsuleRecordImpl: async (payload) => {
      calls.push({ type: "create", payload });
      return capsuleRow({ id: "copy-1", name: payload.name, draft: payload.draft, saved: payload.saved });
    },
    updateProfileActiveCapsuleIdByEmailImpl: async (payload) => {
      calls.push({ type: "active", payload });
      return payload;
    },
    deleteCapsuleByIdForEmailImpl: async ({ capsuleId }) => capsuleId !== "missing",
    getProfileImpl: async () => ({ email: "person@example.com", activeCapsuleId: "capsule-1" })
  });

  assert.equal((await store.getCapsule("person@example.com", "capsule-1"))?.id, "capsule-1");
  assert.equal((await store.getCapsule("person@example.com", "missing")), null);
  assert.equal((await store.listRecentCapsules("person@example.com", 3))[0].id, "recent-1");
  assert.equal((await store.searchCapsules("person@example.com", "spring", 4))[0].id, "search-1");
  assert.equal((await store.updateCapsuleSnapshot("person@example.com", "capsule-1", { filters: {} }))?.draft?.data?.rejectedUrls?.length, 0);
  assert.equal((await store.renameCapsule("person@example.com", "capsule-1", "Copy"))?.name, "Copy (1)");
  assert.equal((await store.saveCapsule("person@example.com", "capsule-1"))?.status, "saved");
  assert.equal((await store.revertCapsule("person@example.com", "capsule-1"))?.status, "saved");
  assert.equal((await store.duplicateCapsule("person@example.com", "capsule-1", "Copy"))?.id, "copy-1");
  assert.equal(await store.duplicateCapsule("person@example.com", "missing", "Copy"), null);
  assert.equal(await store.deleteCapsule("person@example.com", "missing"), false);
  assert.equal(await store.deleteCapsule("person@example.com", "capsule-1"), true);
  assert.ok(calls.some((call) => call.type === "active" && call.payload.activeCapsuleId === "recent-1"));
});

test("createCapsuleStore shares, imports, prunes, and rejects unshareable capsules", async () => {
  const calls: StoreCall[] = [];
  const sharedContent = capsuleRow().saved;
  const store = createCapsuleStore({
    nowImpl: () => 0,
    getCapsuleByIdForEmailImpl: async ({ capsuleId }) => (
      capsuleId === "missing"
        ? null
        : capsuleRow({
          id: capsuleId,
          draft: capsuleId === "unshareable" ? { filters: {}, data: { wardrobe: null, rejectedUrls: [] } } : null
        })
    ),
    pruneExpiredSharedCapsulesImpl: async () => {
      calls.push({ type: "prune" });
    },
    upsertSharedCapsuleImpl: async (payload) => {
      calls.push({ type: "upsert", payload });
      return { id: "share id", expiresAt: payload.expiresAt.toISOString() };
    },
    hashCapsuleContentImpl: () => "content-hash",
    getValidSharedCapsuleByIdImpl: async (id) => (
      id === "share-1"
        ? { id, name: "Shared capsule", content: sharedContent, expiresAt: timestamp }
        : id === "bad-share"
          ? { id, name: "Bad", content: { filters: {}, data: { wardrobe: null } }, expiresAt: timestamp }
          : null
    ),
    listCapsuleNamesByEmailImpl: async () => [],
    createCapsuleRecordImpl: async (payload) => {
      calls.push({ type: "create", payload });
      return capsuleRow({ id: "imported-1", name: payload.name, draft: payload.draft, saved: payload.saved });
    },
    updateProfileActiveCapsuleIdByEmailImpl: async (payload) => {
      calls.push({ type: "active", payload });
      return payload;
    }
  });

  assert.equal(await store.createCapsuleShare("person@example.com", "missing", "https://client.example"), null);
  const share = await store.createCapsuleShare("person@example.com", "capsule-1", "https://client.example/");
  assert.deepEqual(share, {
    id: "share id",
    url: "https://client.example/share/share%20id",
    expiresAt: new Date(604800000).toISOString()
  });
  await assert.rejects(
    () => store.createCapsuleShare("person@example.com", "unshareable", ""),
    /capsule_not_shareable/
  );

  assert.deepEqual(await store.getSharedCapsule(" share-1 "), {
    id: "share-1",
    name: "Shared capsule",
    expiresAt: timestamp
  });
  assert.equal(await store.getSharedCapsule("missing"), null);
  assert.equal((await store.getSharedCapsuleOgMetadata("share-1"))?.title, "Shared capsule");
  assert.equal(await store.getSharedCapsuleOgMetadata("missing"), null);
  assert.equal((await store.importSharedCapsule("person@example.com", "share-1"))?.id, "imported-1");
  assert.equal(await store.importSharedCapsule("missing@example.com", "missing"), null);
  await assert.rejects(
    () => store.importSharedCapsule("person@example.com", "bad-share"),
    /capsule_not_shareable/
  );
  assert.ok(calls.filter((call) => call.type === "prune").length >= 3);
});
