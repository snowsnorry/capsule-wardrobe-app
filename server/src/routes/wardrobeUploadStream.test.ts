import { expect, test, vi } from "vitest";
import {
  openWardrobeUploadEventStream,
  processUploadedWardrobeItemMetadata,
  writeWardrobeUploadEvent,
} from "./wardrobeUploadStream.js";

function createResponse() {
  return {
    status: vi.fn(),
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn(),
  };
}

function getWrittenText(res: ReturnType<typeof createResponse>) {
  return res.write.mock.calls.map((call) => call[0]).join("");
}

test("wardrobe upload stream opens and writes SSE events", () => {
  const res = createResponse();

  openWardrobeUploadEventStream(res);
  writeWardrobeUploadEvent(res, "progress", { uploaded: 1 });

  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.setHeader).toHaveBeenCalledWith(
    "Content-Type",
    "text/event-stream",
  );
  expect(res.flushHeaders).toHaveBeenCalled();
  expect(getWrittenText(res)).toBe('event: progress\ndata: {"uploaded":1}\n\n');
});

test("wardrobe upload stream processes successful metadata", async () => {
  const res = createResponse();
  const metadata = {
    name: "Linen shirt",
    description: null,
    brand: null,
    audience: "all",
    category: "top",
    season: ["summer"],
    formalityLevel: [],
    style: [],
    occasions: [],
    colorBase: [],
    isNeutral: false,
    pattern: null,
    finish: null,
    composition: null,
    silhouette: null,
    fit: null,
    closureType: [],
  };
  const context = {
    analyzeWardrobeImageUrlImpl: vi.fn(async () => ({
      hasMetadata: true,
      metadata,
    })),
    cleanupUploadedWardrobeItemImageImpl: vi.fn(async () => ({
      cleanImage: {
        key: "wardrobe/542d240129883c01/item_clean.png",
        url: "https://images.example.com/item_clean.png",
      },
    })),
    createUploadedWardrobeItemEmbeddingImpl: vi.fn(async () => [0.1, 0.2]),
    updateUploadedWardrobeItemMetadataImpl: vi.fn(async () => ({
      id: "item-1",
      imageUrl: "https://images.example.com/item_clean.png",
      processingStatus: "ready",
      name: "Linen shirt",
    })),
  };
  const progress = {
    total: 1,
    uploaded: 1,
    completedSteps: 1,
    metadataProcessed: 0,
    imageProcessed: 0,
    failed: 0,
  };

  const item = await processUploadedWardrobeItemMetadata({
    context,
    email: "person@example.com",
    filterItem: (value) => value,
    item: {
      id: "item-1",
      imageUrl: "https://images.example.com/item.webp",
      rawImageUrl: "https://images.example.com/item.webp",
    },
    sourceImage: {
      buffer: Buffer.from("source"),
      mimeType: "image/webp",
      originalName: "item.webp",
    },
    sourceImageKey: "wardrobe/542d240129883c01/item.webp",
    progress,
    res,
  });

  expect(item).toEqual(
    expect.objectContaining({
      processingStatus: "ready",
      name: "Linen shirt",
    }),
  );
  expect(progress).toEqual({
    total: 1,
    uploaded: 1,
    completedSteps: 3,
    metadataProcessed: 1,
    imageProcessed: 1,
    failed: 0,
  });
  expect(context.cleanupUploadedWardrobeItemImageImpl).toHaveBeenCalledWith({
    email: "person@example.com",
    imageUrl: "https://images.example.com/item.webp",
    sourceBuffer: Buffer.from("source"),
    sourceFilename: "item.webp",
    sourceKey: "wardrobe/542d240129883c01/item.webp",
    sourceMimeType: "image/webp",
  });
  expect(context.updateUploadedWardrobeItemMetadataImpl).toHaveBeenCalledWith({
    email: "person@example.com",
    embedding: [0.1, 0.2],
    id: "item-1",
    imageUrl: "https://images.example.com/item_clean.png",
    metadata,
    ownedR2ImageKeys: ["wardrobe/542d240129883c01/item_clean.png"],
    processingStatus: "ready",
  });
  expect(context.createUploadedWardrobeItemEmbeddingImpl).toHaveBeenCalledWith(
    metadata,
  );
});

