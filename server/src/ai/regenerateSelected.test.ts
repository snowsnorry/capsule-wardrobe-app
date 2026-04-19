import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRegenerateSelectedPrompt,
  createPartialRegenerationService,
  getPartialRegenerationJob
} from "./regenerateSelected.js";
import {
  buildCapsuleSnapshot,
  buildNormalizedCapsuleRecord,
  buildNormalizedProfileRecord,
  buildPartialRegenerationJobState,
  buildStoredOutfitSet,
  buildStoredWardrobePayload,
  buildWardrobeGenerationResult,
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

function createProfile() {
  return buildNormalizedProfileRecord({
    locale: "en",
    llm: "openai:gpt-5.2"
  });
}

function createCapsule() {
  return buildNormalizedCapsuleRecord({
    draft: buildCapsuleSnapshot({
      filters: {
        season: ["summer"]
      },
      data: {
        rejectedUrls: ["https://example.com/old-1"],
        wardrobe: getStoredProfilePayload()
      }
    })
  });
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
    ["person@example.com::capsule-1", buildPartialRegenerationJobState({
      updatedAt: Date.now(),
      pendingItemUrls: ["https://example.com/top-1"]
    })]
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
  assert.deepEqual(res.body, {
    ok: true,
    status: "pending",
    pendingStage: "regenerate"
  });
});

test("regenerateSelectedWardrobeItems clears completed job and starts a fresh pending regeneration", async () => {
  const jobs = new Map([
    ["person@example.com::capsule-1", buildPartialRegenerationJobState({
      status: "completed",
      phase: "completed",
      updatedAt: Date.now(),
      result: buildStoredWardrobePayload({
        items: [buildWardrobeUiItem({ id: "new-1", url: "https://example.com/new-1", category: "top" })],
        outfitSets: [buildStoredOutfitSet({ itemIds: ["new-1", "new-1", "new-1"], imageObsolete: false })],
        reasoning: "new-reasoning",
        rawSelectionText: "new-raw",
        swimwearReasoning: "swim-json",
        swimwearRawSelectionText: "swim-raw"
      })
    })]
  ]);
  const service = createPartialRegenerationService({
    getProfileImpl: async () => createProfile(),
    getCapsuleImpl: async () => createCapsule(),
    updateCapsuleSnapshotImpl: async (_email, capsuleId, draft) => buildNormalizedCapsuleRecord({ id: capsuleId, draft, saved: null }),
    regenerateCapsuleWardrobeImpl: async () => buildWardrobeGenerationResult({
      items: [
        buildWardrobeUiItem({ id: "bottom-1", url: "https://example.com/bottom-1", category: "bottom" }),
        buildWardrobeUiItem({ id: "bag-1", url: "https://example.com/bag-1", category: "bag" }),
        buildWardrobeUiItem({ id: "top-2", url: "https://example.com/top-2", category: "top" })
      ],
      reasoning: "regen-json",
      rawSelectionText: "regen-raw"
    }),
    jobs
  });
  const res = createResponseRecorder();

  await service.regenerateSelectedWardrobeItems({
    user: { email: "person@example.com" },
    params: { id: "capsule-1" },
    body: { itemUrls: ["https://example.com/top-1"] }
  }, res);

  assert.equal(res.statusCode, 202);
  assert.deepEqual(res.body, {
    ok: true,
    status: "pending",
    pendingStage: "regenerate"
  });
  assert.equal(jobs.has("person@example.com::capsule-1"), true);

  const job = service.getPartialRegenerationJob("person@example.com", "capsule-1");
  assert.ok(job);
  await job.promise;
  assert.deepEqual(job.result.outfitSets, [{ itemIds: ["top-2", "bottom-1", "bag-1"], image: "set-image", imageObsolete: true }]);
});

