import { test, expect, afterEach } from "vitest";
import {
  setSqlClientOverride,
  type SqlClientLike,
  type SqlResultLike,
} from "./core.js";
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
  hasProfileByEmail,
} from "./productOptions.js";
import {
  getProductByIdForEmail,
  getProductByUrlForEmail,
  getProductsByUrlsForEmailInOrder,
} from "./productLookup.js";

function useQueuedSql(results: SqlResultLike[]) {
  const statements: string[] = [];
  const values: unknown[][] = [];
  const sql = (async (
    strings: TemplateStringsArray,
    ...queryValues: readonly unknown[]
  ) => {
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
    [
      { value: "acme", label: "ACME" },
      { value: "", label: "Blank" },
      { value: "ghost", label: null },
    ],
    [{ value: "top" }],
    [{ value: "straight" }],
    [{ value: "relaxed" }],
    [{ value: "zip" }],
    [{ value: "black" }],
  ]);

  expect(await hasProfileByEmail("person@example.com")).toBe(true);
  expect(await getDistinctProductFormalityLevels()).toEqual(["casual"]);
  expect(await getDistinctProductOccasions()).toEqual(["office"]);
  expect(await getDistinctProductSeasons()).toEqual(["spring"]);
  expect(await getDistinctProductPatterns()).toEqual(["solid"]);
  expect(await getDistinctProductBrands()).toEqual([
    { value: "acme", label: "ACME" },
  ]);
  expect(await getDistinctProductCategories()).toEqual(["top"]);
  expect(await getDistinctProductSilhouettes()).toEqual(["straight"]);
  expect(await getDistinctProductFits()).toEqual(["relaxed"]);
  expect(await getDistinctProductClosureTypes()).toEqual(["zip"]);
  expect(await getDistinctProductColors()).toEqual(["black"]);
});

test("getProductPriceRange converts database numeric values and keeps missing bounds null", async () => {
  useQueuedSql([[{ min: "12.50", max: 99 }], [{ min: null, max: undefined }]]);

  expect(await getProductPriceRange()).toEqual({ min: 12.5, max: 99 });
  expect(await getProductPriceRange()).toEqual({ min: null, max: null });
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
    closureType: [],
  };
  const { statements, values } = useQueuedSql([
    [product],
    [{ ...product, embedding: [0.1, 0.2] }],
  ]);

  expect(await getProductsByUrlsInOrder([])).toEqual([]);
  expect(await getProductsByUrlsInOrder([" ", null])).toEqual([]);
  expect(
    await getProductsByUrlsInOrder([" https://example.com/shirt ", ""]),
  ).toEqual([product]);
  expect(
    await getProductsWithEmbeddingsByUrlsInOrder(["https://example.com/shirt"]),
  ).toEqual([{ ...product, embedding: [0.1, 0.2] }]);
  expect(statements[0]).not.toMatch(/\bembedding\b/i);
  expect(statements[1]).not.toMatch(/products\.\*/i);
  expect(statements[1]).toMatch(/products\.embedding/i);
  expect(values[0]).toEqual([["https://example.com/shirt"]]);
  expect(values[1]).toEqual([["https://example.com/shirt"]]);
});

test("product MCP fetch lookups include wardrobe saved state by id and exact url", async () => {
  const product = {
    id: "p1",
    name: "Shirt",
    url: "https://example.com/shirt",
    distance: null,
    isSavedToWardrobe: true,
  };
  const { statements, values } = useQueuedSql([[product], [product]]);

  expect(await getProductByIdForEmail(" p1 ", "person@example.com")).toEqual(
    product,
  );
  expect(
    await getProductByUrlForEmail(
      " https://example.com/shirt ",
      "person@example.com",
    ),
  ).toEqual(product);

  expect(statements[0]).toMatch(/where products\.id =/i);
  expect(statements[0]).toMatch(/wardrobe\.profile_email =/i);
  expect(statements[0]).not.toMatch(/\bembedding\b/i);
  expect(statements[1]).toMatch(/where products\.url =/i);
  expect(statements[1]).toMatch(/wardrobe\.source = 'from_catalog'/i);
  expect(statements[1]).not.toMatch(/\bembedding\b/i);
  expect(values[0]).toEqual(["person@example.com", "person@example.com", "p1"]);
  expect(values[1]).toEqual([
    "person@example.com",
    "person@example.com",
    "https://example.com/shirt",
  ]);
  expect(await getProductByIdForEmail("", "person@example.com")).toBeNull();
  expect(await getProductByUrlForEmail("", "person@example.com")).toBeNull();
});

test("product URL batch lookup includes profile saved state", async () => {
  const product = {
    id: "p1",
    name: "Shirt",
    url: "https://example.com/shirt",
    distance: null,
    isSavedToWardrobe: true,
  };
  const { statements, values } = useQueuedSql([[product]]);

  expect(
    await getProductsByUrlsForEmailInOrder({ email: "", urls: [] }),
  ).toEqual([]);
  expect(
    await getProductsByUrlsForEmailInOrder({
      email: "person@example.com",
      urls: [" https://example.com/shirt "],
    }),
  ).toEqual([product]);
  expect(statements[0]).toMatch(/from unnest/i);
  expect(statements[0]).toMatch(/wardrobe\.source = 'from_catalog'/i);
  expect(statements[0]).not.toMatch(/\bembedding\b/i);
  expect(values[0]).toEqual([
    "person@example.com",
    ["https://example.com/shirt"],
  ]);
});
