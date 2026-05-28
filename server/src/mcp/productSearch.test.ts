import { test, expect } from "vitest";
import { createMcpProductSearchRunner } from "./productSearch.js";

function createSearchOptions() {
  return {
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
    priceRange: { min: 10, max: 100 },
  };
}

test("MCP product search is read-only and skips embeddings for filter-only search", async () => {
  const productCalls = [];
  const runSearch = createMcpProductSearchRunner({
    getSearchOptionsImpl: async () => createSearchOptions(),
    getSearchByEmailImpl: async () => {
      throw new Error("unexpected saved search read");
    },
    searchProductsImpl: async (payload) => {
      productCalls.push(payload);
      return { total: 1, page: 1, pageSize: 50, items: [{ id: "p1" }] };
    },
    resolveSearchEmbeddingImpl: async () => {
      throw new Error("unexpected embedding");
    },
  });

  const result = await runSearch("person@example.com", {
    category: ["top"],
    offset: 10,
    limit: 75,
  });

  expect(result).toEqual({
    items: [{ id: "p1" }],
    total: 1,
    offset: 10,
    limit: 50,
  });
  expect(productCalls[0]).toMatchObject({
    profileEmail: "person@example.com",
    category: ["top"],
    queryEmbedding: null,
    semanticDistanceThreshold: null,
    offset: 10,
    limit: 50,
  });
});

test("MCP product search uses lexical search for short text queries", async () => {
  const productCalls = [];
  const runSearch = createMcpProductSearchRunner({
    getSearchOptionsImpl: async () => createSearchOptions(),
    getSearchByEmailImpl: async () => {
      throw new Error("unexpected saved search read");
    },
    searchProductsImpl: async (payload) => {
      productCalls.push(payload);
      return { total: 1, page: 1, pageSize: 20, items: [{ id: "p2" }] };
    },
    resolveSearchEmbeddingImpl: async () => {
      throw new Error("unexpected embedding");
    },
  });

  const result = await runSearch("person@example.com", {
    query: "black blazer",
  });

  expect(result.total).toBe(1);
  expect(productCalls).toHaveLength(1);
  expect(productCalls[0]).toMatchObject({
    profileEmail: "person@example.com",
    queryEmbedding: null,
    semanticDistanceThreshold: null,
    textQuery: "black blazer",
    textSearchMode: "lexical",
    offset: 0,
    limit: 20,
  });
});

test("MCP product search falls back to semantic search when lexical search is empty", async () => {
  const productCalls = [];
  let savedSearchReads = 0;
  const fallbackEmbedding = [0.6, 0.7];
  const runSearch = createMcpProductSearchRunner({
    getSearchOptionsImpl: async () => createSearchOptions(),
    getSearchByEmailImpl: async () => {
      savedSearchReads += 1;
      return { query: "other", embedding: [0.1, 0.2] };
    },
    searchProductsImpl: async (payload) => {
      productCalls.push(payload);
      return productCalls.length === 1
        ? { total: 0, page: 1, pageSize: 20, items: [] }
        : { total: 1, page: 1, pageSize: 20, items: [{ id: "p3" }] };
    },
    resolveSearchEmbeddingImpl: async () => fallbackEmbedding,
  });

  const result = await runSearch("person@example.com", {
    query: "сумка",
    category: ["top"],
  });

  expect(result.total).toBe(1);
  expect(savedSearchReads).toBe(1);
  expect(productCalls).toHaveLength(2);
  expect(productCalls[0]).toMatchObject({
    category: ["top"],
    queryEmbedding: null,
    semanticDistanceThreshold: null,
    textQuery: "сумка",
    textSearchMode: "lexical",
  });
  expect(productCalls[1]).toMatchObject({
    category: ["top"],
    queryEmbedding: fallbackEmbedding,
    semanticDistanceThreshold: 0.4,
    textQuery: "сумка",
    textSearchMode: "semantic",
  });
});

test("MCP product search uses hybrid search and fallback for medium text queries", async () => {
  const productCalls = [];
  let savedSearchReads = 0;
  const runSearch = createMcpProductSearchRunner({
    getSearchOptionsImpl: async () => createSearchOptions(),
    getSearchByEmailImpl: async () => {
      savedSearchReads += 1;
      return { query: "other", embedding: [0.4, 0.5] };
    },
    searchProductsImpl: async (payload) => {
      productCalls.push(payload);
      return productCalls.length === 1
        ? { total: 0, page: 1, pageSize: 20, items: [] }
        : { total: 1, page: 1, pageSize: 20, items: [{ id: "p2" }] };
    },
    resolveSearchEmbeddingImpl: async () => [0.1, 0.2],
  });

  const result = await runSearch("person@example.com", {
    query: "black blazer for office outfits",
  });

  expect(result.total).toBe(1);
  expect(savedSearchReads).toBe(1);
  expect(productCalls.length).toBe(2);
  expect(productCalls[0]).toMatchObject({
    profileEmail: "person@example.com",
    queryEmbedding: [0.1, 0.2],
    semanticDistanceThreshold: 0.35,
    textQuery: "black blazer for office outfits",
    textSearchMode: "hybrid",
    offset: 0,
    limit: 20,
  });
  expect(
    Math.abs(productCalls[1].semanticDistanceThreshold - 0.43) < 1e-9,
  ).toBeTruthy();
});
