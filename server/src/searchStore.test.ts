import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SEARCH_STATE,
  createSearchStore,
  getRelaxedSemanticDistanceThreshold,
  getSemanticDistanceThreshold,
  isHttpUrlQuery,
  normalizeSearchPayload,
  resolveSearchEmbedding,
  serializeSearchRow
} from "./searchStore.js";

function createSearchStoreDeps(overrides = {}) {
  return {
    getDistinctProductBrandsImpl: async () => [{ value: "cos", label: "COS" }],
    getDistinctProductCategoriesImpl: async () => ["top"],
    getDistinctProductSeasonsImpl: async () => ["summer"],
    getDistinctProductFormalityLevelsImpl: async () => ["casual"],
    getStylesImpl: async () => ["minimalistic"],
    getDistinctProductOccasionsImpl: async () => ["office"],
    getDistinctProductColorsImpl: async () => ["blue"],
    getDistinctProductPatternsImpl: async () => ["solid"],
    getDistinctProductSilhouettesImpl: async () => ["straight"],
    getDistinctProductFitsImpl: async () => ["regular"],
    getDistinctProductClosureTypesImpl: async () => ["button"],
    getProductPriceRangeImpl: async () => ({ min: 10, max: 100 }),
    getSearchByEmailImpl: async () => null,
    upsertSearchByEmailImpl: async (payload) => payload,
    searchProductsImpl: async () => ({ total: 1, page: 1, pageSize: 24, items: [{ id: "product-1" }] }),
    searchProductStatsImpl: async (payload) => ({ payload }),
    resolveSearchEmbeddingImpl: async () => [0.1, 0.2],
    ...overrides
  };
}

test("normalizeSearchPayload normalizes nullable scalar filters and arrays", () => {
  assert.deepEqual(
    normalizeSearchPayload({
      query: "  linen summer shirt ",
      brand: [" Cos ", "cos", "", null],
      audience: [" WOMAN ", "woman"],
      category: [" Top ", "top"],
      season: [" Summer ", "summer", "", null],
      formalityLevel: [" Casual ", "casual"],
      style: [" Minimalistic ", "minimalistic"],
      occasions: [" office ", "Office", "date_night"],
      color: [" Blue ", "blue"],
      pattern: [" Stripe ", "stripe"],
      silhouette: [" relaxed ", "relaxed"],
      fit: [" tailored ", "tailored"],
      closureType: [" Buttons ", "buttons"],
      priceMin: 12.5,
      priceMax: 99,
      page: 2
    }),
    {
      query: "linen summer shirt",
      brand: ["cos"],
      priceMin: 12.5,
      priceMax: 99,
      audience: ["woman"],
      category: ["top"],
      season: ["summer"],
      formalityLevel: ["casual"],
      style: ["minimalistic"],
      occasions: ["office", "date_night"],
      color: ["blue"],
      pattern: ["stripe"],
      silhouette: ["relaxed"],
      fit: ["tailored"],
      closureType: ["buttons"],
      page: 2
    }
  );
});

test("normalizeSearchPayload keeps invalid numeric values as NaN for validation", () => {
  const result = normalizeSearchPayload({ priceMin: "abc", priceMax: "" });
  assert.equal(Number.isNaN(result.priceMin), true);
  assert.equal(result.priceMax, null);
});

test("serializeSearchRow returns normalized defaults when row is missing", () => {
  assert.deepEqual(serializeSearchRow(null), DEFAULT_SEARCH_STATE);
});

test("serializeSearchRow maps persisted row fields to client shape", () => {
  assert.deepEqual(
    serializeSearchRow({
      query: "blue blazer",
      brand: ["cos"],
      priceMin: 10,
      priceMax: 100,
      audience: ["woman"],
      category: ["top"],
      season: ["autumn", "winter"],
      formalityLevel: ["smart_casual"],
      style: ["minimalistic"],
      occasions: ["office"],
      color: ["blue"],
      pattern: ["solid"],
      silhouette: ["relaxed"],
      fit: ["tailored"],
      closureType: ["zip"],
      page: 3
    }),
    {
      query: "blue blazer",
      brand: ["cos"],
      priceMin: 10,
      priceMax: 100,
      audience: ["woman"],
      category: ["top"],
      season: ["autumn", "winter"],
      formalityLevel: ["smart_casual"],
      style: ["minimalistic"],
      occasions: ["office"],
      color: ["blue"],
      pattern: ["solid"],
      silhouette: ["relaxed"],
      fit: ["tailored"],
      closureType: ["zip"],
      page: 3
    }
  );
});

test("getSemanticDistanceThreshold returns adaptive thresholds by query length", () => {
  assert.equal(getSemanticDistanceThreshold(""), null);
  assert.equal(getSemanticDistanceThreshold("linen shirt"), 0.4);
  assert.equal(getSemanticDistanceThreshold("relaxed linen shirt for spring office"), 0.35);
  assert.equal(
    getSemanticDistanceThreshold("relaxed linen shirt for spring office days with minimalistic tailoring and soft structure"),
    0.31
  );
});

