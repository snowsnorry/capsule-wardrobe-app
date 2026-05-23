function createBlackBlazerProduct() {
  return {
    id: "product-1",
    name: "Black Blazer",
    url: "https://example.com/products/black-blazer",
    description: "A tailored black blazer.",
    brand: "Acme",
    price: 120,
    currency: "USD",
    availability: "in_stock",
    imageUrl: "https://example.com/products/black-blazer.jpg",
    audience: "woman",
    category: "jacket",
    season: ["autumn", "winter"],
    formalityLevel: ["formal"],
    style: ["minimalistic"],
    occasions: ["office"],
    colorBase: ["black"],
    pattern: "solid",
    finish: "matte",
    isNeutral: true,
    composition: "wool",
    silhouette: "tailored",
    fit: "regular",
    closureType: ["button"],
    distance: 0.1,
    savedSearch: { query: "black blazer" },
    isSavedToWardrobe: true,
  };
}

export function createSearchAndGenerationDependencies() {
  const product = createBlackBlazerProduct();

  return {
    getSearchOptionsImpl: async () => ({
      brands: [{ value: "zara", label: "Zara" }],
      categories: ["top", "outerwear"],
      seasons: ["autumn", "winter"],
      formalityLevels: ["casual", "formal"],
      styles: ["minimalistic"],
      occasions: ["office"],
      audience: ["woman", "man", "all"],
      colors: ["black"],
      patterns: ["solid"],
      silhouettes: ["straight"],
      fits: ["regular"],
      closureTypes: ["button"],
      priceRange: { min: 10, max: 250 },
    }),
    getSavedSearchImpl: async () => ({ query: "coat", page: 1 }),
    getSearchStatsImpl: async () => ({
      total: 3,
      stats: { category: [{ value: "top", count: 3 }] },
      priceBuckets: [],
    }),
    runSavedSearchImpl: async (_email, payload) => ({
      items: [{ id: "1" }],
      total: 1,
      search: payload,
    }),
    runMcpProductSearchImpl: async (_email, payload) => ({
      items: [{ ...product }],
      total: 1,
      offset: payload.offset ?? 0,
      limit: Math.min(payload.limit ?? 20, 50),
    }),
    getProductByIdForEmailImpl: async (id) =>
      id === product.id ? { ...product } : null,
    getProductByUrlForEmailImpl: async (url) =>
      url === product.url ? { ...product } : null,
    getOutfitSetImageJobImpl: async () => null,
    streamCapsuleEventsImpl: async (_req, res, { snapshot }) =>
      res.json({ ok: true, snapshot }),
    regenerateCapsuleWardrobeHandler: async (_req, res) =>
      res.status(202).json({ ok: true, status: "pending", items: [] }),
    regenerateSelectedCapsuleItemsHandler: async (_req, res) =>
      res.json({ ok: true, items: [] }),
    generateOutfitSetImageHandler: async (_req, res) =>
      res.status(202).json({ ok: true, status: "pending" }),
    buildWardrobePdfInChildImpl: async () => Buffer.from("pdf"),
    getProductsByUrlsInOrderImpl: async () => [
      { url: "https://example.com/1" },
    ],
    checkDatabaseConnectionImpl: async () => {},
  };
}
