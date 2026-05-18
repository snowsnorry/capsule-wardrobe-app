function createUploadedWardrobeMetadata() {
  return {
    name: "Uploaded shirt",
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
}

function createUploadedWardrobeCleanupResult() {
  return {
    cleanImage: {
      key: "wardrobe/profile/image_clean.png",
      url: "https://images.example.com/wardrobe/profile/image_clean.png",
      digest: "clean-digest",
    },
    thumbnails: [
      {
        width: 320,
        key: "wardrobe/profile/image_clean_320.webp",
        url: "https://images.example.com/wardrobe/profile/image_clean_320.webp",
        digest: "thumb-320",
      },
      {
        width: 480,
        key: "wardrobe/profile/image_clean_480.webp",
        url: "https://images.example.com/wardrobe/profile/image_clean_480.webp",
        digest: "thumb-480",
      },
      {
        width: 640,
        key: "wardrobe/profile/image_clean_640.webp",
        url: "https://images.example.com/wardrobe/profile/image_clean_640.webp",
        digest: "thumb-640",
      },
    ],
  };
}

// eslint-disable-next-line max-lines-per-function
function createWardrobeDependencies() {
  return {
    listWardrobeItemsImpl: async () => [
      {
        id: "wardrobe-1",
        name: "Saved shirt",
        url: "https://example.com/1",
        imageUrl: "https://example.com/1.jpg",
        source: "from_catalog",
        processingStatus: "ready",
      },
    ],
    saveWardrobeItemFromCatalogImpl: async (_payload) => ({
      id: "wardrobe-1",
      name: "Saved shirt",
      url: "https://example.com/1",
      imageUrl: "https://example.com/1.jpg",
      source: "from_catalog",
      processingStatus: "ready",
    }),
    normalizeWardrobeUploadImagesInChildImpl: async (images) =>
      images.map((image, index) => ({
        buffer: image.buffer,
        mimeType: "image/webp",
        originalName: image.originalName || `image-${index}.webp`,
        width: 800,
        height: 1000,
        size: image.buffer?.length || 0,
      })),
    uploadWardrobeImageToR2Impl: async (_payload) => ({
      key: "wardrobe/profile/image.webp",
      url: "https://images.example.com/wardrobe/profile/image.webp",
      digest: "digest",
    }),
    saveUploadedWardrobeItemsImpl: async (_payload) => [
      {
        id: "wardrobe-upload-1",
        imageUrl: "https://images.example.com/wardrobe/profile/image.webp",
        rawImageUrl: "https://images.example.com/wardrobe/profile/image.webp",
        source: "uploaded",
        processingStatus: "uploaded",
      },
    ],
    analyzeWardrobeImageUrlImpl: async () => ({
      hasMetadata: true,
      metadata: createUploadedWardrobeMetadata(),
      rawResponse: "{}",
    }),
    cleanupUploadedWardrobeItemImageImpl: async () =>
      createUploadedWardrobeCleanupResult(),
    createUploadedWardrobeItemEmbeddingImpl: async () => [0.1, 0.2, 0.3],
    updateUploadedWardrobeItemMetadataImpl: async (payload) => ({
      id: payload.id,
      embedding: payload.embedding,
      imageUrl:
        payload.imageUrl ||
        "https://images.example.com/wardrobe/profile/image.webp",
      rawImageUrl: "https://images.example.com/wardrobe/profile/image.webp",
      source: "uploaded",
      processingStatus: payload.processingStatus,
      ...(payload.metadata || {}),
    }),
    updateUploadedWardrobeItemDetailsImpl: async (payload) => ({
      id: payload.id,
      embedding: payload.embedding,
      imageUrl: "https://images.example.com/wardrobe/profile/image.webp",
      rawImageUrl: "https://images.example.com/wardrobe/profile/image.webp",
      source: "uploaded",
      processingStatus: payload.processingStatus,
      ...payload.details,
    }),
    getUploadedWardrobeItemImpl: async (payload) => ({
      id: payload.id,
      profileEmail: payload.email,
      name: "Uploaded shirt",
      url: `wardrobe://${payload.id}`,
      imageUrl: "https://images.example.com/wardrobe/profile/image.webp",
      rawImageUrl: "https://images.example.com/wardrobe/profile/image.webp",
      source: "uploaded",
      processingStatus: "ready",
      audience: "all",
      category: "top",
      season: ["summer"],
      updatedAt: "2026-05-01T00:00:00.000Z",
    }),
    deleteUploadedWardrobeItemImpl: async () => ({
      id: "wardrobe-upload-1",
      imageUrl: "https://images.example.com/wardrobe/profile/image_clean.png",
      rawImageUrl: "https://images.example.com/wardrobe/profile/image.webp",
      source: "uploaded",
      processingStatus: "ready",
    }),
    deleteR2ObjectsImpl: async () => ({ deleted: 5 }),
    deleteWardrobeItemFromCatalogImpl: async () => true,
  };
}

export { createWardrobeDependencies };
