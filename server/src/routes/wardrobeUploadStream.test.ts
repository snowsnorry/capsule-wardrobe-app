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
    audience: null,
    category: "top",
    season: [],
    formality_level: [],
    style: [],
    occasions: [],
    color_base: [],
    is_neutral: false,
    pattern: null,
    finish: null,
    composition: null,
    silhouette: null,
    fit: null,
    closure_type: [],
  };
  const context = {
    analyzeWardrobeImageUrlImpl: vi.fn(async () => ({
      hasMetadata: true,
      metadata,
    })),
    updateUploadedWardrobeItemMetadataImpl: vi.fn(async () => ({
      id: "item-1",
      processing_status: "metadata_processed",
      name: "Linen shirt",
    })),
  };
  const progress = {
    total: 1,
    uploaded: 1,
    metadataProcessed: 0,
    failed: 0,
  };

  const item = await processUploadedWardrobeItemMetadata({
    context,
    email: "person@example.com",
    filterItem: (value) => value,
    item: {
      id: "item-1",
      image_url: "https://images.example.com/item.webp",
      raw_image_url: "https://images.example.com/item.webp",
    },
    progress,
    res,
  });

  expect(item).toEqual(
    expect.objectContaining({
      processing_status: "metadata_processed",
      name: "Linen shirt",
    }),
  );
  expect(progress).toEqual({
    total: 1,
    uploaded: 1,
    metadataProcessed: 1,
    failed: 0,
  });
  expect(context.updateUploadedWardrobeItemMetadataImpl).toHaveBeenCalledWith({
    email: "person@example.com",
    id: "item-1",
    metadata,
    processingStatus: "metadata_processed",
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
      processing_status: "failed",
    })),
  };
  const progress = {
    total: 1,
    uploaded: 1,
    metadataProcessed: 0,
    failed: 0,
  };

  const item = await processUploadedWardrobeItemMetadata({
    context,
    email: "person@example.com",
    filterItem: (value) => value,
    item: {
      id: "item-1",
      image_url: "https://images.example.com/item.webp",
    },
    progress,
    res,
  });

  expect(item).toEqual({ id: "item-1", processing_status: "failed" });
  expect(progress.failed).toBe(1);
  expect(context.updateUploadedWardrobeItemMetadataImpl).toHaveBeenCalledWith({
    email: "person@example.com",
    id: "item-1",
    metadata: null,
    processingStatus: "failed",
  });
});

test("wardrobe upload stream marks empty metadata failed", async () => {
  const res = createResponse();
  const emptyMetadata = {
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
  };
  const context = {
    analyzeWardrobeImageUrlImpl: vi.fn(async () => ({
      hasMetadata: false,
      metadata: emptyMetadata,
    })),
    updateUploadedWardrobeItemMetadataImpl: vi.fn(async () => null),
  };
  const progress = {
    total: 1,
    uploaded: 1,
    metadataProcessed: 0,
    failed: 0,
  };

  const item = await processUploadedWardrobeItemMetadata({
    context,
    email: "person@example.com",
    filterItem: (value) => ({ ...value, filtered: true }),
    item: {
      id: "item-1",
      image_url: "https://images.example.com/item.webp",
    },
    progress,
    res,
  });

  expect(item).toEqual(
    expect.objectContaining({
      filtered: true,
      id: "item-1",
      processing_status: "failed",
    }),
  );
  expect(progress.failed).toBe(1);
  expect(getWrittenText(res)).toContain(
    'event: progress\ndata: {"total":1,"uploaded":1,"metadataProcessed":0,"failed":1}\n\n',
  );
});

test("wardrobe upload stream handles invalid uploaded items without db update", async () => {
  const res = createResponse();
  const context = {
    analyzeWardrobeImageUrlImpl: vi.fn(),
    updateUploadedWardrobeItemMetadataImpl: vi.fn(),
  };
  const progress = {
    total: 1,
    uploaded: 1,
    metadataProcessed: 0,
    failed: 0,
  };

  const item = await processUploadedWardrobeItemMetadata({
    context,
    email: "person@example.com",
    filterItem: (value) => value,
    item: {
      id: "",
      image_url: "",
    },
    progress,
    res,
  });

  expect(item).toEqual({ id: "", image_url: "", processing_status: "failed" });
  expect(context.analyzeWardrobeImageUrlImpl).not.toHaveBeenCalled();
  expect(context.updateUploadedWardrobeItemMetadataImpl).not.toHaveBeenCalled();
  expect(progress.failed).toBe(1);
});
