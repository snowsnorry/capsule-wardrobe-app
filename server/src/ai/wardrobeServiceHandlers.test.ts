import test from "node:test";
import assert from "node:assert/strict";
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

  assert.equal(res.statusCode, 202);
  assert.equal(res.body.pendingStage, "regenerate");
  assert.deepEqual(res.body.pendingRegenerationUrls, ["https://example.com/top-1"]);
  assert.deepEqual(toItemIdentity(res.body.items), [{ id: "top-1", url: "https://example.com/top-1", category: "top" }]);
  assert.deepEqual(res.body.outfitSets, []);
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

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.status, "ready");
  assert.deepEqual(res.body.items, [
    buildWardrobeUiItem({
      id: "top-1",
      category: "top",
      url: undefined,
      name: undefined,
      image_url: undefined,
      audience: undefined
    })
  ]);
  assert.deepEqual(res.body.outfitSets, []);
  assert.equal(res.body.rawSelectionText, "raw-selection");
  assert.equal(res.body.swimwearReasoning, "swimwear-json");
  assert.equal(res.body.hasPendingAdditionalItems, false);
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

  assert.equal(res.statusCode, 202);
  assert.equal(res.body.pendingStage, "extras");
  assert.equal(res.body.hasPendingAdditionalItems, true);
  assert.deepEqual(toItemCategoryIdentity(res.body.items), [{ id: "top-1", category: "top" }]);
  assert.deepEqual(res.body.outfitSets, []);
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

  assert.equal(res.statusCode, 202);
  assert.equal(res.body.pendingStage, "capsule");
  assert.deepEqual(updates[0], ["person@example.com", "capsule-1", {
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
  assert.ok(job);
  await job.promise;

  assert.deepEqual(generatedProfile.items, null);
  assert.equal(job.status, "completed");
  assert.equal(renameCallCount, 0);
  assert.deepEqual(updates[1], ["person@example.com", "capsule-1", {
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

  assert.equal(res.statusCode, 202);
  const job = service.getWardrobeJob("person@example.com", "capsule-1");
  assert.ok(job);
  await job.promise;

  assert.equal(job.status, "completed");
  assert.deepEqual(renamedCapsules, [["person@example.com", "capsule-1", "Resort Core"]]);
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
  assert.ok(job);
  await job.promise;
  assert.equal(generatedProfile.llm, "none");
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

    assert.equal(res.statusCode, 202);
    const job = service.getWardrobeJob("person@example.com", "capsule-1");
    assert.ok(job);
    await job.promise;

    assert.equal(job.status, "failed");
    assert.deepEqual(updates[1], ["person@example.com", "capsule-1", {
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

  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, {
    error: "service_unavailable",
    rawSelectionText: "llm raw"
  });
  assert.equal(jobs.has("person@example.com::capsule-1"), false);
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

  assert.equal(res.statusCode, 503);
  assert.deepEqual(updates, [["person@example.com", "capsule-1", {
    filters: createCapsuleWithWardrobe().draft.filters,
    data: {
      wardrobe: existingWardrobe,
      rejectedUrls: [],
      regeneration: null
    }
  }]]);
});
