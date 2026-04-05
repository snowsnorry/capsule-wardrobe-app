import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRegenerateSelectedPrompt,
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

function createProfile() {
  return {
    locale: "en",
    llm: "openai:gpt-5.2"
  };
}

function createCapsule() {
  return {
    id: "capsule-1",
    draft: {
      filters: {
        formalityLevel: "casual",
        style: "minimalistic",
        occasions: ["office"],
        season: ["summer"],
        audience: "woman",
        color: null,
        pattern: null,
        text: ""
      },
      data: {
        rejectedUrls: ["https://example.com/old-1"],
        wardrobe: {
          items: [
            { id: "top-1", url: "https://example.com/top-1", category: "top" },
            { id: "bottom-1", url: "https://example.com/bottom-1", category: "bottom" },
            { id: "bag-1", url: "https://example.com/bag-1", category: "bag" }
          ],
          reasoning: "capsule-json",
          rawSelectionText: "capsule-raw",
          swimwearReasoning: "swim-json",
          swimwearRawSelectionText: "swim-raw"
        }
      }
    }
  };
}

test("buildRegenerateSelectedPrompt includes optional additional information", () => {
  const prompt = buildRegenerateSelectedPrompt(
    {
      audience: "woman",
      occasions: ["office"],
      formalityLevel: "casual",
      style: "minimalistic",
      text: "Prefer natural fabrics"
    },
    [{ id: "top-1", name: "Top", category: "top" }],
    [{ id: "bottom-1", name: "Bottom", category: "bottom" }],
    { top: 1 }
  );

  assert.match(prompt, /Important Additional Information: Prefer natural fabrics/);
});

test("buildRegenerateSelectedPrompt omits additional information line when text is blank", () => {
  const prompt = buildRegenerateSelectedPrompt(
    {
      audience: "woman",
      occasions: ["office"],
      formalityLevel: "casual",
      style: "minimalistic",
      text: "   "
    },
    [{ id: "top-1", name: "Top", category: "top" }],
    [{ id: "bottom-1", name: "Bottom", category: "bottom" }],
    { top: 1 }
  );

  assert.doesNotMatch(prompt, /Important Additional Information:/);
});

test("regenerateSelectedWardrobeItems returns pending payload when job is already active", async () => {
  const jobs = new Map([
    ["person@example.com::capsule-1", {
      status: "pending",
      updatedAt: Date.now(),
      pendingItemUrls: ["https://example.com/top-1"]
    }]
  ]);
  const service = createPartialRegenerationService({
    getProfileImpl: async () => createProfile(),
    getCapsuleImpl: async () => createCapsule(),
    jobs
  });
  const res = createResponseRecorder();

  await service.regenerateSelectedWardrobeItems({
    user: { email: "person@example.com" },
    params: { id: "capsule-1" },
    body: { itemUrls: ["https://example.com/top-1"] }
  }, res);

  assert.equal(res.statusCode, 202);
  assert.equal(res.body.pendingStage, "regenerate");
  assert.deepEqual(res.body.pendingRegenerationUrls, ["https://example.com/top-1"]);
  assert.equal(res.body.reasoning, "capsule-json");
});

test("regenerateSelectedWardrobeItems returns ready payload and clears completed job", async () => {
  const jobs = new Map([
    ["person@example.com::capsule-1", {
      status: "completed",
      updatedAt: Date.now(),
      result: {
        items: [{ id: "new-1", url: "https://example.com/new-1", category: "top" }],
        reasoning: "new-reasoning",
        rawSelectionText: "new-raw",
        swimwearReasoning: "swim-json",
        swimwearRawSelectionText: "swim-raw"
      }
    }]
  ]);
  const service = createPartialRegenerationService({
    getProfileImpl: async () => createProfile(),
    getCapsuleImpl: async () => createCapsule(),
    jobs
  });
  const res = createResponseRecorder();

  await service.regenerateSelectedWardrobeItems({
    user: { email: "person@example.com" },
    params: { id: "capsule-1" },
    body: { itemUrls: ["https://example.com/top-1"] }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, "ready");
  assert.deepEqual(res.body.items, [{ id: "new-1", url: "https://example.com/new-1", category: "top" }]);
  assert.equal(jobs.has("person@example.com::capsule-1"), false);
});

test("regenerateSelectedWardrobeItems returns service_unavailable for failed job and clears it", async () => {
  const jobs = new Map([
    ["person@example.com::capsule-1", {
      status: "failed",
      updatedAt: Date.now(),
      error: new Error("partial failed")
    }]
  ]);
  const service = createPartialRegenerationService({
    getProfileImpl: async () => createProfile(),
    getCapsuleImpl: async () => createCapsule(),
    jobs
  });
  const res = createResponseRecorder();

  await service.regenerateSelectedWardrobeItems({
    user: { email: "person@example.com" },
    params: { id: "capsule-1" },
    body: { itemUrls: ["https://example.com/top-1"] }
  }, res);

  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, { error: "service_unavailable" });
  assert.equal(jobs.has("person@example.com::capsule-1"), false);
});

