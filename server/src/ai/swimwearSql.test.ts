import { expect, test } from "vitest";
import { selectFemaleSwimwear, selectMaleSwimwear } from "./swimwearSql.js";
import type { getSqlClient } from "../db.js";

function createSqlRecorder() {
  const calls: { text: string; values: readonly unknown[] }[] = [];
  const sql = (async (
    query: string | TemplateStringsArray,
    ...values: readonly unknown[]
  ) => {
    calls.push({
      text: typeof query === "string" ? query : query.join("?"),
      values: Array.isArray(values[0])
        ? (values[0] as readonly unknown[])
        : values,
    });
    return [];
  }) as ReturnType<typeof getSqlClient>;

  return { sql, calls };
}

test("catalog-only swimwear SQL reads only products", async () => {
  const recorder = createSqlRecorder();

  await selectFemaleSwimwear({
    sql: recorder.sql,
    audience: "woman",
    targetStyle: "minimalistic",
    bottomColors: ["black"],
    embeddingVector: "[0.1,0.2]",
    sourceMode: "catalog_only",
    profileEmail: "person@example.com",
  });

  const sqlText = recorder.calls[0].text;
  expect(sqlText).toMatch(/FROM products/i);
  expect(sqlText).not.toMatch(/FROM wardrobe/i);
  expect(sqlText).toMatch(/'catalog'::text AS item_source/i);
  expect(sqlText).toMatch(/AS swimwear_type/i);
  expect(recorder.calls[0].values).toContain("woman");
  expect(recorder.calls[0].values).not.toContain("person@example.com");
});

test("wardrobe-only swimwear SQL reads only current-user ready wardrobe items", async () => {
  const recorder = createSqlRecorder();

  await selectMaleSwimwear({
    sql: recorder.sql,
    targetStyle: "sporty",
    topColors: ["navy"],
    embeddingVector: "[0.1,0.2]",
    sourceMode: "wardrobe_only",
    profileEmail: "person@example.com",
  });

  const sqlText = recorder.calls[0].text;
  expect(sqlText).toMatch(/FROM wardrobe/i);
  expect(sqlText).not.toMatch(/FROM products/i);
  expect(sqlText).toMatch(/wardrobe\.profile_email =/i);
  expect(sqlText).toMatch(/wardrobe\.processing_status = 'ready'/i);
  expect(sqlText).toMatch(/\('W' \|\| wardrobe_deduped\.id::text\) AS id/i);
  expect(sqlText).toMatch(/'wardrobe'::text AS item_source/i);
  expect(sqlText).toMatch(/wardrobe_deduped\.id::text AS wardrobe_id/i);
  expect(recorder.calls[0].values).toContain("person@example.com");
});

test("wardrobe-preferred swimwear SQL mixes wardrobe and catalog candidates", async () => {
  const recorder = createSqlRecorder();

  await selectFemaleSwimwear({
    sql: recorder.sql,
    audience: "woman",
    targetStyle: "sporty",
    bottomColors: ["black"],
    embeddingVector: "[0.1,0.2]",
    sourceMode: "wardrobe_preferred",
    profileEmail: "person@example.com",
  });

  const sqlText = recorder.calls[0].text;
  expect(sqlText).toMatch(/FROM products/i);
  expect(sqlText).toMatch(/FROM wardrobe/i);
  expect(sqlText).toMatch(/UNION ALL/i);
  expect(sqlText).toMatch(/wardrobe\.processing_status = 'ready'/i);
  expect(sqlText).toMatch(/owned\.product_id = products\.id::text/i);
  expect(sqlText).toMatch(/candidate_items\.item_source = 'wardrobe'/i);
  expect(sqlText).toMatch(/AS swimwear_type/i);
  expect(recorder.calls[0].values).toContain("person@example.com");
});
