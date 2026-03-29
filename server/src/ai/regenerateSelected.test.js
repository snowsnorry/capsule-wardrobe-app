import test from "node:test";
import assert from "node:assert/strict";
import {
  createPartialRegenerationService,
  getPartialRegenerationJob
} from "./regenerateSelected.js";

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

function createStoredProfile() {
  return {
    audience: "woman",
    season: ["summer"],
    rejected: ["old-1"],
    items: {
      items: [
        { id: "top-1", category: "top" },
        { id: "bottom-1", category: "bottom" },
        { id: "bag-1", category: "bag" }
      ],
      reasoning: "capsule-json",
      rawSelectionText: "capsule-raw",
      swimwearReasoning: "swim-json",
      swimwearRawSelectionText: "swim-raw"
    }
  };
}

test("regenerateSelectedWardrobeItems returns pending payload when job is already active", async () => {
  const jobs = new Map([
    ["person@example.com", {
      status: "pending",
      updatedAt: Date.now(),
      pendingItemIds: ["top-1"]
    }]
  ]);
  const service = createPartialRegenerationService({
    getProfileImpl: async () => createStoredProfile(),
    jobs
  });
  const res = createResponseRecorder();

  await service.regenerateSelectedWardrobeItems({
    user: { email: "person@example.com" },
    body: { itemIds: ["top-1"] }
  }, res);

  assert.equal(res.statusCode, 202);
  assert.equal(res.body.pendingStage, "regenerate");
  assert.deepEqual(res.body.pendingRegenerationIds, ["top-1"]);
  assert.equal(res.body.reasoning, "capsule-json");
});

test("regenerateSelectedWardrobeItems returns ready payload and clears completed job", async () => {
  const jobs = new Map([
    ["person@example.com", {
      status: "completed",
      updatedAt: Date.now(),
      result: {
        items: [{ id: "new-1", category: "top" }],
        reasoning: "new-reasoning",
        rawSelectionText: "new-raw",
        swimwearReasoning: "swim-json",
        swimwearRawSelectionText: "swim-raw"
      }
    }]
  ]);
  const service = createPartialRegenerationService({
    getProfileImpl: async () => createStoredProfile(),
    jobs
  });
  const res = createResponseRecorder();

  await service.regenerateSelectedWardrobeItems({
    user: { email: "person@example.com" },
    body: { itemIds: ["top-1"] }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, "ready");
  assert.deepEqual(res.body.items, [{ id: "new-1", category: "top" }]);
  assert.equal(jobs.has("person@example.com"), false);
});

test("regenerateSelectedWardrobeItems returns service_unavailable for failed job and clears it", async () => {
  const jobs = new Map([
    ["person@example.com", {
      status: "failed",
      updatedAt: Date.now(),
      error: new Error("partial failed")
    }]
  ]);
  const service = createPartialRegenerationService({
    getProfileImpl: async () => createStoredProfile(),
    jobs
  });
  const res = createResponseRecorder();

  await service.regenerateSelectedWardrobeItems({
    user: { email: "person@example.com" },
    body: { itemIds: ["top-1"] }
  }, res);

  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, { error: "service_unavailable" });
  assert.equal(jobs.has("person@example.com"), false);
});

test("regenerateSelectedWardrobeItems validates selected ids and missing wardrobe", async () => {
  const invalidPayloadService = createPartialRegenerationService({
    getProfileImpl: async () => createStoredProfile(),
    jobs: new Map()
  });
  const invalidPayloadRes = createResponseRecorder();
  await invalidPayloadService.regenerateSelectedWardrobeItems({
    user: { email: "person@example.com" },
    body: { itemIds: [] }
  }, invalidPayloadRes);
  assert.equal(invalidPayloadRes.statusCode, 400);
  assert.deepEqual(invalidPayloadRes.body, { error: "invalid_payload" });

  const noWardrobeService = createPartialRegenerationService({
    getProfileImpl: async () => ({ items: null }),
    jobs: new Map()
  });
  const noWardrobeRes = createResponseRecorder();
  await noWardrobeService.regenerateSelectedWardrobeItems({
    user: { email: "person@example.com" },
    body: { itemIds: ["top-1"] }
  }, noWardrobeRes);
  assert.equal(noWardrobeRes.statusCode, 404);
  assert.deepEqual(noWardrobeRes.body, { error: "not_found" });
});

test("regenerateSelectedWardrobeItems rejects unknown ids from request", async () => {
  const service = createPartialRegenerationService({
    getProfileImpl: async () => createStoredProfile(),
    jobs: new Map()
  });
  const res = createResponseRecorder();

  await service.regenerateSelectedWardrobeItems({
    user: { email: "person@example.com" },
    body: { itemIds: ["missing-id"] }
  }, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: "invalid_payload" });
});