test("getRelaxedSemanticDistanceThreshold adds fallback slack without exceeding cap", () => {
  assert.equal(getRelaxedSemanticDistanceThreshold(""), null);
  assert.ok(Math.abs(getRelaxedSemanticDistanceThreshold("linen shirt") - 0.48) < 1e-9);
  assert.ok(
    Math.abs(
      getRelaxedSemanticDistanceThreshold(
        "relaxed linen shirt for spring office days with minimalistic tailoring and soft structure"
      ) - 0.39
    ) < 1e-9
  );
});

test("isHttpUrlQuery only accepts http and https URLs", () => {
  assert.equal(isHttpUrlQuery("https://example.com/products/1"), true);
  assert.equal(isHttpUrlQuery("http://example.com/products/1"), true);
  assert.equal(isHttpUrlQuery("linen shirt"), false);
  assert.equal(isHttpUrlQuery("mailto:person@example.com"), false);
  assert.equal(isHttpUrlQuery("ftp://example.com/products/1"), false);
});

test("resolveSearchEmbedding reuses persisted embedding when query is unchanged", async () => {
  const embedding = [0.1, 0.2, 0.3];

  await assert.doesNotReject(async () => {
    const result = await resolveSearchEmbedding({
      currentSearch: {
        query: "blue blazer",
        embedding
      },
      query: "blue blazer"
    });

    assert.equal(result, embedding);
  });
});

test("resolveSearchEmbedding clears embedding for empty query", async () => {
  await assert.doesNotReject(async () => {
    const result = await resolveSearchEmbedding({
      currentSearch: {
        query: "blue blazer",
        embedding: [0.1, 0.2, 0.3]
      },
      query: ""
    });

    assert.equal(result, null);
  });
});

test("resolveSearchEmbedding skips embedding for URL queries", async () => {
  await assert.doesNotReject(async () => {
    const result = await resolveSearchEmbedding({
      currentSearch: {
        query: "https://example.com/products/1",
        embedding: [0.1, 0.2, 0.3]
      },
      query: "https://example.com/products/1"
    });

    assert.equal(result, null);
  });
});

test("createSearchStore builds options and saved search from injected persistence", async () => {
  const store = createSearchStore(createSearchStoreDeps({
    getSearchByEmailImpl: async () => ({
      query: " saved ",
      brand: ["cos"],
      page: 2
    })
  }));

  assert.deepEqual(await store.getSearchOptions("person@example.com"), {
    brands: [{ value: "cos", label: "COS" }],
    categories: ["top"],
    seasons: ["summer"],
    formalityLevels: ["casual"],
    styles: ["minimalistic"],
    occasions: ["office"],
    audience: ["woman", "man", "all"],
    colors: ["blue"],
    patterns: ["solid"],
    silhouettes: ["straight"],
    fits: ["regular"],
    closureTypes: ["button"],
    priceRange: { min: 10, max: 100 }
  });

  assert.equal((await store.getSavedSearch("person@example.com")).query, " saved ");
});

test("runSavedSearch uses URL prefix for URL queries and skips embeddings", async () => {
  const productCalls = [];
  const upsertCalls = [];
  const store = createSearchStore(createSearchStoreDeps({
    upsertSearchByEmailImpl: async (payload) => {
      upsertCalls.push(payload);
      return payload;
    },
    searchProductsImpl: async (payload) => {
      productCalls.push(payload);
      return { total: 1, page: 1, pageSize: 24, items: [] };
    },
    resolveSearchEmbeddingImpl: async () => {
      throw new Error("unexpected embedding");
    }
  }));

  const result = await store.runSavedSearch("person@example.com", {
    query: "https://example.com/products/1",
    category: ["top"]
  });

  assert.equal(result.total, 1);
  assert.equal(upsertCalls[0].embedding, null);
  assert.equal(productCalls.length, 1);
  assert.equal(productCalls[0].urlPrefix, "https://example.com/products/1");
  assert.equal(productCalls[0].queryEmbedding, null);
});

test("runSavedSearch retries text searches with relaxed semantic threshold when first result is empty", async () => {
  const productCalls = [];
  const store = createSearchStore(createSearchStoreDeps({
    searchProductsImpl: async (payload) => {
      productCalls.push(payload);
      return productCalls.length === 1
        ? { total: 0, page: 1, pageSize: 24, items: [] }
        : { total: 2, page: 1, pageSize: 24, items: [{ id: "p1" }, { id: "p2" }] };
    }
  }));

  const result = await store.runSavedSearch("person@example.com", {
    query: "linen shirt",
    category: ["top"]
  });

  assert.equal(result.total, 2);
  assert.equal(productCalls.length, 2);
  assert.equal(productCalls[0].semanticDistanceThreshold, 0.4);
  assert.ok(Math.abs(productCalls[1].semanticDistanceThreshold - 0.48) < 1e-9);
  assert.deepEqual(result.savedSearch.category, ["top"]);
});

test("getSearchStats validates payload and delegates normalized filters", async () => {
  let statsPayload = null;
  const store = createSearchStore(createSearchStoreDeps({
    searchProductStatsImpl: async (payload) => {
      statsPayload = payload;
      return { ok: true };
    }
  }));

  assert.deepEqual(await store.getSearchStats("person@example.com", { category: ["top"] }), { ok: true });
  assert.deepEqual(statsPayload.category, ["top"]);

  await assert.rejects(
    () => store.getSearchStats("person@example.com", { category: ["dress"] }),
    /invalid_payload/
  );
});
