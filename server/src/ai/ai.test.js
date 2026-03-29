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

test("getWardrobeItems returns pending regenerate payload when partial regeneration job is active", async () => {
  const service = createWardrobeService({
    getProfileImpl: async () => ({
      items: {
        items: [{ id: "top-1", category: "top" }],
        reasoning: "capsule",
        rawSelectionText: "raw"
      }
    }),
    getPartialRegenerationJobImpl: () => ({
      status: "pending",
      pendingItemIds: ["top-1"]
    }),
    jobs: new Map()
  });
  const res = createResponseRecorder();

  await service.getWardrobeItems({
    user: { email: "person@example.com" },
    body: {}
  }, res);

  assert.equal(res.statusCode, 202);
  assert.equal(res.body.pendingStage, "regenerate");
  assert.deepEqual(res.body.pendingRegenerationIds, ["top-1"]);
  assert.deepEqual(res.body.items, [{ id: "top-1", category: "top" }]);
});

test("getWardrobeItems returns ready payload from stored wardrobe when no refresh is requested", async () => {
  const service = createWardrobeService({
    getProfileImpl: async () => ({
      items: {
        items: [{ id: "top-1", category: "top" }],
        reasoning: "capsule-json",
        rawSelectionText: "raw-selection",
        swimwearReasoning: "swimwear-json"
      }
    }),
    jobs: new Map()
  });
  const res = createResponseRecorder();

  await service.getWardrobeItems({
    user: { email: "person@example.com" },
    body: { force: false }
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

test("getWardrobeItems returns extras pending state when extras are still generating", async () => {
  const jobs = new Map([
    ["person@example.com", {
      status: "pending",
      phase: "extras",
      updatedAt: Date.now()
    }]
  ]);
  const service = createWardrobeService({
    getProfileImpl: async () => ({
      items: {
        items: [{ id: "top-1", category: "top" }],
        reasoning: "capsule-json",
        rawSelectionText: "raw-selection",
        swimwearReasoning: "swimwear-json"
      }
    }),
    jobs
  });
  const res = createResponseRecorder();

  await service.getWardrobeItems({
    user: { email: "person@example.com" },
    body: {}
  }, res);

  assert.equal(res.statusCode, 202);
  assert.equal(res.body.pendingStage, "extras");
  assert.equal(res.body.hasPendingAdditionalItems, true);
  assert.deepEqual(res.body.items, [{ id: "top-1", category: "top" }]);
});

test("getWardrobeItems starts a new pending job and clears stored items on force refresh", async () => {
  const updates = [];
  let generatedProfile = null;
  const jobs = new Map();
  const service = createWardrobeService({
    getProfileImpl: async () => ({
      audience: "woman",
      items: {
        items: [{ id: "top-1", category: "top" }]
      }
    }),
    updateProfileItemsImpl: async (email, payload) => {
      updates.push([email, payload]);
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

  await service.getWardrobeItems({
    user: { email: "person@example.com" },
    body: { force: true }
  }, res);

  assert.equal(res.statusCode, 202);
  assert.equal(res.body.pendingStage, "capsule");
  assert.deepEqual(updates[0], ["person@example.com", null]);

  const job = service.getWardrobeJob("person@example.com");
  assert.ok(job);
  await job.promise;

  assert.deepEqual(generatedProfile.items, null);
  assert.equal(job.status, "completed");
  assert.deepEqual(updates[1], ["person@example.com", {
    items: [{ id: "top-2", category: "top" }],
    reasoning: "reasoning",
    rawSelectionText: "raw",
    swimwearReasoning: null,
    swimwearRawSelectionText: null
  }]);
});

test("getWardrobeItems surfaces failed job as service_unavailable and drops stale failed entry", async () => {
  const jobs = new Map([
    ["person@example.com", {
      status: "failed",
      phase: "failed",
      updatedAt: Date.now(),
      error: Object.assign(new Error("failed"), { rawSelectionText: "llm raw" })
    }]
  ]);
  const service = createWardrobeService({
    getProfileImpl: async () => ({ items: null }),
    jobs
  });
  const res = createResponseRecorder();

  await service.getWardrobeItems({
    user: { email: "person@example.com" },
    body: {}
  }, res);

  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, {
    error: "service_unavailable",
    rawSelectionText: "llm raw"
  });
  assert.equal(jobs.has("person@example.com"), false);
});

test("startWardrobeJob reuses active pending job for the same email", async () => {
  let resolveGeneration;
  const pendingGeneration = new Promise((resolve) => {
    resolveGeneration = resolve;
  });
  const service = createWardrobeService({
    generateCapsuleWardrobeImpl: async () => pendingGeneration,
    updateProfileItemsImpl: async () => {},
    jobs: new Map()
  });

  const first = service.startWardrobeJob("person@example.com", { audience: "woman" });
  const second = service.startWardrobeJob("person@example.com", { audience: "woman" });

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
    updateProfileItemsImpl: async (email, payload) => {
      updates.push([email, payload]);
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

  const job = service.startWardrobeJob("person@example.com", {
    audience: "woman",
    season: ["summer"]
  });
  await job.promise;

  assert.equal(job.status, "completed");
  assert.equal(job.phase, "completed");
  assert.deepEqual(updates, [
    ["person@example.com", {
      items: [{ id: "top-1", category: "top" }],
      reasoning: "capsule-json",
      rawSelectionText: "capsule-raw",
      swimwearReasoning: null,
      swimwearRawSelectionText: null
    }],
    ["person@example.com", {
      items: [
        { id: "top-1", category: "top" },
        { id: "swim-1", category: "swimwear" }
      ],
      reasoning: "capsule-json",
      rawSelectionText: "capsule-raw",
      swimwearReasoning: "swimwear-json",
      swimwearRawSelectionText: "swimwear-raw"
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

  const job = service.startWardrobeJob("person@example.com", { audience: "woman" });
  await job.promise;

  assert.equal(job.status, "failed");
  assert.equal(job.phase, "failed");
  assert.match(job.error.message, /no valid wardrobe items/i);
});