test("regenerateSelectedWardrobeItems updates rejected ids, shrinks partial payload, and starts pending job", async () => {
  const rejectedUpdates = [];
  const itemUpdates = [];
  let regeneratedProfile = null;
  let regeneratedSelectedProducts = null;
  const jobs = new Map();
  const service = createPartialRegenerationService({
    getProfileImpl: async () => createStoredProfile(),
    updateProfileRejectedImpl: async (email, ids) => {
      rejectedUpdates.push([email, ids]);
    },
    updateProfileItemsImpl: async (email, payload) => {
      itemUpdates.push([email, payload]);
    },
    regenerateCapsuleWardrobeImpl: async (profile, selectedProducts) => {
      regeneratedProfile = profile;
      regeneratedSelectedProducts = selectedProducts;
      return {
        items: [
          { id: "bottom-1", category: "bottom" },
          { id: "bag-1", category: "bag" },
          { id: "top-2", category: "top" }
        ],
        reasoning: "regen-json",
        rawSelectionText: "regen-raw"
      };
    },
    jobs,
    randomUuidImpl: () => "regen-req-1"
  });
  const res = createResponseRecorder();

  await service.regenerateSelectedWardrobeItems({
    user: { email: "person@example.com" },
    body: { itemIds: ["top-1"] }
  }, res);

  assert.equal(res.statusCode, 202);
  assert.equal(res.body.pendingStage, "regenerate");
  assert.deepEqual(res.body.items, [
    { id: "bottom-1", category: "bottom" },
    { id: "bag-1", category: "bag" }
  ]);
  assert.deepEqual(rejectedUpdates, [[
    "person@example.com",
    ["old-1", "top-1"]
  ]]);
  assert.deepEqual(itemUpdates[0], [
    "person@example.com",
    {
      items: [
        { id: "bottom-1", category: "bottom" },
        { id: "bag-1", category: "bag" }
      ],
      reasoning: "capsule-json",
      rawSelectionText: "capsule-raw",
      swimwearReasoning: "swim-json",
      swimwearRawSelectionText: "swim-raw"
    }
  ]);

  const job = service.getPartialRegenerationJob("person@example.com");
  assert.ok(job);
  await job.promise;

  assert.deepEqual(regeneratedSelectedProducts, [{ id: "top-1", category: "top" }]);
  assert.equal(regeneratedProfile.rejected.includes("top-1"), true);
  assert.deepEqual(itemUpdates[1], [
    "person@example.com",
    {
      items: [
        { id: "bottom-1", category: "bottom" },
        { id: "bag-1", category: "bag" },
        { id: "top-2", category: "top" }
      ],
      reasoning: "regen-json",
      rawSelectionText: "regen-raw",
      swimwearReasoning: "swim-json",
      swimwearRawSelectionText: "swim-raw"
    }
  ]);
});

test("startPartialRegenerationJob reuses active pending job and marks failures", async () => {
  let resolveRegen;
  const pending = new Promise((resolve) => {
    resolveRegen = resolve;
  });
  const service = createPartialRegenerationService({
    regenerateCapsuleWardrobeImpl: async () => pending,
    updateProfileItemsImpl: async () => {},
    jobs: new Map()
  });

  const first = service.startPartialRegenerationJob(
    "person@example.com",
    createStoredProfile(),
    [{ id: "top-1", category: "top" }],
    getStoredProfilePayload()
  );
  const second = service.startPartialRegenerationJob(
    "person@example.com",
    createStoredProfile(),
    [{ id: "top-1", category: "top" }],
    getStoredProfilePayload()
  );
  assert.equal(first, second);

  resolveRegen({
    items: [{ id: "bottom-1", category: "bottom" }],
    reasoning: "regen-json",
    rawSelectionText: "regen-raw"
  });
  await first.promise;

  const failingService = createPartialRegenerationService({
    regenerateCapsuleWardrobeImpl: async () => {
      throw new Error("regen_failed");
    },
    jobs: new Map()
  });
  const failed = failingService.startPartialRegenerationJob(
    "person@example.com",
    createStoredProfile(),
    [{ id: "top-1", category: "top" }],
    getStoredProfilePayload()
  );
  await failed.promise;

  assert.equal(failed.status, "failed");
  assert.equal(failed.phase, "failed");
});

function getStoredProfilePayload() {
  return {
    items: [
      { id: "top-1", category: "top" },
      { id: "bottom-1", category: "bottom" },
      { id: "bag-1", category: "bag" }
    ],
    reasoning: "capsule-json",
    rawSelectionText: "capsule-raw",
    swimwearReasoning: "swim-json",
    swimwearRawSelectionText: "swim-raw"
  };
}

test("module-level getPartialRegenerationJob returns null for unknown email", () => {
  assert.equal(getPartialRegenerationJob("missing@example.com"), null);
});