test("regenerateSelectedWardrobeItems validates selected urls and missing wardrobe", async () => {
  const invalidPayloadService = createPartialRegenerationService({
    getProfileImpl: async () => createProfile(),
    getCapsuleImpl: async () => createCapsule(),
    jobs: new Map()
  });
  const invalidPayloadRes = createResponseRecorder();
  await invalidPayloadService.regenerateSelectedWardrobeItems({
    user: { email: "person@example.com" },
    params: { id: "capsule-1" },
    body: { itemUrls: [] }
  }, invalidPayloadRes);
  assert.equal(invalidPayloadRes.statusCode, 400);
  assert.deepEqual(invalidPayloadRes.body, { error: "invalid_payload" });

  const noWardrobeService = createPartialRegenerationService({
    getProfileImpl: async () => createProfile(),
    getCapsuleImpl: async () => ({
      id: "capsule-1",
      draft: {
        filters: createCapsule().draft.filters,
        data: { wardrobe: null, rejectedUrls: [] }
      }
    }),
    jobs: new Map()
  });
  const noWardrobeRes = createResponseRecorder();
  await noWardrobeService.regenerateSelectedWardrobeItems({
    user: { email: "person@example.com" },
    params: { id: "capsule-1" },
    body: { itemUrls: ["https://example.com/top-1"] }
  }, noWardrobeRes);
  assert.equal(noWardrobeRes.statusCode, 404);
  assert.deepEqual(noWardrobeRes.body, { error: "not_found" });
});

test("regenerateSelectedWardrobeItems rejects unknown urls from request", async () => {
  const service = createPartialRegenerationService({
    getProfileImpl: async () => createProfile(),
    getCapsuleImpl: async () => createCapsule(),
    jobs: new Map()
  });
  const res = createResponseRecorder();

  await service.regenerateSelectedWardrobeItems({
    user: { email: "person@example.com" },
    params: { id: "capsule-1" },
    body: { itemUrls: ["https://example.com/missing-url"] }
  }, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: "invalid_payload" });
});

