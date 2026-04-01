import test from "node:test";
import assert from "node:assert/strict";
import {
  createWardrobeService,
  getSelectedIdsFromCapsule,
  getStoredWardrobePayload
} from "./ai.js";

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
  return {
    id: "capsule-1",
    draft: {
      filters: {
        formalityLevel: "casual",
        style: "minimalistic",
        occasions: ["office"],
        season: ["spring"],
        audience: "woman",
        color: null,
        pattern: null,
        locale: "en"
      },
      data: {
        wardrobe,
        rejectedUrls: []
      }
    }
  };
}

test("getSelectedIdsFromCapsule flattens only non-empty ids from capsule object", () => {
  assert.deepEqual(
    getSelectedIdsFromCapsule({
      top: ["1", "2", ""],
      bottom: ["3"],
      bag: null,
      misc: "nope"
    }),
    ["1", "2", "3"]
  );
});

test("getStoredWardrobePayload normalizes legacy arrays and object payloads", () => {
  assert.deepEqual(
    getStoredWardrobePayload({
      items: [{ id: "1" }]
    }),
    {
      items: [{ id: "1" }],
      reasoning: null,
      rawSelectionText: null,
      swimwearReasoning: null,
      swimwearRawSelectionText: null
    }
  );

  assert.deepEqual(
    getStoredWardrobePayload({
      items: {
        items: [{ id: "2" }],
        reasoning: "r",
        rawSelectionText: "raw",
        swimwearReasoning: "swim",
        swimwearRawSelectionText: "swim-raw"
      }
    }),
    {
      items: [{ id: "2" }],
      reasoning: "r",
      rawSelectionText: "raw",
      swimwearReasoning: "swim",
      swimwearRawSelectionText: "swim-raw"
    }
  );
});