test("wardrobe upload stream saves failed status when embedding fails", async () => {
  const res = createResponse();
  const metadata = {
    name: "Linen shirt",
    description: null,
    brand: null,
    audience: "all",
    category: "top",
    season: ["summer"],
    formalityLevel: [],
    style: [],
    occasions: [],
    colorBase: [],
    isNeutral: false,
    pattern: null,
    finish: null,
    composition: null,
    silhouette: null,
    fit: null,
    closureType: [],
  };
  const context = {
    analyzeWardrobeImageUrlImpl: vi.fn(async () => ({
      hasMetadata: true,
      metadata,
    })),
    cleanupUploadedWardrobeItemImageImpl: vi.fn(async () => ({
      cleanImage: {
        key: "wardrobe/542d240129883c01/item_clean.png",
        url: "https://images.example.com/item_clean.png",
      },
    })),
    createUploadedWardrobeItemEmbeddingImpl: vi.fn(async () => {
      throw new Error("voyage_down");
    }),
    updateUploadedWardrobeItemMetadataImpl: vi.fn(async () => ({
      id: "item-1",
      imageUrl: "https://images.example.com/item_clean.png",
      processingStatus: "failed",
      name: "Linen shirt",
    })),
  };
  const progress = {
    total: 1,
    uploaded: 1,
    completedSteps: 1,
    metadataProcessed: 0,
    imageProcessed: 0,
    failed: 0,
  };
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

  const item = await processUploadedWardrobeItemMetadata({
    context,
    email: "person@example.com",
    filterItem: (value) => value,
    item: {
      id: "item-1",
      imageUrl: "https://images.example.com/item.webp",
    },
    progress,
    res,
  });

  expect(item).toEqual(
    expect.objectContaining({
      id: "item-1",
      processingStatus: "failed",
    }),
  );
  expect(progress).toEqual({
    total: 1,
    uploaded: 1,
    completedSteps: 3,
    metadataProcessed: 1,
    imageProcessed: 1,
    failed: 1,
  });
  expect(context.updateUploadedWardrobeItemMetadataImpl).toHaveBeenCalledWith({
    email: "person@example.com",
    embedding: null,
    id: "item-1",
    imageUrl: "https://images.example.com/item_clean.png",
    metadata,
    ownedR2ImageKeys: ["wardrobe/542d240129883c01/item_clean.png"],
    processingStatus: "failed",
  });
  consoleError.mockRestore();
});

test("wardrobe upload stream marks incomplete metadata needs review without embedding", async () => {
  const res = createResponse();
  const metadata = {
    name: "Linen shirt",
    description: null,
    brand: null,
    audience: null,
    category: "top",
    season: [],
    formalityLevel: [],
    style: [],
    occasions: [],
    colorBase: [],
    isNeutral: false,
    pattern: null,
    finish: null,
    composition: null,
    silhouette: null,
    fit: null,
    closureType: [],
  };
  const context = {
    analyzeWardrobeImageUrlImpl: vi.fn(async () => ({
      hasMetadata: true,
      metadata,
    })),
    cleanupUploadedWardrobeItemImageImpl: vi.fn(async () => ({
      cleanImage: {
        key: "wardrobe/542d240129883c01/item_clean.png",
        url: "https://images.example.com/item_clean.png",
      },
    })),
    createUploadedWardrobeItemEmbeddingImpl: vi.fn(),
    updateUploadedWardrobeItemMetadataImpl: vi.fn(async () => ({
      id: "item-1",
      imageUrl: "https://images.example.com/item_clean.png",
      processingStatus: "needs_review",
      name: "Linen shirt",
    })),
  };
  const progress = {
    total: 1,
    uploaded: 1,
    completedSteps: 1,
    metadataProcessed: 0,
    imageProcessed: 0,
    failed: 0,
  };

  const item = await processUploadedWardrobeItemMetadata({
    context,
    email: "person@example.com",
    filterItem: (value) => value,
    item: {
      id: "item-1",
      imageUrl: "https://images.example.com/item.webp",
    },
    progress,
    res,
  });

  expect(item).toEqual(
    expect.objectContaining({
      id: "item-1",
      processingStatus: "needs_review",
    }),
  );
  expect(progress).toEqual({
    total: 1,
    uploaded: 1,
    completedSteps: 3,
    metadataProcessed: 1,
    imageProcessed: 1,
    failed: 0,
  });
  expect(
    context.createUploadedWardrobeItemEmbeddingImpl,
  ).not.toHaveBeenCalled();
  expect(context.updateUploadedWardrobeItemMetadataImpl).toHaveBeenCalledWith({
    email: "person@example.com",
    embedding: null,
    id: "item-1",
    imageUrl: "https://images.example.com/item_clean.png",
    metadata,
    ownedR2ImageKeys: ["wardrobe/542d240129883c01/item_clean.png"],
    processingStatus: "needs_review",
  });
});

