import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SEARCH_STATE,
  getRelaxedSemanticDistanceThreshold,
  getSemanticDistanceThreshold,
  normalizeSearchPayload,
  resolveSearchEmbedding,
  serializeSearchRow
} from "./searchStore.js";

test("normalizeSearchPayload normalizes nullable scalar filters and arrays", () => {
  assert.deepEqual(
    normalizeSearchPayload({
      query: "  linen summer shirt ",
      brand: " Cos ",
      audience: " WOMAN ",
      category: " Top ",
      season: [" Summer ", "summer", "", null],
      formalityLevel: " Casual ",
      style: " Minimalistic ",
      occasions: [" office ", "Office", "date_night"],
      color: " Blue ",
      pattern: " Stripe ",
      silhouette: " relaxed ",
      fit: " tailored ",
      closureType: " Buttons ",
      priceMin: "12.5",
      priceMax: 99,
      page: "2"
    }),
    {
      query: "linen summer shirt",
      brand: "cos",
      priceMin: 12.5,
      priceMax: 99,
      audience: "woman",
      category: "top",
      season: ["summer"],
      formalityLevel: "casual",
      style: "minimalistic",
      occasions: ["office", "date_night"],
      color: "blue",
      pattern: "stripe",
      silhouette: "relaxed",
      fit: "tailored",
      closureType: "buttons",
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
      brand: "cos",
      priceMin: 10,
      priceMax: 100,
      audience: "woman",
      category: "top",
      season: ["autumn", "winter"],
      formalityLevel: "smart_casual",
      style: "minimalistic",
      occasions: ["office"],
      color: "blue",
      pattern: "solid",
      silhouette: "relaxed",
      fit: "tailored",
      closureType: "zip",
      page: 3
    }),
    {
      query: "blue blazer",
      brand: "cos",
      priceMin: 10,
      priceMax: 100,
      audience: "woman",
      category: "top",
      season: ["autumn", "winter"],
      formalityLevel: "smart_casual",
      style: "minimalistic",
      occasions: ["office"],
      color: "blue",
      pattern: "solid",
      silhouette: "relaxed",
      fit: "tailored",
      closureType: "zip",
      page: 3
    }
  );
});

test("getSemanticDistanceThreshold returns adaptive thresholds by query length", () => {
  assert.equal(getSemanticDistanceThreshold(""), null);
  assert.equal(getSemanticDistanceThreshold("linen shirt"), 0.45);
  assert.equal(getSemanticDistanceThreshold("relaxed linen shirt for spring office"), 0.4);
  assert.equal(
    getSemanticDistanceThreshold("relaxed linen shirt for spring office days with minimalistic tailoring and soft structure"),
    0.36
  );
});

test("getRelaxedSemanticDistanceThreshold adds fallback slack without exceeding cap", () => {
  assert.equal(getRelaxedSemanticDistanceThreshold(""), null);
  assert.equal(getRelaxedSemanticDistanceThreshold("linen shirt"), 0.53);
  assert.equal(
    getRelaxedSemanticDistanceThreshold("relaxed linen shirt for spring office days with minimalistic tailoring and soft structure"),
    0.44
  );
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
