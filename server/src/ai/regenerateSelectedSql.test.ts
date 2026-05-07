import { test, expect } from "vitest";
import { queryRegenerationCandidateItems } from "./regenerateSelectedSql.js";
import type { RegenerateSelectedSqlClient } from "./regenerateSelectedSql.js";

test("queryRegenerationCandidateItems builds the expected parameterized regeneration query", async () => {
  const calls: Array<{ text: string; values: readonly unknown[] }> = [];
  const sql: RegenerateSelectedSqlClient = async <TRow = unknown>(strings, ...values) => {
    calls.push({ text: strings.join("?"), values });
    return [{ id: "candidate-1", url: "https://example.test/p1", embedding: [1, 2, 3] }] as TRow[];
  };

  const result = await queryRegenerationCandidateItems(sql, {
    audienceFilters: ["woman", "all"],
    categories: ["top", "bottom"],
    color: "blue",
    embeddingVector: "[0.1,0.2]",
    excludedUrls: ["https://example.test/old"],
    formalityLevel: "casual",
    noiseFactor: 0.05,
    occasions: ["office"],
    pattern: "solid",
    season: ["summer"],
    style: "minimalistic"
  });

  expect(result).toEqual([{ id: "candidate-1", url: "https://example.test/p1", embedding: [1, 2, 3] }]);
  expect(calls.length).toBe(1);
  expect(calls[0].text).toMatch(/FROM unnest\(\?::text\[\]\) AS cats/);
  expect(calls[0].text).toMatch(/PARTITION BY COALESCE\(color_base/);
  expect(calls[0].text).toMatch(/NOT \(products\.url = ANY\(\?::text\[\]\)\)/);
  expect(calls[0].values.length).toBe(33);
  expect(calls[0].values.slice(0, 7)).toEqual([
    ["top", "bottom"],
    0.05,
    "[0.1,0.2]",
    "minimalistic",
    "minimalistic",
    "blue",
    "blue"
  ]);
  expect(calls[0].values.slice(24)).toEqual([
    ["woman", "all"],
    "blue",
    "blue",
    "blue",
    "solid",
    "solid",
    ["https://example.test/old"],
    "solid",
    0.05
  ]);
});
