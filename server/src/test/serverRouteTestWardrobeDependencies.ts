function createWardrobeDependencies() {
  return {
    listWardrobeItemsImpl: async () => [
      {
        id: "wardrobe-1",
        name: "Saved shirt",
        url: "https://example.com/1",
        image_url: "https://example.com/1.jpg",
        source: "from_catalog",
        processing_status: "ready",
      },
    ],
    saveWardrobeItemFromCatalogImpl: async (_payload) => ({
      id: "wardrobe-1",
      name: "Saved shirt",
      url: "https://example.com/1",
      image_url: "https://example.com/1.jpg",
      source: "from_catalog",
      processing_status: "ready",
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
        image_url: "https://images.example.com/wardrobe/profile/image.webp",
        raw_image_url: "https://images.example.com/wardrobe/profile/image.webp",
        source: "uploaded",
        processing_status: "uploaded",
      },
    ],
    analyzeWardrobeImageUrlImpl: async () => ({
      hasMetadata: true,
      metadata: {
        name: "Uploaded shirt",
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
      },
      rawResponse: "{}",
    }),
    updateUploadedWardrobeItemMetadataImpl: async (payload) => ({
      id: payload.id,
      image_url: "https://images.example.com/wardrobe/profile/image.webp",
      raw_image_url: "https://images.example.com/wardrobe/profile/image.webp",
      source: "uploaded",
      processing_status: payload.processingStatus,
      ...(payload.metadata || {}),
    }),
    deleteWardrobeItemFromCatalogImpl: async () => true,
  };
}

export { createWardrobeDependencies };
