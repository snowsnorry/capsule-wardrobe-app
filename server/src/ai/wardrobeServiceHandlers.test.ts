import { test, expect } from "vitest";
import { createWardrobeService } from "./aiService.js";
import {
  buildCapsuleSnapshot,
  buildNormalizedCapsuleRecord,
  buildNormalizedProfileRecord,
  buildPartialRegenerationJobState,
  buildStoredWardrobePayload,
  buildWardrobeGenerationResult,
  buildWardrobeJobState,
  buildWardrobeUiItem
} from "../test/domainFixtures.js";

function createResponseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

function createCapsuleWithWardrobe(wardrobe = null) {
  return buildNormalizedCapsuleRecord({
    draft: buildCapsuleSnapshot({
      data: {
        wardrobe,
        rejectedUrls: [],
        regeneration: null
      }
    })
  });
}

function toItemIdentity(items) {
  return items.map((item) => ({
    id: item.id,
    url: item.url,
    category: item.category
  }));
}

function toItemCategoryIdentity(items) {
  return items.map((item) => ({
    id: item.id,
    category: item.category
  }));
}

test("getCapsuleItems returns pending regenerate payload when partial regeneration job is active", async () => {
  const service = createWardrobeService({
    getProfileImpl: async () => buildNormalizedProfileRecord({ locale: "en" }),
    getCapsuleImpl: async () => createCapsuleWithWardrobe({
      items: [buildWardrobeUiItem({ id: "top-1", url: "https://example.com/top-1", category: "top" })],
      rawSelectionText: "raw"
    }),
    getPartialRegenerationJobImpl: () => buildPartialRegenerationJobState({
      pendingItemUrls: ["https://example.com/top-1"]
    }),
    jobs: new Map()
  });
  const res = createResponseRecorder();

  await service.getCapsuleItems({
    user: { email: "person@example.com" },
    params: { id: "capsule-1" }
  }, res);

  expect(res.statusCode).toBe(202);
  expect(res.body.pendingStage).toBe("regenerate");
  expect(res.body.pendingRegenerationUrls).toEqual(["https://example.com/top-1"]);
  expect(toItemIdentity(res.body.items)).toEqual([{ id: "top-1", url: "https://example.com/top-1", category: "top" }]);
  expect(res.body.outfitSets).toEqual([]);
});

test("getCapsuleItems returns ready payload from stored wardrobe", async () => {
  const service = createWardrobeService({
    getProfileImpl: async () => buildNormalizedProfileRecord({ locale: "en" }),
    getCapsuleImpl: async () => createCapsuleWithWardrobe({
      items: [buildWardrobeUiItem({ id: "top-1", category: "top", url: undefined, name: undefined, image_url: undefined, audience: undefined })],
      rawSelectionText: "raw-selection",
      swimwearReasoning: "swimwear-json"
    }),
    jobs: new Map()
  });
  const res = createResponseRecorder();

  await service.getCapsuleItems({
    user: { email: "person@example.com" },
    params: { id: "capsule-1" }
  }, res);

  expect(res.statusCode).toBe(200);
  expect(res.body.ok).toBe(true);
  expect(res.body.status).toBe("ready");
  expect(res.body.items).toEqual([
    buildWardrobeUiItem({
      id: "top-1",
      category: "top",
      url: undefined,
      name: undefined,
      image_url: undefined,
      audience: undefined
    })
  ]);
  expect(res.body.outfitSets).toEqual([]);
  expect(res.body.rawSelectionText).toBe("raw-selection");
  expect(res.body.swimwearReasoning).toBe("swimwear-json");
  expect(res.body.hasPendingAdditionalItems).toBe(false);
});