test("getCapsuleItems returns pending regenerate payload when partial regeneration job is active", async () => {
  const service = createWardrobeService({
    getProfileImpl: async () => ({ locale: "en" }),
    getCapsuleImpl: async () => createCapsuleWithWardrobe({
      items: [{ id: "top-1", url: "https://example.com/top-1", category: "top" }],
      reasoning: "capsule",
      rawSelectionText: "raw"
    }),
    getPartialRegenerationJobImpl: () => ({
      status: "pending",
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
  assert.deepEqual(res.body.items, [{ id: "top-1", url: "https://example.com/top-1", category: "top" }]);
});

test("getCapsuleItems returns ready payload from stored wardrobe", async () => {
  const service = createWardrobeService({
    getProfileImpl: async () => ({ locale: "en" }),
    getCapsuleImpl: async () => createCapsuleWithWardrobe({
      items: [{ id: "top-1", category: "top" }],
      reasoning: "capsule-json",
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
  assert.deepEqual(res.body, {
    ok: true,
    status: "ready",
    items: [{ id: "top-1", category: "top" }],
    reasoning: "capsule-json",
    rawSelectionText: "raw-selection",
    swimwearReasoning: "swimwear-json",
    hasPendingAdditionalItems: false
  });
});

test("getCapsuleItems returns extras pending state when extras are still generating", async () => {
  const jobs = new Map([
    ["person@example.com::capsule-1", {
      status: "pending",
      phase: "extras",
      updatedAt: Date.now()
    }]
  ]);
  const service = createWardrobeService({
    getProfileImpl: async () => ({ locale: "en" }),
    getCapsuleImpl: async () => createCapsuleWithWardrobe({
      items: [{ id: "top-1", category: "top" }],
      reasoning: "capsule-json",
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
  assert.deepEqual(res.body.items, [{ id: "top-1", category: "top" }]);
});

test("regenerateCapsuleWardrobe starts a new pending job and clears stored items", async () => {
  const updates = [];
  let generatedProfile = null;
  const jobs = new Map();
  const service = createWardrobeService({
    getProfileImpl: async () => ({ audience: "woman", locale: "en" }),
    getCapsuleImpl: async () => createCapsuleWithWardrobe({
      items: [{ id: "top-1", category: "top" }]
    }),
    updateCapsuleSnapshotImpl: async (email, capsuleId, draft) => {
      updates.push([email, capsuleId, draft]);
      return { id: capsuleId, draft, saved: null };
    },
    generateCapsuleWardrobeImpl: async (profile) => {
      generatedProfile = profile;
      return {
        items: [{ id: "top-2", category: "top" }],
        selectedItems: [{ id: "top-2", category: "top" }],
        promptEmbeddings: [0.1],
        reasoning: "reasoning",
        rawSelectionText: "raw"
      };
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
      wardrobe: null,
      rejectedUrls: []
    }
  }]);

  const job = service.getWardrobeJob("person@example.com", "capsule-1");
  assert.ok(job);
  await job.promise;

  assert.deepEqual(generatedProfile.items, null);
  assert.equal(job.status, "completed");
  assert.deepEqual(updates[1], ["person@example.com", "capsule-1", {
    filters: createCapsuleWithWardrobe().draft.filters,
    data: {
      wardrobe: {
        items: [{ id: "top-2", category: "top" }],
        reasoning: "reasoning",
        rawSelectionText: "raw",
        swimwearReasoning: null,
        swimwearRawSelectionText: null
      },
      rejectedUrls: []
    }
  }]);
});

test("regenerateCapsuleWardrobe forwards nollm mode from query params", async () => {
  let generatedProfile = null;
  const service = createWardrobeService({
    getProfileImpl: async () => ({ audience: "woman", locale: "en" }),
    getCapsuleImpl: async () => createCapsuleWithWardrobe({
      items: [{ id: "top-1", category: "top" }]
    }),
    updateCapsuleSnapshotImpl: async (_email, capsuleId, draft) => ({ id: capsuleId, draft, saved: null }),
    generateCapsuleWardrobeImpl: async (profile) => {
      generatedProfile = profile;
      return {
        items: [{ id: "top-2", category: "top" }],
        selectedItems: [{ id: "top-2", category: "top" }],
        promptEmbeddings: [0.1],
        reasoning: null,
        rawSelectionText: null
      };
    },
    shouldGenerateSwimwearImpl: () => false,
    jobs: new Map(),
    randomUuidImpl: () => "req-nollm"
  });
  const res = createResponseRecorder();

  await service.regenerateCapsuleWardrobe({
    user: { email: "person@example.com" },
    params: { id: "capsule-1" },
    query: { nollm: "true" }
  }, res);

  const job = service.getWardrobeJob("person@example.com", "capsule-1");
  assert.ok(job);
  await job.promise;
  assert.equal(generatedProfile.noLlm, true);
});

test("getCapsuleItems surfaces failed job as service_unavailable and drops stale failed entry", async () => {
  const jobs = new Map([
    ["person@example.com::capsule-1", {
      status: "failed",
      phase: "failed",
      updatedAt: Date.now(),
      error: Object.assign(new Error("failed"), { rawSelectionText: "llm raw" })
    }]
  ]);
  const service = createWardrobeService({
    getProfileImpl: async () => ({ locale: "en" }),
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

test("startWardrobeJob reuses active pending job for the same email", async () => {
  let resolveGeneration;
  const pendingGeneration = new Promise((resolve) => {
    resolveGeneration = resolve;
  });
  const service = createWardrobeService({
    generateCapsuleWardrobeImpl: async () => pendingGeneration,
    updateCapsuleSnapshotImpl: async () => {},
    jobs: new Map()
  });

  const first = service.startWardrobeJob("person@example.com", "capsule-1", { locale: "en" }, createCapsuleWithWardrobe(null));
  const second = service.startWardrobeJob("person@example.com", "capsule-1", { locale: "en" }, createCapsuleWithWardrobe(null));

  assert.equal(first, second);

  resolveGeneration({
    items: [{ id: "top-1", category: "top" }],
    selectedItems: [{ id: "top-1", category: "top" }],
    promptEmbeddings: [0.1]
  });
  await first.promise;
});

test("startWardrobeJob stores capsule result and merges swimwear additions when enabled", async () => {
  const updates = [];
  const service = createWardrobeService({
    generateCapsuleWardrobeImpl: async () => ({
      items: [{ id: "top-1", category: "top" }],
      selectedItems: [{ id: "top-1", category: "top" }],
      promptEmbeddings: [0.1],
      reasoning: "capsule-json",
      rawSelectionText: "capsule-raw"
    }),
    updateCapsuleSnapshotImpl: async (email, capsuleId, draft) => {
      updates.push([email, capsuleId, draft]);
      return { id: capsuleId, draft, saved: null };
    },
    shouldGenerateSwimwearImpl: () => true,
    generateSwimwearAdditionImpl: async () => ({
      items: [
        { id: "swim-1", category: "swimwear" },
        { id: "top-1", category: "top" }
      ],
      reasoning: "swimwear-json",
      rawSelectionText: "swimwear-raw"
    }),
    jobs: new Map()
  });

  const job = service.startWardrobeJob(
    "person@example.com",
    "capsule-1",
    { audience: "woman", season: ["summer"], locale: "en" },
    createCapsuleWithWardrobe(null)
  );
  await job.promise;

  assert.equal(job.status, "completed");
  assert.equal(job.phase, "completed");
  assert.deepEqual(updates, [
    ["person@example.com", "capsule-1", {
      filters: createCapsuleWithWardrobe().draft.filters,
      data: {
        wardrobe: {
          items: [{ id: "top-1", category: "top" }],
          reasoning: "capsule-json",
          rawSelectionText: "capsule-raw",
          swimwearReasoning: null,
          swimwearRawSelectionText: null
        },
        rejectedUrls: []
      }
    }],
    ["person@example.com", "capsule-1", {
      filters: createCapsuleWithWardrobe().draft.filters,
      data: {
        wardrobe: {
          items: [
            { id: "top-1", category: "top" },
            { id: "swim-1", category: "swimwear" }
          ],
          reasoning: "capsule-json",
          rawSelectionText: "capsule-raw",
          swimwearReasoning: "swimwear-json",
          swimwearRawSelectionText: "swimwear-raw"
        },
        rejectedUrls: []
      }
    }]
  ]);
});

test("startWardrobeJob marks job failed when capsule generation returns no usable items", async () => {
  const service = createWardrobeService({
    generateCapsuleWardrobeImpl: async () => ({
      items: [],
      selectedItems: [],
      promptEmbeddings: []
    }),
    jobs: new Map()
  });

  const job = service.startWardrobeJob("person@example.com", "capsule-1", { audience: "woman", locale: "en" }, createCapsuleWithWardrobe(null));
  await job.promise;

  assert.equal(job.status, "failed");
  assert.equal(job.phase, "failed");
  assert.match(job.error.message, /no valid wardrobe items/i);
});