test("wardrobe upload stream marks missing or throwing metadata failed", async () => {
  const res = createResponse();
  const context = {
    analyzeWardrobeImageUrlImpl: vi.fn(async () => {
      throw new Error("llm_failed");
    }),
    updateUploadedWardrobeItemMetadataImpl: vi.fn(async () => ({
      id: "item-1",
      processingStatus: "failed",
    })),
    cleanupUploadedWardrobeItemImageImpl: vi.fn(),
  };
  const progress = {
    total: 1,
    uploaded: 1,
    completedSteps: 1,
    metadataProcessed: 0,
    imageProcessed: 0,
    failed: 0,
  };

  const item = await processUploadedWardrobeItemMetadata({
    context,
    email: "person@example.com",
    filterItem: (value) => value,
    item: {
      id: "item-1",
      imageUrl: "https://images.example.com/item.webp",
    },
    progress,
    res,
  });

  expect(item).toEqual({ id: "item-1", processingStatus: "failed" });
  expect(progress.failed).toBe(1);
  expect(progress.completedSteps).toBe(3);
  expect(context.cleanupUploadedWardrobeItemImageImpl).not.toHaveBeenCalled();
  expect(context.updateUploadedWardrobeItemMetadataImpl).toHaveBeenCalledWith({
    email: "person@example.com",
    id: "item-1",
    metadata: null,
    processingStatus: "failed",
  });
});

test("wardrobe upload stream marks empty metadata needs review after cleanup", async () => {
  const res = createResponse();
  const emptyMetadata = {
    name: null,
    description: null,
    brand: null,
    audience: null,
    category: null,
    season: [],
    formalityLevel: [],
    style: [],
    occasions: [],
    colorBase: [],
    isNeutral: null,
    pattern: null,
    finish: null,
    composition: null,
    silhouette: null,
    fit: null,
    closureType: [],
  };
  const context = {
    analyzeWardrobeImageUrlImpl: vi.fn(async () => ({
      hasMetadata: false,
      metadata: emptyMetadata,
    })),
    cleanupUploadedWardrobeItemImageImpl: vi.fn(async () => ({
      cleanImage: {
        key: "wardrobe/542d240129883c01/item_clean.png",
        url: "https://images.example.com/item_clean.png",
      },
    })),
    createUploadedWardrobeItemEmbeddingImpl: vi.fn(),
    updateUploadedWardrobeItemMetadataImpl: vi.fn(async () => ({
      id: "item-1",
      imageUrl: "https://images.example.com/item_clean.png",
      processingStatus: "needs_review",
    })),
  };
  const progress = {
    total: 1,
    uploaded: 1,
    completedSteps: 1,
    metadataProcessed: 0,
    imageProcessed: 0,
    failed: 0,
  };

  const item = await processUploadedWardrobeItemMetadata({
    context,
    email: "person@example.com",
    filterItem: (value) => ({ ...value, filtered: true }),
    item: {
      id: "item-1",
      imageUrl: "https://images.example.com/item.webp",
    },
    progress,
    res,
  });

  expect(item).toEqual(
    expect.objectContaining({
      filtered: true,
      id: "item-1",
      processingStatus: "needs_review",
    }),
  );
  expect(progress.failed).toBe(0);
  expect(progress.completedSteps).toBe(3);
  expect(context.cleanupUploadedWardrobeItemImageImpl).toHaveBeenCalled();
  expect(
    context.createUploadedWardrobeItemEmbeddingImpl,
  ).not.toHaveBeenCalled();
  expect(context.updateUploadedWardrobeItemMetadataImpl).toHaveBeenCalledWith({
    email: "person@example.com",
    embedding: null,
    id: "item-1",
    imageUrl: "https://images.example.com/item_clean.png",
    metadata: {
      name: null,
      description: null,
      brand: null,
      audience: null,
      category: null,
      season: [],
      formality_level: [],
      style: [],
      occasions: [],
      color_base: [],
      is_neutral: null,
      pattern: null,
      finish: null,
      composition: null,
      silhouette: null,
      fit: null,
      closure_type: [],
    },
    ownedR2ImageKeys: ["wardrobe/542d240129883c01/item_clean.png"],
    processingStatus: "needs_review",
  });
  expect(getWrittenText(res)).toContain(
    'event: progress\ndata: {"total":1,"uploaded":1,"completedSteps":3,"metadataProcessed":0,"imageProcessed":1,"failed":0}\n\n',
  );
});

