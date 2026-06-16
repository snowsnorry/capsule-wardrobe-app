import { TEST_CLIENT_ORIGIN } from "./serverRouteTestConstants.js";

export function createCapsuleDependencies() {
  return {
    resolveActiveCapsuleImpl: async () => null,
    listRecentCapsulesImpl: async () => [],
    countCapsulesImpl: async () => 0,
    searchCapsulesImpl: async () => [],
    getCapsuleImpl: async () => ({
      id: "capsule-1",
      name: "<New capsule>",
      draft: {
        filters: {
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
          wardrobe: { items: [{ url: "https://example.com/1" }] },
          rejectedUrls: [],
        },
      },
      saved: null,
      status: "new",
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    }),
    createCapsuleImpl: async (_email, payload) => ({
      id: "capsule-2",
      status: "new",
      ...payload,
    }),
    ...createCapsuleShareDependencies(),
    ...createCapsuleMutationDependencies(),
  };
}

function createCapsuleShareDependencies() {
  return {
    createCapsuleShareImpl: async () => ({
      id: "share-1",
      url: `${TEST_CLIENT_ORIGIN}/share/share-1`,
      expiresAt: new Date(60_000).toISOString(),
    }),
    getSharedCapsuleImpl: async (id) =>
      id === "share-1"
        ? { id, name: "Spring edit", expiresAt: new Date(60_000).toISOString() }
        : null,
    getSharedCapsuleOgMetadataImpl: async (id) =>
      id === "share-1"
        ? { title: "Spring edit", description: "", image: "" }
        : null,
    importSharedCapsuleImpl: async () => ({
      id: "capsule-imported",
      name: "Spring edit (2)",
      draft: null,
      saved: {
        filters: {},
        data: {
          wardrobe: { items: [{ url: "https://example.com/1" }] },
          rejectedUrls: [],
        },
      },
      status: "saved",
    }),
  };
}

function createCapsuleMutationDependencies() {
  return {
    updateCapsuleSnapshotImpl: async (_email, _id, draft) => ({
      id: "capsule-1",
      draft,
      saved: null,
      status: "new",
    }),
    saveCapsuleImpl: async () => ({
      id: "capsule-1",
      draft: null,
      saved: { filters: {}, data: {} },
      status: "saved",
    }),
    revertCapsuleImpl: async () => ({
      id: "capsule-1",
      draft: null,
      saved: { filters: {}, data: {} },
      status: "saved",
    }),
    renameCapsuleImpl: async (_email, id, name) => ({
      id,
      name,
      draft: null,
      saved: null,
      status: "new",
    }),
    setCapsulePinImpl: async (_email, id, pin) => ({
      id,
      pin,
      draft: null,
      saved: null,
      status: "new",
    }),
    duplicateCapsuleImpl: async () => ({
      id: "capsule-3",
      name: "<New capsule (1)>",
      draft: null,
      saved: { filters: {}, data: {} },
      status: "saved",
    }),
    deleteCapsuleImpl: async () => true,
    setActiveCapsuleIdImpl: async () => ({ activeCapsuleId: null }),
    validateCapsuleAnchorItemsImpl: async (_email, anchorItemRefs) => ({
      anchorWardrobeNumericIds: [],
      anchorCatalogUrls: [],
      anchorItemRefs: Array.isArray(anchorItemRefs) ? anchorItemRefs : [],
      anchorItems: [],
    }),
  };
}