test("regenerateSelectedWardrobeItems returns service_unavailable for failed job and clears it", async () => {
  const jobs = new Map([
    ["person@example.com::capsule-1", buildPartialRegenerationJobState({
      status: "failed",
      phase: "failed",
      updatedAt: Date.now(),
      error: new Error("partial failed")
    })]
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
    getCapsuleImpl: async () => buildNormalizedCapsuleRecord({
      id: "capsule-1",
      draft: buildCapsuleSnapshot({
        filters: createCapsule().draft?.filters,
        data: { wardrobe: null, rejectedUrls: [] }
      })
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
      return buildNormalizedCapsuleRecord({ id: capsuleId, draft, saved: null });
    },
    regenerateCapsuleWardrobeImpl: async (profile, selectedProducts) => {
      regeneratedProfile = profile;
      regeneratedSelectedProducts = selectedProducts;
      return buildWardrobeGenerationResult({
        items: [
          buildWardrobeUiItem({ id: "bottom-1", url: "https://example.com/bottom-1", category: "bottom" }),
          buildWardrobeUiItem({ id: "bag-1", url: "https://example.com/bag-1", category: "bag" }),
          buildWardrobeUiItem({ id: "top-2", url: "https://example.com/top-2", category: "top" })
        ],
        outfitSets: [{ itemIds: ["bottom-1", "top-2", "bag-1"] }],
        reasoning: "regen-json",
        rawSelectionText: "regen-raw"
      });
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
  assert.deepEqual(res.body, {
    ok: true,
    status: "pending",
    pendingStage: "regenerate"
  });
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
          outfitSets: [{ itemIds: ["top-1", "bottom-1", "bag-1"], image: "set-image", imageObsolete: false }],
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
          outfitSets: [{ itemIds: ["top-2", "bottom-1", "bag-1"], image: "set-image", imageObsolete: true }],
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
    updateCapsuleSnapshotImpl: async (_email, capsuleId, draft) => buildNormalizedCapsuleRecord({ id: capsuleId, draft, saved: null }),
    regenerateCapsuleWardrobeImpl: async (profile) => {
      regeneratedProfile = profile;
      return buildWardrobeGenerationResult({
        items: [
          buildWardrobeUiItem({ id: "bottom-1", url: "https://example.com/bottom-1", category: "bottom" }),
          buildWardrobeUiItem({ id: "bag-1", url: "https://example.com/bag-1", category: "bag" }),
          buildWardrobeUiItem({ id: "top-2", url: "https://example.com/top-2", category: "top" })
        ]
      });
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
  const pending = new Promise<ReturnType<typeof buildWardrobeGenerationResult>>((resolve) => {
    resolveRegen = resolve;
  });
  const service = createPartialRegenerationService({
    regenerateCapsuleWardrobeImpl: async () => pending,
    updateCapsuleSnapshotImpl: async (_email, capsuleId, draft) => buildNormalizedCapsuleRecord({ id: capsuleId, draft, saved: null }),
    jobs: new Map()
  });

  const first = service.startPartialRegenerationJob(
    "person@example.com",
    "capsule-1",
    createProfile(),
    createCapsule(),
    [{ id: "top-1", url: "https://example.com/top-1", category: "top" }],
    getStoredProfilePayload()
  );
  const second = service.startPartialRegenerationJob(
    "person@example.com",
    "capsule-1",
    createProfile(),
    createCapsule(),
    [{ id: "top-1", url: "https://example.com/top-1", category: "top" }],
    getStoredProfilePayload()
  );
  assert.equal(first, second);

  resolveRegen(buildWardrobeGenerationResult({
    items: [buildWardrobeUiItem({ id: "bottom-1", category: "bottom", url: undefined, name: undefined, image_url: undefined, audience: undefined })],
    reasoning: "regen-json",
    rawSelectionText: "regen-raw"
  }));
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
    [{ id: "top-1", url: "https://example.com/top-1", category: "top" }],
    getStoredProfilePayload()
  );
  await failed.promise;

  assert.equal(failed.status, "failed");
  assert.equal(failed.phase, "failed");
});

test("startPartialRegenerationJob stores recomputed outfit sets in the completed payload", async () => {
  const updates = [];
  const service = createPartialRegenerationService({
    updateCapsuleSnapshotImpl: async (email, capsuleId, draft) => {
      updates.push([email, capsuleId, draft]);
      return buildNormalizedCapsuleRecord({ id: capsuleId, draft, saved: null });
    },
    regenerateCapsuleWardrobeImpl: async () => buildWardrobeGenerationResult({
      items: [
        buildWardrobeUiItem({ id: "bottom-1", url: "https://example.com/bottom-1", category: "bottom" }),
        buildWardrobeUiItem({ id: "bag-1", url: "https://example.com/bag-1", category: "bag" }),
        buildWardrobeUiItem({ id: "top-2", url: "https://example.com/top-2", category: "top" })
      ],
      outfitSets: [{ itemIds: ["bottom-1", "top-2", "bag-1"] }],
      reasoning: "regen-json",
      rawSelectionText: "regen-raw"
    }),
    jobs: new Map()
  });

  const job = service.startPartialRegenerationJob(
    "person@example.com",
    "capsule-1",
    createProfile(),
    createCapsule(),
    [{ id: "top-1", url: "https://example.com/top-1", category: "top" }],
    getStoredProfilePayload()
  );
  await job.promise;

  assert.equal(job.status, "completed");
  assert.deepEqual(job.result.outfitSets, [{ itemIds: ["top-2", "bottom-1", "bag-1"], image: "set-image", imageObsolete: true }]);
  assert.deepEqual(updates[0][2].data.wardrobe.outfitSets, [{ itemIds: ["top-2", "bottom-1", "bag-1"], image: "set-image", imageObsolete: true }]);
});

function getStoredProfilePayload() {
  return buildStoredWardrobePayload({
    items: [
      buildWardrobeUiItem({ id: "top-1", url: "https://example.com/top-1", category: "top" }),
      buildWardrobeUiItem({ id: "bottom-1", url: "https://example.com/bottom-1", category: "bottom" }),
      buildWardrobeUiItem({ id: "bag-1", url: "https://example.com/bag-1", category: "bag" })
    ],
    outfitSets: [buildStoredOutfitSet({ itemIds: ["top-1", "bottom-1", "bag-1"], image: "set-image", imageObsolete: false })],
    reasoning: "capsule-json",
    rawSelectionText: "capsule-raw",
    swimwearReasoning: "swim-json",
    swimwearRawSelectionText: "swim-raw"
  });
}

test("startPartialRegenerationJob preserves unchanged set images without marking them obsolete", async () => {
  const service = createPartialRegenerationService({
    updateCapsuleSnapshotImpl: async (_email, capsuleId, draft) => buildNormalizedCapsuleRecord({ id: capsuleId, draft, saved: null }),
    regenerateCapsuleWardrobeImpl: async () => buildWardrobeGenerationResult({
      items: [
        buildWardrobeUiItem({ id: "top-1", url: "https://example.com/top-1", category: "top" }),
        buildWardrobeUiItem({ id: "bottom-2", url: "https://example.com/bottom-2", category: "bottom" }),
        buildWardrobeUiItem({ id: "bag-1", url: "https://example.com/bag-1", category: "bag" })
      ],
      reasoning: "regen-json",
      rawSelectionText: "regen-raw"
    }),
    jobs: new Map()
  });

  const capsule = createCapsule();
  capsule.draft.data.wardrobe.outfitSets = [
    { itemIds: ["top-1", "bottom-1", "bag-1"], image: "set-image", imageObsolete: false },
    { itemIds: ["top-1", "bag-1", "bag-1"], image: "stable-image", imageObsolete: false }
  ];
  const storedWardrobe = {
    ...getStoredProfilePayload(),
    items: [
      { id: "top-1", url: "https://example.com/top-1", category: "top" },
      { id: "bottom-1", url: "https://example.com/bottom-1", category: "bottom" },
      { id: "bag-1", url: "https://example.com/bag-1", category: "bag" }
    ],
    outfitSets: capsule.draft.data.wardrobe.outfitSets
  };

  const job = service.startPartialRegenerationJob(
    "person@example.com",
    "capsule-1",
    createProfile(),
    capsule,
    [{ id: "bottom-1", url: "https://example.com/bottom-1", category: "bottom" }],
    storedWardrobe
  );
  await job.promise;

  assert.deepEqual(job.result.outfitSets, [
    { itemIds: ["top-1", "bottom-2", "bag-1"], image: "set-image", imageObsolete: true },
    { itemIds: ["top-1", "bag-1", "bag-1"], image: "stable-image", imageObsolete: false }
  ]);
});

test("module-level getPartialRegenerationJob returns null for unknown email", () => {
  assert.equal(getPartialRegenerationJob("missing@example.com", "capsule-1"), null);
});