test("getCapsuleItems returns extras pending state when extras are still generating", async () => {
  const jobs = new Map([
    ["person@example.com::capsule-1", buildWardrobeJobState({
      phase: "extras",
      updatedAt: Date.now()
    })]
  ]);
  const service = createWardrobeService({
    getProfileImpl: async () => buildNormalizedProfileRecord({ locale: "en" }),
    getCapsuleImpl: async () => createCapsuleWithWardrobe({
      items: [buildWardrobeUiItem({ id: "top-1", category: "top", url: undefined, name: undefined, image_url: undefined, audience: undefined })],
      rawSelectionText: "raw-selection",
      swimwearReasoning: "swimwear-json"
    }),
    jobs
  });
  const res = createResponseRecorder();

  await service.getCapsuleItems({
    user: { email: "person@example.com" },
    params: { id: "capsule-1" }
  }, res);

  expect(res.statusCode).toBe(202);
  expect(res.body.pendingStage).toBe("extras");
  expect(res.body.hasPendingAdditionalItems).toBe(true);
  expect(toItemCategoryIdentity(res.body.items)).toEqual([{ id: "top-1", category: "top" }]);
  expect(res.body.outfitSets).toEqual([]);
});

test("regenerateCapsuleWardrobe starts a new pending job without clearing stored items", async () => {
  const updates = [];
  let generatedProfile = null;
  let renameCallCount = 0;
  const jobs = new Map();
  const existingWardrobe = buildStoredWardrobePayload({
    items: [buildWardrobeUiItem({ id: "top-1", category: "top", url: undefined, name: undefined, image_url: undefined, audience: undefined })]
  });
  const service = createWardrobeService({
    getProfileImpl: async () => buildNormalizedProfileRecord({ audience: "woman", locale: "en", llm: "openai:gpt-5.5" }),
    getCapsuleImpl: async () => createCapsuleWithWardrobe(existingWardrobe),
    updateCapsuleSnapshotImpl: async (email, capsuleId, draft) => {
      updates.push([email, capsuleId, draft]);
      return buildNormalizedCapsuleRecord({ id: capsuleId, draft, saved: null });
    },
    generateCapsuleWardrobeImpl: async (profile) => {
      generatedProfile = profile;
      return buildWardrobeGenerationResult({
        items: [buildWardrobeUiItem({ id: "top-2", category: "top", url: undefined, name: undefined, image_url: undefined, audience: undefined })],
        selectedItems: [buildWardrobeUiItem({ id: "top-2", category: "top", url: undefined, name: undefined, image_url: undefined, audience: undefined })],
        promptEmbeddings: [0.1],
        shortCapsuleName: "New Name",
        rawSelectionText: "raw"
      });
    },
    renameCapsuleImpl: async () => {
      renameCallCount += 1;
      return null;
    },
    shouldGenerateSwimwearImpl: () => false,
    jobs,
    randomUuidImpl: () => "req-123"
  });
  const res = createResponseRecorder();

  await service.regenerateCapsuleWardrobe({
    user: { email: "person@example.com" },
    params: { id: "capsule-1" }
  }, res);

  expect(res.statusCode).toBe(202);
  expect(res.body.pendingStage).toBe("capsule");
  expect(updates[0]).toEqual(["person@example.com", "capsule-1", {
    filters: createCapsuleWithWardrobe().draft.filters,
    data: {
      wardrobe: existingWardrobe,
      rejectedUrls: [],
      regeneration: {
        status: "pending",
        kind: "full",
        startedAt: updates[0][2].data.regeneration.startedAt,
        requestId: "req-123"
      }
    }
  }]);

  const job = service.getWardrobeJob("person@example.com", "capsule-1");
  expect(job).toBeTruthy();
  await job.promise;

  expect(generatedProfile.items).toEqual(null);
  expect(job.status).toBe("completed");
  expect(renameCallCount).toBe(0);
  expect(updates[1]).toEqual(["person@example.com", "capsule-1", {
    filters: createCapsuleWithWardrobe().draft.filters,
    data: {
      wardrobe: {
        items: [
          buildWardrobeUiItem({
            id: "top-2",
            category: "top",
            url: undefined,
            name: undefined,
            image_url: undefined,
            audience: undefined
          })
        ],
        outfitSets: [],
        rawSelectionText: "raw",
        swimwearReasoning: null,
        swimwearRawSelectionText: null
      },
      rejectedUrls: [],
      regeneration: null
    }
  }]);
});

