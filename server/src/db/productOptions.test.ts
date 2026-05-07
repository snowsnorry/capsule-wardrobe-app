import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { setSqlClientOverride, type SqlClientLike, type SqlResultLike } from "./core.js";
import {
  getDistinctProductBrands,
  getDistinctProductCategories,
  getDistinctProductClosureTypes,
  getDistinctProductColors,
  getDistinctProductFits,
  getDistinctProductFormalityLevels,
  getDistinctProductOccasions,
  getDistinctProductPatterns,
  getDistinctProductSeasons,
  getDistinctProductSilhouettes,
  getProductPriceRange,
  getProductsByUrlsInOrder,
  getProductsWithEmbeddingsByUrlsInOrder,
  hasProfileByEmail
} from "./productOptions.js";

function useQueuedSql(results: SqlResultLike[]) {
  const statements: string[] = [];
  const values: unknown[][] = [];
  const sql = (async (strings: TemplateStringsArray, ...queryValues: readonly unknown[]) => {
    statements.push(strings.join("?").replace(/\s+/g, " ").trim());
    values.push([...queryValues]);
    return results.shift() ?? [];
  }) as SqlClientLike;

  setSqlClientOverride(sql);
  return { statements, values };
}

afterEach(() => {
  setSqlClientOverride(null);
});

test("product option lookups normalize rows and filter blank values", async () => {
  useQueuedSql([
    [{ hasProfile: true }],
    [{ value: "casual" }, { value: "" }, { value: null }],
    [{ value: "office" }, { value: null }],
    [{ value: "spring" }],
    [{ value: "solid" }],
    [{ value: "acme", label: "ACME" }, { value: "", label: "Blank" }, { value: "ghost", label: null }],
    [{ value: "top" }],
    [{ value: "straight" }],
    [{ value: "relaxed" }],
    [{ value: "zip" }],
    [{ value: "black" }]
  ]);

  assert.equal(await hasProfileByEmail("person@example.com"), true);
  assert.deepEqual(await getDistinctProductFormalityLevels(), ["casual"]);
  assert.deepEqual(await getDistinctProductOccasions(), ["office"]);
  assert.deepEqual(await getDistinctProductSeasons(), ["spring"]);
  assert.deepEqual(await getDistinctProductPatterns(), ["solid"]);
  assert.deepEqual(await getDistinctProductBrands(), [{ value: "acme", label: "ACME" }]);
  assert.deepEqual(await getDistinctProductCategories(), ["top"]);
  assert.deepEqual(await getDistinctProductSilhouettes(), ["straight"]);
  assert.deepEqual(await getDistinctProductFits(), ["relaxed"]);
  assert.deepEqual(await getDistinctProductClosureTypes(), ["zip"]);
  assert.deepEqual(await getDistinctProductColors(), ["black"]);
});

test("getProductPriceRange converts database numeric values and keeps missing bounds null", async () => {
  useQueuedSql([
    [{ min: "12.50", max: 99 }],
    [{ min: null, max: undefined }]
  ]);

  assert.deepEqual(await getProductPriceRange(), { min: 12.5, max: 99 });
  assert.deepEqual(await getProductPriceRange(), { min: null, max: null });
});

test("product url lookups short-circuit empty input and preserve normalized url order", async () => {
  const product = {
    id: "p1",
    name: "Shirt",
    url: "https://example.com/shirt",
    description: null,
    brand: "Acme",
    price: 10,
    currency: "USD",
    availability: "in_stock",
    imageUrl: null,
    audience: "woman",
    category: "top",
    season: ["spring"],
    formalityLevel: ["casual"],
    style: ["minimalistic"],
    occasions: ["office"],
    colorBase: ["black"],
    pattern: "solid",
    finish: null,
    isNeutral: true,
    composition: null,
    silhouette: null,
    fit: null,
    closureType: []
  };
  const { values } = useQueuedSql([[product], [{ ...product, embedding: [0.1, 0.2] }]]);

  assert.deepEqual(await getProductsByUrlsInOrder([]), []);
  assert.deepEqual(await getProductsByUrlsInOrder([" ", null]), []);
  assert.deepEqual(await getProductsByUrlsInOrder([" https://example.com/shirt ", ""]), [product]);
  assert.deepEqual(await getProductsWithEmbeddingsByUrlsInOrder(["https://example.com/shirt"]), [
    { ...product, embedding: [0.1, 0.2] }
  ]);
  assert.deepEqual(values[0], [["https://example.com/shirt"]]);
  assert.deepEqual(values[1], [["https://example.com/shirt"]]);
});
