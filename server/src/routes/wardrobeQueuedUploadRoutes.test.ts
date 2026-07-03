import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
});

function createSource() {
  return {
    imageUrl: "https://raw.example.test/source.png",
    kind: "file",
    productPageUrl: "https://example.test/product",
    rawImageUrl: "https://raw.example.test/source.png",
    sourceImageKey: "raw/source.png",
    sourceImageUrl: "https://cdn.example.test/raw/source.png",
  };
}

function createCleanup() {
  return {
    cleanImage: {
      digest: "digest",
      key: "clean/image.png",
      url: "https://cdn.example.test/clean/image.png",
    },
    thumbnails: [
      {
        digest: "thumb",
        key: "thumb/image.png",
        url: "https://cdn.example.test/thumb/image.png",
        width: 256,
      },
    ],
  };
}

function createContext(processorName: string) {
  const source = createSource();
  const savedItem = {
    id: "item-1",
    imageUrl: source.imageUrl,
    rawImageUrl: source.rawImageUrl,
    source: "uploaded",
    url: source.productPageUrl,
  };
  const updatedItem = {
    ...savedItem,
    imageUrl: "https://cdn.example.test/clean/image.png",
    processingStatus: "needs_review",
  };
  return {
    analyzeWardrobeImageUrlImpl: vi.fn(),
    annotateLikedItems: vi.fn((items) =>
      items.map((item) => ({ ...item, liked: true })),
    ),
    cleanupUploadedWardrobeItemImageImpl: vi.fn(),
    createUploadedWardrobeItemEmbeddingImpl: vi.fn(),
    getProfileImpl: vi.fn(async () => ({ imageLlm: "openai:gpt-image-2" })),
    listLikedItemUrlsImpl: vi.fn(async () => [source.productPageUrl]),
    processWardrobeUploadFilesInChildImpl: vi.fn(
      async ({ onEvent }: { onEvent: (event: unknown) => void }) => {
        onEvent({
          event: "source-uploaded",
          inputIndex: 0,
          kind: "file",
          source,
          type: "event",
        });
        return [
          {
            analysis: { hasMetadata: false, metadata: null },
            cleanup: createCleanup(),
            inputIndex: 0,
            ok: true,
            source,
          },
        ];
      },
    ),
    processWardrobeUploadUrlsInChildImpl: vi.fn(
      async ({ onEvent }: { onEvent: (event: unknown) => void }) => {
        onEvent({
          event: "source-uploaded",
          inputIndex: 0,
          kind: "direct-image",
          source: { ...source, kind: "direct-image" },
          type: "event",
        });
        return [
          {
            analysis: { hasMetadata: false, metadata: null },
            cleanup: createCleanup(),
            inputIndex: 0,
            ok: true,
            source: { ...source, kind: "direct-image" },
          },
        ];
      },
    ),
    saveUploadedWardrobeItemsImpl: vi.fn(async () => [savedItem]),
    updateUploadedWardrobeItemMetadataImpl: vi.fn(async () => updatedItem),
    __processorName: processorName,
  };
}

test("queued URL upload processor saves sources, applies metadata result, and annotates returned items", async () => {
  const { processQueuedWardrobeUrlUpload } =
    await import("./wardrobeUrlUploadRoute.js");
  const context = createContext("url");
  const signal = new AbortController().signal;

  await expect(
    processQueuedWardrobeUrlUpload({
      context,
      email: "person@example.com",
      signal,
      urls: ["https://example.test/image.png"],
    }),
  ).resolves.toMatchObject({
    ok: true,
    uploaded: 1,
    metadataProcessed: 0,
    imageProcessed: 1,
    failed: 0,
    items: [
      {
        id: "item-1",
        liked: true,
        processingStatus: "needs_review",
      },
    ],
  });
  expect(context.processWardrobeUploadUrlsInChildImpl).toHaveBeenCalledWith(
    expect.objectContaining({
      email: "person@example.com",
      signal,
      urls: ["https://example.test/image.png"],
    }),
  );
  expect(context.saveUploadedWardrobeItemsImpl).toHaveBeenCalledWith({
    email: "person@example.com",
    items: [
      expect.objectContaining({
        imageUrl: "https://raw.example.test/source.png",
        ownedR2ImageKeys: ["raw/source.png"],
      }),
    ],
  });
  expect(context.updateUploadedWardrobeItemMetadataImpl).toHaveBeenCalledWith(
    expect.objectContaining({
      email: "person@example.com",
      id: "item-1",
      imageUrl: "https://cdn.example.test/clean/image.png",
      processingStatus: "needs_review",
    }),
  );
});