test("wardrobe upload stream marks cleanup failures failed after metadata", async () => {
  const res = createResponse();
  const metadata = {
    name: "Linen shirt",
    description: null,
    brand: null,
    audience: null,
    category: "top",
    season: [],
    formalityLevel: [],
    style: [],
    occasions: [],
    colorBase: [],
    isNeutral: false,
    pattern: null,
    finish: null,
    composition: null,
    silhouette: null,
    fit: null,
    closureType: [],
  };
  const context = {
    analyzeWardrobeImageUrlImpl: vi.fn(async () => ({
      hasMetadata: true,
      metadata,
    })),
    cleanupUploadedWardrobeItemImageImpl: vi.fn(async () => {
      throw new Error("cleanup_failed");
    }),
    updateUploadedWardrobeItemMetadataImpl: vi.fn(async () => ({
      id: "item-1",
      processingStatus: "failed",
      name: "Linen shirt",
    })),
  };
  const progress = {
    total: 1,
    uploaded: 1,
    completedSteps: 1,
    metadataProcessed: 0,
    imageProcessed: 0,
    failed: 0,
  };

  const item = await processUploadedWardrobeItemMetadata({
    context,
    email: "person@example.com",
    filterItem: (value) => value,
    item: {
      id: "item-1",
      imageUrl: "https://images.example.com/item.webp",
    },
    sourceImage: {
      buffer: Buffer.from("source"),
      mimeType: "image/webp",
      originalName: "item.webp",
    },
    progress,
    res,
  });

  expect(item).toEqual(
    expect.objectContaining({
      id: "item-1",
      processingStatus: "failed",
    }),
  );
  expect(progress).toEqual({
    total: 1,
    uploaded: 1,
    completedSteps: 3,
    metadataProcessed: 1,
    imageProcessed: 0,
    failed: 1,
  });
  expect(
    context.updateUploadedWardrobeItemMetadataImpl,
  ).toHaveBeenLastCalledWith({
    email: "person@example.com",
    id: "item-1",
    metadata: null,
    processingStatus: "failed",
  });
});

test("wardrobe upload stream handles invalid uploaded items without db update", async () => {
  const res = createResponse();
  const context = {
    analyzeWardrobeImageUrlImpl: vi.fn(),
    updateUploadedWardrobeItemMetadataImpl: vi.fn(),
    cleanupUploadedWardrobeItemImageImpl: vi.fn(),
  };
  const progress = {
    total: 1,
    uploaded: 1,
    completedSteps: 1,
    metadataProcessed: 0,
    imageProcessed: 0,
    failed: 0,
  };

  const item = await processUploadedWardrobeItemMetadata({
    context,
    email: "person@example.com",
    filterItem: (value) => value,
    item: {
      id: "",
      imageUrl: "",
    },
    progress,
    res,
  });

  expect(item).toEqual({ id: "", imageUrl: "", processingStatus: "failed" });
  expect(context.analyzeWardrobeImageUrlImpl).not.toHaveBeenCalled();
  expect(context.updateUploadedWardrobeItemMetadataImpl).not.toHaveBeenCalled();
  expect(context.cleanupUploadedWardrobeItemImageImpl).not.toHaveBeenCalled();
  expect(progress.failed).toBe(1);
});
