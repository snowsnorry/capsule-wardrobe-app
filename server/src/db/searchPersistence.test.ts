import { afterEach, test, expect } from "vitest";
import {
  setSqlClientOverride,
  type SqlClientLike,
  type SqlResultLike,
} from "./core.js";
import { buildPriceBuckets, searchProducts } from "./searchPersistence.js";

afterEach(() => {
  setSqlClientOverride(null);
});

test("buildPriceBuckets returns a continuous bucket range with zero-count gaps", () => {
  expect(
    buildPriceBuckets(
      [
        { bucket: 1, count: 3, rangeMin: 0, rangeMax: 240 },
        { bucket: 3, count: 7, rangeMin: 0, rangeMax: 240 },
      ],
      4,
    ),
  ).toEqual([
    { key: "0:60", min: 0, max: 60, count: 3 },
    { key: "60:120", min: 60, max: 120, count: 0 },
    { key: "120:180", min: 120, max: 180, count: 7 },
    { key: "180:240", min: 180, max: 240, count: 0 },
  ]);
});

test("searchProducts applies liked-only filter with the profile email", async () => {
  const statements: string[] = [];
  const values: unknown[][] = [];
  const sql = createSearchSqlRecorder({ statements, values });
  setSqlClientOverride(sql);

  await searchProducts({
    likedOnly: true,
    profileEmail: "person@example.com",
  });

  expect(statements.join("\n")).toMatch(/from user_liked_items/i);
  expect(values.flat()).toContain(true);
  expect(values.flat()).toContain("person@example.com");
});

test("searchProducts passes search SQL file parameters in alias order", async () => {
  const statements: string[] = [];
  const values: unknown[][] = [];
  const sql = createSearchSqlRecorder({ statements, values });
  setSqlClientOverride(sql);

  await searchProducts({
    audience: ["woman"],
    brand: ["cos"],
    category: ["coat"],
    closureType: ["zip"],
    color: ["red"],
    fit: ["regular"],
    formalityLevel: ["formal"],
    likedOnly: true,
    limit: 24,
    occasions: ["office"],
    offset: 48,
    pattern: ["solid"],
    priceMax: 100,
    priceMin: 10,
    profileEmail: " person@example.com ",
    queryEmbedding: [0.1, 0.2],
    season: ["winter"],
    semanticDistanceThreshold: 0.4,
    silhouette: ["straight"],
    style: ["classic"],
    textQuery: " Red Coat ",
    textSearchMode: "hybrid",
    urlPrefix: "https://shop.example/item",
  });

  expect(statements).toHaveLength(2);
  expect(
    statements.every((statement) => statement.includes("query_params")),
  ).toBe(true);
  const countValues =
    values[findStatementIndex(statements, "count(*)::integer")];
  const itemValues = values[findStatementIndex(statements, "result_limit")];

  expect(countValues).toEqual([
    "[0.1,0.2]",
    "red coat",
    "red coat%",
    "%red coat%",
    ["cos"],
    "https://shop.example/item%",
    10,
    100,
    true,
    "person@example.com",
    ["woman"],
    ["coat"],
    ["winter"],
    ["formal"],
    ["classic"],
    ["office"],
    ["red"],
    ["solid"],
    ["straight"],
    ["regular"],
    ["zip"],
    "hybrid",
    0.4,
  ]);
  expect(itemValues).toEqual([...countValues, 24, 48]);
});