test("queued URL upload processor skips failed items without sources", async () => {
  const { processQueuedWardrobeUrlUpload } =
    await import("./wardrobeUrlUploadRoute.js");
  const context = createContext("url");
  const urlProcessor =
    context.processWardrobeUploadUrlsInChildImpl as unknown as {
      mockResolvedValueOnce: (value: unknown) => void;
    };
  urlProcessor.mockResolvedValueOnce([
    {
      inputIndex: 0,
      message: "download_failed",
      ok: false,
      source: null,
    },
  ]);

  await expect(
    processQueuedWardrobeUrlUpload({
      context,
      email: "person@example.com",
      urls: ["https://example.test/missing.png"],
    }),
  ).resolves.toMatchObject({
    ok: true,
    uploaded: 0,
    failed: 1,
    items: [],
  });
  expect(context.saveUploadedWardrobeItemsImpl).not.toHaveBeenCalled();
});

test("queued URL upload processor marks saved sources failed when child processing aborts", async () => {
  const { processQueuedWardrobeUrlUpload } =
    await import("./wardrobeUrlUploadRoute.js");
  const context = createContext("url");
  const source = createSource();
  context.processWardrobeUploadUrlsInChildImpl.mockImplementationOnce(
    async ({ onEvent }: { onEvent: (event: unknown) => void }) => {
      onEvent({
        event: "source-uploaded",
        inputIndex: 0,
        kind: "direct-image",
        source: { ...source, kind: "direct-image" },
        type: "event",
      });
      throw new Error("worker_crashed");
    },
  );

  await expect(
    processQueuedWardrobeUrlUpload({
      context,
      email: "person@example.com",
      urls: ["https://example.test/image.png"],
    }),
  ).rejects.toThrow("worker_crashed");
  expect(context.updateUploadedWardrobeItemMetadataImpl).toHaveBeenCalledWith({
    email: "person@example.com",
    id: "item-1",
    metadata: null,
    processingStatus: "failed",
  });
});

test("queued file upload processor hydrates staged files, cleans up, and filters returned items", async () => {
  const cleanup = vi.fn(async () => undefined);
  const cleanupStagedUploadFiles = vi.fn(async () => undefined);
  vi.doMock("../jobs/stagedUploadStorage.js", () => ({
    cleanupStagedUploadFiles,
    hydrateStagedUploadFiles: vi.fn(async () => ({
      cleanup,
      files: [
        {
          filePath: "/tmp/source.png",
          mimeType: "image/png",
          originalName: "source.png",
        },
      ],
    })),
    stageUploadFile: vi.fn(),
  }));
  const { processQueuedWardrobeFileUploadImpl } =
    await import("./wardrobeFileUploadRoute.js");
  const context = createContext("file");
  const signal = new AbortController().signal;

  await expect(
    processQueuedWardrobeFileUploadImpl({
      context,
      email: "person@example.com",
      signal,
      stagedFiles: [
        {
          storage: "local",
          key: "/tmp/staged.png",
          mimeType: "image/png",
          originalName: "source.png",
        },
      ],
    }),
  ).resolves.toMatchObject({
    ok: true,
    uploaded: 1,
    imageProcessed: 1,
    items: [
      {
        id: "item-1",
        liked: true,
        processingStatus: "needs_review",
      },
    ],
  });
  expect(context.processWardrobeUploadFilesInChildImpl).toHaveBeenCalledWith(
    expect.objectContaining({
      files: [
        {
          filePath: "/tmp/source.png",
          mimeType: "image/png",
          originalName: "source.png",
        },
      ],
      signal,
    }),
  );
  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(cleanupStagedUploadFiles).toHaveBeenCalledWith([
    {
      storage: "local",
      key: "/tmp/staged.png",
      mimeType: "image/png",
      originalName: "source.png",
    },
  ]);
});
