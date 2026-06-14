import { test, expect, vi } from "vitest";
import { createOutfitImageService } from "./outfitImages.js";
import { normalizeOutfitRecord } from "../outfitStoreModel.js";
import { buildNormalizedProfileRecord } from "../test/domainFixtures.js";

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
    },
  };
}

const defaultOutfitItemRefs = [
  { url: "https://example.com/top", source: "from_catalog" as const },
  { url: "https://example.com/bottom", source: "from_catalog" as const },
  { url: "https://example.com/bag", source: "from_catalog" as const },
];

function createOutfit(
  image: string | null = null,
  items = defaultOutfitItemRefs,
) {
  return normalizeOutfitRecord({
    id: "outfit-1",
    name: "Weekend",
    draft: {
      items,
      image,
      imageObsolete: Boolean(image),
    },
    saved: null,
  })!;
}

const outfitItems = [
  { id: "top-1", category: "top", imageUrl: "https://example.com/top.jpg" },
  {
    id: "bottom-1",
    category: "bottom",
    imageUrl: "https://example.com/bottom.jpg",
  },
  { id: "bag-1", category: "bag", imageUrl: "https://example.com/bag.jpg" },
];

test("outfit image service starts job and persists generated image", async () => {
  const updates: unknown[] = [];
  const published: unknown[] = [];
  const service = createOutfitImageService({
    getOutfitImpl: async () => createOutfit(),
    getOutfitItemsImpl: async () => outfitItems,
    getProfileImpl: async () =>
      buildNormalizedProfileRecord({ imageLlm: "openai:gpt-image-2" }),
    downloadProductImageAssetsImpl: async () => ({}),
    generateImageWithOpenAiImpl: async () => ({
      response: {} as never,
      image: {
        base64: Buffer.from("image").toString("base64"),
        mimeType: "image/png",
      },
    }),
    uploadImageToR2Impl: async () => ({
      key: "outfits/outfit-1.png",
      url: "https://images.example.com/outfit-1.png",
      digest: "digest",
    }),
    updateOutfitSnapshotImpl: async (_email, _outfitId, draft) => {
      updates.push(draft);
      return normalizeOutfitRecord({ ...createOutfit(), draft })!;
    },
    publishSnapshotImpl: (_email, _outfitId, snapshot) => {
      published.push(snapshot);
    },
  });
  const res = createResponseRecorder();

  await service.generateOutfitImage(
    {
      user: { email: "person@example.com" },
      params: { id: "outfit-1" },
    },
    res,
  );
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(res.statusCode).toBe(202);
  expect(res.body).toEqual({ ok: true, status: "pending" });
  expect(updates[0]).toMatchObject({
    image: "https://images.example.com/outfit-1.png",
    imageObsolete: false,
  });
  expect(published).toHaveLength(2);
});

test("outfit image service preserves newer item edits when a pending job completes", async () => {
  const updates: unknown[] = [];
  const changedItems = [
    ...defaultOutfitItemRefs.slice(0, 2),
    { url: "https://example.com/hat", source: "from_catalog" as const },
  ];
  let getOutfitCallCount = 0;
  const service = createOutfitImageService({
    getOutfitImpl: async () =>
      getOutfitCallCount++ === 0
        ? createOutfit()
        : createOutfit(null, changedItems),
    getOutfitItemsImpl: async () => outfitItems,
    getProfileImpl: async () =>
      buildNormalizedProfileRecord({ imageLlm: "openai:gpt-image-2" }),
    downloadProductImageAssetsImpl: async () => ({}),
    generateImageWithOpenAiImpl: async () => ({
      response: {} as never,
      image: {
        base64: Buffer.from("image").toString("base64"),
        mimeType: "image/png",
      },
    }),
    uploadImageToR2Impl: async () => ({
      key: "outfits/outfit-1.png",
      url: "https://images.example.com/outfit-1.png",
      digest: "digest",
    }),
    updateOutfitSnapshotImpl: async (_email, _outfitId, draft) => {
      updates.push(draft);
      return normalizeOutfitRecord({ ...createOutfit(), draft })!;
    },
    publishSnapshotImpl: () => undefined,
  });
  const res = createResponseRecorder();

  await service.generateOutfitImage(
    {
      user: { email: "person@example.com" },
      params: { id: "outfit-1" },
    },
    res,
  );
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(updates[0]).toMatchObject({
    items: changedItems,
    image: "https://images.example.com/outfit-1.png",
    imageObsolete: true,
  });
});

