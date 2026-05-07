import assert from "node:assert/strict";
import { test } from "node:test";
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

  assert.deepEqual(result, [{ id: "candidate-1", url: "https://example.test/p1", embedding: [1, 2, 3] }]);
  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /FROM unnest\(\?::text\[\]\) AS cats/);
  assert.match(calls[0].text, /PARTITION BY COALESCE\(color_base/);
  assert.match(calls[0].text, /NOT \(products\.url = ANY\(\?::text\[\]\)\)/);
  assert.equal(calls[0].values.length, 33);
  assert.deepEqual(calls[0].values.slice(0, 7), [
    ["top", "bottom"],
    0.05,
    "[0.1,0.2]",
    "minimalistic",
    "minimalistic",
    "blue",
    "blue"
  ]);
  assert.deepEqual(calls[0].values.slice(24), [
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