test("regenerateCapsuleWardrobe renames an empty new capsule from shortCapsuleName before swimwear completes", async () => {
  const renamedCapsules = [];
  const service = createWardrobeService({
    getProfileImpl: async () => buildNormalizedProfileRecord({ audience: "woman", season: ["summer"], locale: "en" }),
    getCapsuleImpl: async () => createCapsuleWithWardrobe(null),
    updateCapsuleSnapshotImpl: async (_email, capsuleId, draft) => (
      buildNormalizedCapsuleRecord({ id: capsuleId, name: "<New capsule>", draft, saved: null, status: "new" })
    ),
    generateCapsuleWardrobeImpl: async () => buildWardrobeGenerationResult({
      items: [
        buildWardrobeUiItem({ id: "top-1", category: "top", url: undefined, name: undefined, image_url: undefined, audience: undefined })
      ],
      selectedItems: [
        buildWardrobeUiItem({ id: "top-1", category: "top", url: undefined, name: undefined, image_url: undefined, audience: undefined })
      ],
      promptEmbeddings: [0.1],
      shortCapsuleName: "Resort Core"
    }),
    renameCapsuleImpl: async (email, capsuleId, name) => {
      renamedCapsules.push([email, capsuleId, name]);
      return buildNormalizedCapsuleRecord({ id: capsuleId, name, draft: createCapsuleWithWardrobe(null).draft, saved: null, status: "new" });
    },
    shouldGenerateSwimwearImpl: () => true,
    generateSwimwearAdditionImpl: async () => ({
      items: [
        buildWardrobeUiItem({ id: "swim-1", category: "swimwear", url: "https://example.com/swim-1", name: "Swim 1", image_url: "https://example.com/swim-1.jpg", audience: "woman" })
      ],
      reasoning: "swimwear-json",
      rawSelectionText: "swimwear-raw"
    }),
    jobs: new Map(),
    randomUuidImpl: () => "req-new-name"
  });
  const res = createResponseRecorder();

  await service.regenerateCapsuleWardrobe({
    user: { email: "person@example.com" },
    params: { id: "capsule-1" }
  }, res);

  expect(res.statusCode).toBe(202);
  const job = service.getWardrobeJob("person@example.com", "capsule-1");
  expect(job).toBeTruthy();
  await job.promise;

  expect(job.status).toBe("completed");
  expect(renamedCapsules).toEqual([["person@example.com", "capsule-1", "Resort Core"]]);
});

test("regenerateCapsuleWardrobe uses profile llm=none instead of query flag", async () => {
  let generatedProfile = null;
  const service = createWardrobeService({
    getProfileImpl: async () => buildNormalizedProfileRecord({ audience: "woman", locale: "en", llm: "none" }),
    getCapsuleImpl: async () => createCapsuleWithWardrobe({
      items: [buildWardrobeUiItem({ id: "top-1", category: "top", url: undefined, name: undefined, image_url: undefined, audience: undefined })]
    }),
    updateCapsuleSnapshotImpl: async (_email, capsuleId, draft) => buildNormalizedCapsuleRecord({ id: capsuleId, draft, saved: null }),
    generateCapsuleWardrobeImpl: async (profile) => {
      generatedProfile = profile;
      return buildWardrobeGenerationResult({
        items: [buildWardrobeUiItem({ id: "top-2", category: "top", url: undefined, name: undefined, image_url: undefined, audience: undefined })],
        selectedItems: [buildWardrobeUiItem({ id: "top-2", category: "top", url: undefined, name: undefined, image_url: undefined, audience: undefined })],
        promptEmbeddings: [0.1]
      });
    },
    shouldGenerateSwimwearImpl: () => false,
    jobs: new Map(),
    randomUuidImpl: () => "req-no-llm"
  });
  const res = createResponseRecorder();

  await service.regenerateCapsuleWardrobe({
    user: { email: "person@example.com" },
    params: { id: "capsule-1" }
  }, res);

  const job = service.getWardrobeJob("person@example.com", "capsule-1");
  expect(job).toBeTruthy();
  await job.promise;
  expect(generatedProfile.llm).toBe("none");
});

