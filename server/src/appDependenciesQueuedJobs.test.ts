import { beforeEach, expect, test, vi } from "vitest";

const fileUploadRouteApi = vi.hoisted(() => ({
  processQueuedWardrobeFileUploadImpl: vi.fn(async () => ({ ok: true })),
}));
const urlUploadRouteApi = vi.hoisted(() => ({
  processQueuedWardrobeUrlUpload: vi.fn(async () => ({ ok: true })),
}));

vi.mock("./routes/wardrobeFileUploadRoute.js", () => fileUploadRouteApi);
vi.mock("./routes/wardrobeUrlUploadRoute.js", () => urlUploadRouteApi);

import { createAppDependencies } from "./appDependencies.js";

beforeEach(() => {
  fileUploadRouteApi.processQueuedWardrobeFileUploadImpl.mockClear();
  urlUploadRouteApi.processQueuedWardrobeUrlUpload.mockClear();
});

test("app dependencies wire queued upload processors with production route context", async () => {
  const deps = createAppDependencies();

  await expect(
    deps.processQueuedWardrobeFileUploadImpl({
      email: "person@example.com",
      stagedFiles: [{ storage: "local", key: "/tmp/a.png" }],
    }),
  ).resolves.toEqual({ ok: true });
  expect(
    fileUploadRouteApi.processQueuedWardrobeFileUploadImpl,
  ).toHaveBeenCalledWith({
    context: expect.objectContaining({
      analyzeWardrobeImageUrlImpl: expect.any(Function),
      listLikedItemUrlsImpl: expect.any(Function),
      processWardrobeUploadFilesInChildImpl: expect.any(Function),
      saveUploadedWardrobeItemsImpl: expect.any(Function),
    }),
    email: "person@example.com",
    stagedFiles: [{ storage: "local", key: "/tmp/a.png" }],
  });

  await expect(
    deps.processQueuedWardrobeUrlUploadImpl({
      email: "person@example.com",
      urls: ["https://example.com/a.png"],
    }),
  ).resolves.toEqual({ ok: true });
  expect(urlUploadRouteApi.processQueuedWardrobeUrlUpload).toHaveBeenCalledWith(
    {
      context: expect.objectContaining({
        analyzeWardrobeImageUrlImpl: expect.any(Function),
        listLikedItemUrlsImpl: expect.any(Function),
        processWardrobeUploadUrlsInChildImpl: expect.any(Function),
        saveUploadedWardrobeItemsImpl: expect.any(Function),
      }),
      email: "person@example.com",
      urls: ["https://example.com/a.png"],
    },
  );
});
