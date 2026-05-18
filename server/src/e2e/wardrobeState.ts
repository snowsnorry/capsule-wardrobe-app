import { deepClone } from "./capsuleState.js";
import { E2E_EMAIL, e2eImageUrl } from "./fixtures.js";

type E2eUploadedWardrobeItem = Record<string, unknown> & {
  id: string;
  imageUrl: string;
  rawImageUrl: string;
  source: "uploaded";
};

function buildUploadedMetadata(index: number) {
  return {
    name: `Uploaded e2e item ${index}`,
    description: "Uploaded through the Playwright e2e wardrobe flow.",
    brand: null,
    audience: "woman",
    category: "top",
    season: ["spring"],
    formalityLevel: ["casual"],
    style: ["minimalistic"],
    occasions: ["office"],
    colorBase: ["navy"],
    isNeutral: false,
    pattern: "solid",
    finish: null,
    composition: null,
    silhouette: null,
    fit: "regular",
    closureType: [],
  };
}

class E2eWardrobeMemory {
  uploadedImageCounter = 0;
  uploadedItemCounter = 0;
  uploadedItems: E2eUploadedWardrobeItem[] = [];

  reset() {
    this.uploadedImageCounter = 0;
    this.uploadedItemCounter = 0;
    this.uploadedItems = [];
  }

  nextUploadedImage() {
    this.uploadedImageCounter += 1;
    const key = `wardrobe/e2e/uploaded-e2e-${this.uploadedImageCounter}.svg`;
    return {
      key,
      url: e2eImageUrl(`uploaded-e2e-${this.uploadedImageCounter}`),
      digest: `e2e-upload-${this.uploadedImageCounter}`,
    };
  }

  saveUploadedItems(email: string, imageUrls: string[]) {
    const now = new Date().toISOString();
    const items = imageUrls.map((imageUrl) => {
      this.uploadedItemCounter += 1;
      const id = `uploaded-e2e-${this.uploadedItemCounter}`;
      const item: E2eUploadedWardrobeItem = {
        id,
        profileEmail: email,
        ...buildUploadedMetadata(this.uploadedItemCounter),
        imageUrl,
        rawImageUrl: imageUrl,
        url: `wardrobe://${id}`,
        source: "uploaded",
        processingStatus: "uploaded",
        createdAt: now,
        updatedAt: now,
      };
      this.uploadedItems.push(item);
      return item;
    });
    return deepClone(items);
  }

  listItems(source: unknown) {
    return source === "from_catalog" ? [] : deepClone(this.uploadedItems);
  }

  updateMetadata(payload) {
    const id = String(payload?.id || "").trim();
    const index = this.uploadedItems.findIndex((item) => item.id === id);
    if (index < 0) {
      return null;
    }

    const current = this.uploadedItems[index];
    const updated = {
      ...current,
      ...(payload?.metadata || {}),
      imageUrl: String(payload?.imageUrl || current.imageUrl),
      processingStatus: payload?.processingStatus || current.processingStatus,
      updatedAt: new Date().toISOString(),
    };
    this.uploadedItems[index] = updated;
    return deepClone(updated);
  }
}

function getUploadedIndexFromImageUrl(imageUrl: unknown) {
  const match = String(imageUrl || "").match(/uploaded-e2e-(\d+)/);
  return Number(match?.[1]) || 1;
}

function createE2eWardrobeDependencies(memory: E2eWardrobeMemory) {
  return {
    analyzeWardrobeImageUrlImpl: async (payload) => ({
      hasMetadata: true,
      metadata: buildUploadedMetadata(
        getUploadedIndexFromImageUrl(payload?.imageUrl),
      ),
      rawResponse: "e2e-uploaded-wardrobe-metadata",
    }),
    cleanupUploadedWardrobeItemImageImpl: async (payload) => ({
      cleanImage: {
        key: `${payload?.sourceKey || "uploaded-e2e"}.clean`,
        url: String(payload?.imageUrl || ""),
        digest: "e2e-clean-digest",
      },
      thumbnails: [],
    }),
    listWardrobeItemsImpl: async (payload) => memory.listItems(payload?.source),
    normalizeWardrobeUploadImagesInChildImpl: async (images) =>
      images.map((image) => ({
        ...image,
        width: 320,
        height: 420,
        size: image.buffer.length,
      })),
    saveUploadedWardrobeItemsImpl: async (payload) =>
      memory.saveUploadedItems(
        String(payload?.email || E2E_EMAIL),
        Array.isArray(payload?.imageUrls) ? payload.imageUrls : [],
      ),
    updateUploadedWardrobeItemMetadataImpl: async (payload) =>
      memory.updateMetadata(payload),
    uploadWardrobeImageToR2Impl: async () => memory.nextUploadedImage(),
  };
}

export { createE2eWardrobeDependencies, E2eWardrobeMemory };