test("searchProducts qualifies result columns that overlap with query params", async () => {
  const statements: string[] = [];
  const values: unknown[][] = [];
  const sql = createSearchSqlRecorder({ statements, values });
  setSqlClientOverride(sql);

  await searchProducts({ brand: ["cos"] });

  const itemStatement =
    statements[findStatementIndex(statements, "result_limit")];

  expect(itemStatement).toContain("matching_products.brand");
  expect(itemStatement).toContain("matching_products.audience");
  expect(itemStatement).toContain("matching_products.category");
  expect(itemStatement).not.toMatch(/\bcoalesce\(brand,/i);
  expect(itemStatement).not.toMatch(/\bcoalesce\(name,/i);
});

test("searchProducts keeps array filters and vector distance aligned with the products performance contract", async () => {
  const statements: string[] = [];
  const values: unknown[][] = [];
  const sql = createSearchSqlRecorder({ statements, values });
  setSqlClientOverride(sql);

  await searchProducts({
    color: ["black"],
    queryEmbedding: [0.1, 0.2],
    season: ["winter"],
    textSearchMode: "semantic",
  });

  const joinedStatements = statements.join("\n");

  expect(joinedStatements).toContain("$1::vector(1024)");
  expect(joinedStatements).toContain("products.embedding::vector(1024)");
  expect(joinedStatements).toContain("vector_dims(products.embedding) <> 1024");
  expect(joinedStatements).not.toContain("products.*");
  expect(joinedStatements).not.toContain("filtered_products.*");
  expect(joinedStatements).toContain("products.season && params.season");
  expect(joinedStatements).toContain("products.color_base && params.color");
  expect(joinedStatements).not.toContain(
    "coalesce(products.season, ARRAY[]::text[]) && params.season",
  );
  expect(joinedStatements).not.toContain(
    "coalesce(products.color_base, ARRAY[]::text[]) && params.color",
  );
  expect(joinedStatements).not.toContain("product_colors");
});

test("searchProducts adds exact-color matching only when exactColor is active", async () => {
  const statements: string[] = [];
  const values: unknown[][] = [];
  const sql = createSearchSqlRecorder({ statements, values });
  setSqlClientOverride(sql);

  await searchProducts({ exactColor: "#808080" });

  expect(statements).toHaveLength(2);
  expect(
    statements.every((statement) => statement.includes("product_colors")),
  ).toBe(true);
  expect(statements.every((statement) => statement.includes("share >="))).toBe(
    true,
  );
  expect(
    statements.every((statement) => statement.includes("color_distance")),
  ).toBe(true);
  const countValues =
    values[findStatementIndex(statements, "count(*)::integer")];
  const itemValues = values[findStatementIndex(statements, "result_limit")];
  expect(countValues.slice(-3)).toEqual([
    expect.stringMatching(/^\[/),
    0.08,
    10,
  ]);
  expect(itemValues.slice(-3)).toEqual([
    expect.stringMatching(/^\[/),
    0.08,
    10,
  ]);
  expect(statements.join("\n")).toContain('AS "matchedColor"');
  expect(statements.join("\n")).toContain("matching_products.url ASC");
});

test.each([
  ["closest", 4],
  ["close", 7],
  ["balanced", 10],
  ["broad", 15],
  ["broadest", 20],
] as const)(
  "searchProducts maps the %s exact-color range to distance %i",
  async (exactColorRange, expectedDistance) => {
    const statements: string[] = [];
    const values: unknown[][] = [];
    const sql = createSearchSqlRecorder({ statements, values });
    setSqlClientOverride(sql);

    await searchProducts({ exactColor: "#808080", exactColorRange });

    expect(
      values[findStatementIndex(statements, "count(*)::integer")].at(-1),
    ).toBe(expectedDistance);
    expect(values[findStatementIndex(statements, "result_limit")].at(-1)).toBe(
      expectedDistance,
    );
  },
);

function createSearchSqlRecorder({
  statements,
  values,
}: {
  statements: string[];
  values: unknown[][];
}): SqlClientLike {
  const query = async <TRow = unknown>(
    queryText: string,
    queryValues: readonly unknown[] = [],
  ): Promise<SqlResultLike<TRow>> => {
    statements.push(queryText.replace(/\s+/g, " ").trim());
    values.push([...queryValues]);
    return queryText.includes("count(*)::integer")
      ? ([{ total: 0 }] as TRow[])
      : ([] as TRow[]);
  };

  return Object.assign(
    async <TRow = unknown>(
      strings: TemplateStringsArray,
      ...queryValues: readonly unknown[]
    ): Promise<SqlResultLike<TRow>> => {
      statements.push(strings.join("?").replace(/\s+/g, " ").trim());
      values.push([...queryValues]);
      return [] as TRow[];
    },
    { query },
  ) as SqlClientLike;
}

function findStatementIndex(statements: string[], pattern: string): number {
  const index = statements.findIndex((statement) =>
    statement.includes(pattern),
  );
  expect(index).toBeGreaterThanOrEqual(0);
  return index;
}