test("outfit image service treats existing images as ready and deletes images", async () => {
  const updates: unknown[] = [];
  const service = createOutfitImageService({
    getOutfitImpl: async () =>
      createOutfit("https://images.example.com/old.png"),
    updateOutfitSnapshotImpl: async (_email, _outfitId, draft) => {
      updates.push(draft);
      return normalizeOutfitRecord({ ...createOutfit(), draft })!;
    },
    publishSnapshotImpl: () => undefined,
  });
  const generateRes = createResponseRecorder();
  const deleteRes = createResponseRecorder();

  await service.generateOutfitImage(
    {
      user: { email: "person@example.com" },
      params: { id: "outfit-1" },
    },
    generateRes,
  );
  await service.deleteOutfitImage(
    {
      user: { email: "person@example.com" },
      params: { id: "outfit-1" },
    },
    deleteRes,
  );

  expect(generateRes.body).toEqual({ ok: true, status: "ready" });
  expect(deleteRes.body).toEqual({ ok: true, status: "ready" });
  expect(updates[0]).toMatchObject({ image: null, imageObsolete: false });
});

test("outfit image service rejects invalid and missing image requests", async () => {
  const service = createOutfitImageService({
    getOutfitImpl: async () => null,
  });
  const invalidRes = createResponseRecorder();
  const missingRes = createResponseRecorder();

  await service.generateOutfitImage(
    { user: { email: "person@example.com" }, params: { id: "" } },
    invalidRes,
  );
  await service.deleteOutfitImage(
    { user: { email: "person@example.com" }, params: { id: "missing" } },
    missingRes,
  );

  expect(invalidRes.statusCode).toBe(400);
  expect(invalidRes.body).toEqual({ error: "invalid_payload" });
  expect(missingRes.statusCode).toBe(404);
  expect(missingRes.body).toEqual({ error: "not_found" });
});

test("outfit image service rejects outfits with too few hydrated items", async () => {
  const service = createOutfitImageService({
    getOutfitImpl: async () => createOutfit(),
    getOutfitItemsImpl: async () => outfitItems.slice(0, 2),
  });
  const res = createResponseRecorder();

  await service.generateOutfitImage(
    {
      user: { email: "person@example.com" },
      params: { id: "outfit-too-small" },
    },
    res,
  );

  expect(res.statusCode).toBe(400);
  expect(res.body).toEqual({ error: "invalid_payload" });
});

test("outfit image service returns pending when a job is already running", async () => {
  let resolveImage: (() => void) | null = null;
  const imageStarted = new Promise<void>((resolve) => {
    resolveImage = resolve;
  });
  const service = createOutfitImageService({
    getOutfitImpl: async () =>
      createOutfit(null, [
        { url: "https://example.com/top-pending", source: "from_catalog" },
        { url: "https://example.com/bottom-pending", source: "from_catalog" },
        { url: "https://example.com/bag-pending", source: "from_catalog" },
      ]),
    getOutfitItemsImpl: async () => outfitItems,
    getProfileImpl: async () =>
      buildNormalizedProfileRecord({ imageLlm: "openai:gpt-image-2" }),
    downloadProductImageAssetsImpl: async () => ({}),
    generateImageWithOpenAiImpl: async () => {
      await imageStarted;
      return { response: {} as never, image: null };
    },
    publishSnapshotImpl: () => undefined,
  });
  const firstRes = createResponseRecorder();
  const secondRes = createResponseRecorder();

  await service.generateOutfitImage(
    {
      user: { email: "person@example.com" },
      params: { id: "outfit-pending" },
    },
    firstRes,
  );
  await service.generateOutfitImage(
    {
      user: { email: "person@example.com" },
      params: { id: "outfit-pending" },
    },
    secondRes,
  );
  resolveImage?.();
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(firstRes.statusCode).toBe(202);
  expect(secondRes.statusCode).toBe(202);
  expect(secondRes.body).toEqual({ ok: true, status: "pending" });
});

test("outfit image service can generate with gemini image provider", async () => {
  const generateImageWithGeminiImpl = vi.fn(async () => ({
    response: {} as never,
    image: null,
  }));
  const service = createOutfitImageService({
    getOutfitImpl: async () => createOutfit(),
    getOutfitItemsImpl: async () => outfitItems,
    getProfileImpl: async () =>
      buildNormalizedProfileRecord({
        imageLlm: "gemini:gemini-3-pro-image",
      }),
    downloadProductImageAssetsImpl: async () => ({}),
    generateImageWithGeminiImpl,
    publishSnapshotImpl: () => undefined,
    updateOutfitSnapshotImpl: async (_email, _outfitId, draft) =>
      normalizeOutfitRecord({ ...createOutfit(), draft })!,
  });
  const res = createResponseRecorder();

  await service.generateOutfitImage(
    {
      user: { email: "person@example.com" },
      params: { id: "outfit-gemini" },
    },
    res,
  );
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(res.statusCode).toBe(202);
  expect(generateImageWithGeminiImpl).toHaveBeenCalledOnce();
});