test("regenerateSelectedWardrobeItems updates rejected urls, shrinks partial payload, and starts pending job", async () => {
  const draftUpdates = [];
  let regeneratedProfile = null;
  let regeneratedSelectedProducts = null;
  const jobs = new Map();
  const service = createPartialRegenerationService({
    getProfileImpl: async () => createProfile(),
    getCapsuleImpl: async () => createCapsule(),
    updateCapsuleSnapshotImpl: async (email, capsuleId, draft) => {
      draftUpdates.push([email, capsuleId, draft]);
      return { id: capsuleId, draft, saved: null };
    },
    regenerateCapsuleWardrobeImpl: async (profile, selectedProducts) => {
      regeneratedProfile = profile;
      regeneratedSelectedProducts = selectedProducts;
      return {
        items: [
          { id: "bottom-1", url: "https://example.com/bottom-1", category: "bottom" },
          { id: "bag-1", url: "https://example.com/bag-1", category: "bag" },
          { id: "top-2", url: "https://example.com/top-2", category: "top" }
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
    params: { id: "capsule-1" },
    body: { itemUrls: ["https://example.com/top-1"] }
  }, res);

  assert.equal(res.statusCode, 202);
  assert.equal(res.body.pendingStage, "regenerate");
  assert.deepEqual(res.body.items, [
    { id: "bottom-1", url: "https://example.com/bottom-1", category: "bottom" },
    { id: "bag-1", url: "https://example.com/bag-1", category: "bag" }
  ]);
  assert.deepEqual(draftUpdates[0], [
    "person@example.com",
    "capsule-1",
    {
      filters: createCapsule().draft.filters,
      data: {
        wardrobe: {
          items: [
            { id: "bottom-1", url: "https://example.com/bottom-1", category: "bottom" },
            { id: "bag-1", url: "https://example.com/bag-1", category: "bag" }
          ],
          reasoning: "capsule-json",
          rawSelectionText: "capsule-raw",
          swimwearReasoning: "swim-json",
          swimwearRawSelectionText: "swim-raw"
        },
        rejectedUrls: ["https://example.com/old-1", "https://example.com/top-1"]
      }
    }
  ]);

  const job = service.getPartialRegenerationJob("person@example.com", "capsule-1");
  assert.ok(job);
  await job.promise;

  assert.deepEqual(regeneratedSelectedProducts, [{ id: "top-1", url: "https://example.com/top-1", category: "top" }]);
  assert.equal(regeneratedProfile.rejected.includes("https://example.com/top-1"), true);
  assert.deepEqual(draftUpdates[1], [
    "person@example.com",
    "capsule-1",
    {
      filters: createCapsule().draft.filters,
      data: {
        wardrobe: {
          items: [
            { id: "bottom-1", url: "https://example.com/bottom-1", category: "bottom" },
            { id: "bag-1", url: "https://example.com/bag-1", category: "bag" },
            { id: "top-2", url: "https://example.com/top-2", category: "top" }
          ],
          reasoning: "regen-json",
          rawSelectionText: "regen-raw",
          swimwearReasoning: "swim-json",
          swimwearRawSelectionText: "swim-raw"
        },
        rejectedUrls: ["https://example.com/old-1", "https://example.com/top-1"]
      }
    }
  ]);
});

test("regenerateSelectedWardrobeItems uses profile llm=none instead of query flag", async () => {
  let regeneratedProfile = null;
  const service = createPartialRegenerationService({
    getProfileImpl: async () => ({ ...createProfile(), llm: "none" }),
    getCapsuleImpl: async () => createCapsule(),
    updateCapsuleSnapshotImpl: async (_email, capsuleId, draft) => ({ id: capsuleId, draft, saved: null }),
    regenerateCapsuleWardrobeImpl: async (profile) => {
      regeneratedProfile = profile;
      return {
        items: [
          { id: "bottom-1", url: "https://example.com/bottom-1", category: "bottom" },
          { id: "bag-1", url: "https://example.com/bag-1", category: "bag" },
          { id: "top-2", url: "https://example.com/top-2", category: "top" }
        ],
        reasoning: null,
        rawSelectionText: null
      };
    },
    jobs: new Map(),
    randomUuidImpl: () => "regen-req-no-llm"
  });
  const res = createResponseRecorder();

  await service.regenerateSelectedWardrobeItems({
    user: { email: "person@example.com" },
    params: { id: "capsule-1" },
    body: { itemUrls: ["https://example.com/top-1"] }
  }, res);

  const job = service.getPartialRegenerationJob("person@example.com", "capsule-1");
  assert.ok(job);
  await job.promise;
  assert.equal(regeneratedProfile.llm, "none");
});

test("startPartialRegenerationJob reuses active pending job and marks failures", async () => {
  let resolveRegen;
  const pending = new Promise((resolve) => {
    resolveRegen = resolve;
  });
  const service = createPartialRegenerationService({
    regenerateCapsuleWardrobeImpl: async () => pending,
    updateCapsuleSnapshotImpl: async () => {},
    jobs: new Map()
  });

  const first = service.startPartialRegenerationJob(
    "person@example.com",
    "capsule-1",
    createProfile(),
    createCapsule(),
    [{ id: "top-1", category: "top" }],
    getStoredProfilePayload()
  );
  const second = service.startPartialRegenerationJob(
    "person@example.com",
    "capsule-1",
    createProfile(),
    createCapsule(),
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
    "capsule-1",
    createProfile(),
    createCapsule(),
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
