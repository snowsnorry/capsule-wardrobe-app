import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";

const CONTRACT_SQL_FILE = new URL(
  "./sql/products_performance_contract.sql",
  import.meta.url,
);

async function readContractSql() {
  return (await readFile(CONTRACT_SQL_FILE, "utf8"))
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

test("products performance contract documents existing identity indexes without duplicating url indexes", async () => {
  const sql = await readContractSql();

  expect(sql).toContain("products_pkey/products_url_key");
  expect(sql).toContain("products_id_key");
  expect(sql).toContain(
    "create unique index concurrently if not exists products_id_key",
  );
  expect(sql).not.toMatch(/create\s+unique\s+index[^;]+products_url/i);
});

test("products performance contract covers search scalar, array, lexical, price, and vector access paths", async () => {
  const sql = await readContractSql();

  expect(sql).toContain("create extension if not exists pg_trgm");

  for (const column of [
    "brand",
    "audience",
    "category",
    "pattern",
    "silhouette",
    "fit",
  ]) {
    expect(sql).toContain(`lower(coalesce(${column}, ''))`);
  }

  expect(sql).toContain("products_price_idx");
  expect(sql).toContain("where price is not null");

  for (const indexName of [
    "products_season_gin_idx",
    "products_formality_level_gin_idx",
    "products_style_gin_idx",
    "products_occasions_gin_idx",
    "products_color_base_gin_idx",
    "products_closure_type_gin_idx",
  ]) {
    expect(sql).toContain(
      `create index concurrently if not exists ${indexName}`,
    );
    expect(sql).toContain(" using gin ");
  }

  for (const indexName of [
    "products_name_trgm_idx",
    "products_description_trgm_idx",
    "products_composition_trgm_idx",
  ]) {
    expect(sql).toContain(
      `create index concurrently if not exists ${indexName}`,
    );
    expect(sql).toContain("gin_trgm_ops");
  }

  expect(sql).toContain("products_embedding_1024_hnsw_cosine_idx");
  expect(sql).toContain("using hnsw");
  expect(sql).toContain("embedding::vector(1024)");
  expect(sql).toContain("vector_cosine_ops");
  expect(sql).toContain("vector_dims(embedding) = 1024");
});
