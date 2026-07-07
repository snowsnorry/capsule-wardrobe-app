import { deepClone } from "./capsuleState.js";
import { buildE2eWardrobeItems, E2E_EMAIL, e2eImageUrl } from "./fixtures.js";

type E2eUploadedWardrobeItem = Record<string, unknown> & {
  id: string;
  imageUrl: string;
  rawImageUrl: string;
  source: "uploaded";
};
type E2eCatalogWardrobeItem = Record<string, unknown> & {
  id: string;
  source: "from_catalog";
  url: string;
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
  catalogItemCounter = 0;
  uploadedItems: E2eUploadedWardrobeItem[] = [];
  catalogItems: E2eCatalogWardrobeItem[] = [];
  likedUrls = new Set<string>();

  reset() {
    this.uploadedImageCounter = 0;
    this.uploadedItemCounter = 0;
    this.catalogItemCounter = 0;
    this.uploadedItems = [];
    this.catalogItems = [];
    this.likedUrls.clear();
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

  saveUploadedItems(
    email: string,
    entries: Array<
      string | { imageUrl?: string; rawImageUrl?: string; url?: string }
    >,
  ) {
    const now = new Date().toISOString();
    const items = entries.map((entry) => {
      const imageUrl =
        typeof entry === "string" ? entry : String(entry?.imageUrl || "");
      const rawImageUrl =
        typeof entry === "string"
          ? imageUrl
          : String(entry?.rawImageUrl || imageUrl);
      const url =
        typeof entry === "string" ? "" : String(entry?.url || "").trim();
      this.uploadedItemCounter += 1;
      const id = `uploaded-e2e-${this.uploadedItemCounter}`;
      const item: E2eUploadedWardrobeItem = {
        id,
        profileEmail: email,
        ...buildUploadedMetadata(this.uploadedItemCounter),
        imageUrl,
        rawImageUrl,
        url: url || `wardrobe://${id}`,
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
    if (source === "uploaded") {
      return deepClone(this.uploadedItems);
    }
    if (source === "from_catalog") {
      return deepClone(this.catalogItems);
    }
    return deepClone([...this.uploadedItems, ...this.catalogItems]);
  }

  countItems(source: unknown) {
    return this.listItems(source).length;
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

  updateDetails(payload) {
    const id = String(payload?.id || "").trim();
    const index = this.uploadedItems.findIndex((item) => item.id === id);
    if (index < 0) {
      return null;
    }

    const current = this.uploadedItems[index];
    const updated = {
      ...current,
      ...(payload?.details || {}),
      processingStatus: payload?.processingStatus || current.processingStatus,
      updatedAt: new Date().toISOString(),
    };
    this.uploadedItems[index] = updated;
    return deepClone(updated);
  }

  getUploadedItem(id: unknown) {
    const normalizedId = String(id || "").trim();
    return deepClone(
      this.uploadedItems.find((item) => item.id === normalizedId) || null,
    );
  }

  deleteUploadedItem(id: unknown) {
    const normalizedId = String(id || "").trim();
    const index = this.uploadedItems.findIndex(
      (item) => item.id === normalizedId,
    );
    if (index < 0) {
      return null;
    }

    const [removed] = this.uploadedItems.splice(index, 1);
    return deepClone(removed);
  }

  saveCatalogItem(email: string, url: unknown) {
    const normalizedUrl = normalizeHttpUrl(url);
    if (!normalizedUrl) {
      return null;
    }

    const existing = this.catalogItems.find(
      (item) => normalizeHttpUrl(item.url) === normalizedUrl,
    );
    if (existing) {
      return deepClone(existing);
    }

    const fixture = buildE2eWardrobeItems().find(
      (item) => normalizeHttpUrl(item.url) === normalizedUrl,
    );
    if (!fixture) {
      return null;
    }

    this.catalogItemCounter += 1;
    const now = new Date().toISOString();
    const item: E2eCatalogWardrobeItem = {
      ...fixture,
      id: `catalog-e2e-${this.catalogItemCounter}`,
      profileEmail: email,
      source: "from_catalog",
      url: normalizedUrl,
      createdAt: now,
      updatedAt: now,
    };
    this.catalogItems.push(item);
    return deepClone(item);
  }

  deleteCatalogItem(url: unknown) {
    const normalizedUrl = normalizeHttpUrl(url);
    const index = this.catalogItems.findIndex(
      (item) => normalizeHttpUrl(item.url) === normalizedUrl,
    );
    if (index < 0) {
      return false;
    }

    this.catalogItems.splice(index, 1);
    return true;
  }

  listLikedItemUrls(itemUrls?: unknown[]) {
    const requestedUrls = Array.isArray(itemUrls)
      ? new Set(itemUrls.map(normalizeLikedUrl).filter(Boolean))
      : null;
    const likedUrls = [...this.likedUrls];
    return requestedUrls
      ? likedUrls.filter((itemUrl) => requestedUrls.has(itemUrl))
      : likedUrls;
  }

  likeItem(url: unknown) {
    const itemUrl = normalizeLikedUrl(url);
    if (!itemUrl) {
      return "";
    }

    this.likedUrls.add(itemUrl);
    return itemUrl;
  }

  unlikeItem(url: unknown) {
    const itemUrl = normalizeLikedUrl(url);
    if (itemUrl) {
      this.likedUrls.delete(itemUrl);
    }
    return true;
  }
}

function normalizeHttpUrl(value: unknown): string {
  const normalized = String(value || "").trim();
  if (!normalized) return "";

  try {
    const url = new URL(normalized);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

function normalizeLikedUrl(value: unknown): string {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (/^wardrobe:\/\/\S+$/i.test(normalized)) {
    return normalized;
  }
  return normalizeHttpUrl(normalized);
}

function getUploadedIndexFromImageUrl(imageUrl: unknown) {
  const match = String(imageUrl || "").match(/uploaded-e2e-(\d+)/);
  return Number(match?.[1]) || 1;
}

function createE2eAnalysisDependencies() {
  return {
    analyzeWardrobeImageUrlImpl: async (payload) => ({
      hasMetadata: true,
      metadata: buildUploadedMetadata(
        getUploadedIndexFromImageUrl(payload?.imageUrl),
      ),
      rawResponse: "e2e-uploaded-wardrobe-metadata",
    }),
  };
}

function createE2eUploadProcessingDependencies(memory: E2eWardrobeMemory) {
  return {
    normalizeWardrobeUploadImagesInChildImpl: async (images) =>
      images.map((image) => ({
        ...image,
        width: 320,
        height: 420,
        size: image.buffer.length,
      })),
    processWardrobeUploadFilesInChildImpl: async (payload) =>
      payload.files.map((_file, inputIndex) =>
        buildE2eFileProcessingResult(memory, inputIndex),
      ),
    processWardrobeUploadUrlsInChildImpl: async (payload) =>
      payload.urls.map((url, inputIndex) =>
        buildE2eUrlProcessingResult(url, inputIndex),
      ),
  };
}

function buildE2eFileProcessingResult(
  memory: E2eWardrobeMemory,
  inputIndex: number,
) {
  const uploaded = memory.nextUploadedImage();
  return {
    analysis: {
      hasMetadata: true,
      metadata: buildUploadedMetadata(
        getUploadedIndexFromImageUrl(uploaded.url),
      ),
      rawResponse: "e2e-uploaded-wardrobe-metadata",
    },
    cleanup: {
      cleanImage: uploaded,
      thumbnails: [],
    },
    inputIndex,
    ok: true,
    source: {
      imageUrl: uploaded.url,
      kind: "file",
      productPageUrl: uploaded.url,
      rawImageUrl: uploaded.url,
      sourceImageKey: uploaded.key,
      sourceImageUrl: uploaded.url,
    },
  };
}

function buildE2eUrlProcessingResult(url: unknown, inputIndex: number) {
  const imageUrl = e2eImageUrl(`uploaded-url-e2e-${inputIndex + 1}`);
  return {
    analysis: {
      hasMetadata: true,
      metadata: buildUploadedMetadata(inputIndex + 1),
      rawResponse: "e2e-uploaded-wardrobe-image-url-metadata",
    },
    cleanup: {
      cleanImage: {
        key: "wardrobe/e2e/image-url-source.webp.clean",
        url: imageUrl,
        digest: "e2e-clean-digest",
      },
      thumbnails: [],
    },
    inputIndex,
    ok: true,
    source: {
      imageUrl,
      kind: "direct-image",
      productPageUrl: String(url || "https://shop.example.com/product"),
      rawImageUrl: imageUrl,
      sourceImageKey: "wardrobe/e2e/image-url-source.webp",
      sourceImageUrl: imageUrl,
    },
  };
}

function createE2ePersistenceDependencies(memory: E2eWardrobeMemory) {
  return {
    countWardrobeItemsImpl: async (payload) =>
      memory.countItems(payload?.source),
    listWardrobeItemsImpl: async (payload) => memory.listItems(payload?.source),
    listWardrobeItemsPageImpl: undefined,
    saveUploadedWardrobeItemsImpl: async (payload) =>
      memory.saveUploadedItems(
        String(payload?.email || E2E_EMAIL),
        Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload?.imageUrls)
            ? payload.imageUrls
            : [],
      ),
    saveWardrobeItemFromCatalogImpl: async (payload) =>
      memory.saveCatalogItem(String(payload?.email || E2E_EMAIL), payload?.url),
    deleteWardrobeItemFromCatalogImpl: async (payload) =>
      memory.deleteCatalogItem(payload?.url),
    getUploadedWardrobeItemImpl: async (payload) =>
      memory.getUploadedItem(payload?.id),
    deleteUploadedWardrobeItemImpl: async (payload) =>
      memory.deleteUploadedItem(payload?.id),
    updateUploadedWardrobeItemDetailsImpl: async (payload) =>
      memory.updateDetails(payload),
    updateUploadedWardrobeItemMetadataImpl: async (payload) =>
      memory.updateMetadata(payload),
    listLikedItemUrlsForUrlsImpl: async (payload) =>
      memory.listLikedItemUrls(payload?.itemUrls),
    listLikedItemUrlsImpl: async () => memory.listLikedItemUrls(),
    upsertLikedItemImpl: async ({ itemUrl }) => memory.likeItem(itemUrl),
    deleteLikedItemImpl: async ({ itemUrl }) => memory.unlikeItem(itemUrl),
  };
}

function createE2eWardrobeDependencies(memory: E2eWardrobeMemory) {
  return {
    ...createE2eAnalysisDependencies(),
    ...createE2ePersistenceDependencies(memory),
    ...createE2eUploadProcessingDependencies(memory),
    cleanupUploadedWardrobeItemImageImpl: async (payload) => ({
      cleanImage: {
        key: `${payload?.sourceKey || "uploaded-e2e"}.clean`,
        url: String(payload?.imageUrl || ""),
        digest: "e2e-clean-digest",
      },
      thumbnails: [],
    }),
    uploadWardrobeImageToR2Impl: async () => memory.nextUploadedImage(),
  };
}

export { createE2eWardrobeDependencies, E2eWardrobeMemory };