test("regenerateCapsuleWardrobe restores stored items and clears pending marker when generation fails", async () => {
  const updates = [];
  const jobs = new Map();
  const existingWardrobe = buildStoredWardrobePayload({
    items: [buildWardrobeUiItem({ id: "top-1", category: "top", url: undefined, name: undefined, image_url: undefined, audience: undefined })]
  });
  const service = createWardrobeService({
    getProfileImpl: async () => buildNormalizedProfileRecord({ audience: "woman", locale: "en" }),
    getCapsuleImpl: async () => createCapsuleWithWardrobe(existingWardrobe),
    updateCapsuleSnapshotImpl: async (email, capsuleId, draft) => {
      updates.push([email, capsuleId, draft]);
      return buildNormalizedCapsuleRecord({ id: capsuleId, draft, saved: null });
    },
    generateCapsuleWardrobeImpl: async () => {
      throw new Error("llm_failed");
    },
    shouldGenerateSwimwearImpl: () => false,
    jobs,
    randomUuidImpl: () => "req-fail"
  });
  const originalError = console.error;
  console.error = () => {};

  try {
    const res = createResponseRecorder();
    await service.regenerateCapsuleWardrobe({
      user: { email: "person@example.com" },
      params: { id: "capsule-1" }
    }, res);

    expect(res.statusCode).toBe(202);
    const job = service.getWardrobeJob("person@example.com", "capsule-1");
    expect(job).toBeTruthy();
    await job.promise;

    expect(job.status).toBe("failed");
    expect(updates[1]).toEqual(["person@example.com", "capsule-1", {
      filters: createCapsuleWithWardrobe().draft.filters,
      data: {
        wardrobe: existingWardrobe,
        rejectedUrls: [],
        regeneration: null
      }
    }]);
  } finally {
    console.error = originalError;
  }
});

test("getCapsuleItems surfaces failed job as service_unavailable and drops stale failed entry", async () => {
  const jobs = new Map([
    ["person@example.com::capsule-1", buildWardrobeJobState({
      status: "failed",
      phase: "failed",
      updatedAt: Date.now(),
      error: Object.assign(new Error("failed"), { rawSelectionText: "llm raw" })
    })]
  ]);
  const service = createWardrobeService({
    getProfileImpl: async () => buildNormalizedProfileRecord({ locale: "en" }),
    getCapsuleImpl: async () => createCapsuleWithWardrobe(null),
    jobs
  });
  const res = createResponseRecorder();

  await service.getCapsuleItems({
    user: { email: "person@example.com" },
    params: { id: "capsule-1" }
  }, res);

  expect(res.statusCode).toBe(503);
  expect(res.body).toEqual({
    error: "service_unavailable",
    rawSelectionText: "llm raw"
  });
  expect(jobs.has("person@example.com::capsule-1")).toBe(false);
});

test("getCapsuleItems clears stale full regeneration marker when no job is active", async () => {
  const updates = [];
  const existingWardrobe = buildStoredWardrobePayload({
    items: [buildWardrobeUiItem({ id: "top-1", category: "top", url: undefined, name: undefined, image_url: undefined, audience: undefined })]
  });
  const service = createWardrobeService({
    getProfileImpl: async () => buildNormalizedProfileRecord({ locale: "en" }),
    getCapsuleImpl: async () => buildNormalizedCapsuleRecord({
      draft: buildCapsuleSnapshot({
        data: {
          wardrobe: existingWardrobe,
          rejectedUrls: [],
          regeneration: {
            status: "pending",
            kind: "full",
            startedAt: "2026-04-22T00:00:00.000Z",
            requestId: "stale-req"
          }
        }
      })
    }),
    updateCapsuleSnapshotImpl: async (email, capsuleId, draft) => {
      updates.push([email, capsuleId, draft]);
      return buildNormalizedCapsuleRecord({ id: capsuleId, draft, saved: null });
    },
    jobs: new Map()
  });
  const res = createResponseRecorder();

  await service.getCapsuleItems({
    user: { email: "person@example.com" },
    params: { id: "capsule-1" }
  }, res);

  expect(res.statusCode).toBe(503);
  expect(updates).toEqual([["person@example.com", "capsule-1", {
    filters: createCapsuleWithWardrobe().draft.filters,
    data: {
      wardrobe: existingWardrobe,
      rejectedUrls: [],
      regeneration: null
    }
  }]]);
});
