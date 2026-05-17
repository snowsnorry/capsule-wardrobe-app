import { test, expect } from "vitest";
import { queryRegenerationCandidateItems } from "./regenerateSelectedSql.js";
import type { RegenerateSelectedSqlClient } from "./regenerateSelectedSql.js";

test("queryRegenerationCandidateItems builds the expected parameterized regeneration query", async () => {
  const calls: Array<{ text: string; values: readonly unknown[] }> = [];
  const sql: RegenerateSelectedSqlClient = async <TRow = unknown>(
    query: string | TemplateStringsArray,
    ...values
  ) => {
    if (typeof query === "string") {
      calls.push({
        text: query,
        values: Array.isArray(values[0])
          ? (values[0] as readonly unknown[])
          : values,
      });
      return [
        {
          id: "candidate-1",
          url: "https://example.test/p1",
          embedding: [1, 2, 3],
        },
      ] as TRow[];
    }

    calls.push({ text: query.join("?"), values });
    return [
      {
        id: "candidate-1",
        url: "https://example.test/p1",
        embedding: [1, 2, 3],
      },
    ] as TRow[];
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
    style: "minimalistic",
  });

  expect(result).toEqual([
    { id: "candidate-1", url: "https://example.test/p1", embedding: [1, 2, 3] },
  ]);
  expect(calls.length).toBe(1);
  expect(calls[0].text).toMatch(/WITH query_params AS/i);
  expect(calls[0].text).toMatch(/\$1::text\[\] AS categories/);
  expect(calls[0].text).toMatch(
    /FROM query_params AS params\s+CROSS JOIN unnest\(params\.categories\) AS cats/s,
  );
  expect(calls[0].text).toMatch(/PARTITION BY COALESCE\(color_base/);
  expect(calls[0].text).toMatch(
    /NOT \(products\.url = ANY\(params\.excluded_urls\)\)/,
  );
  expect(calls[0].text).toMatch(/LIMIT 10/);
  expect(calls[0].values).toEqual([
    ["top", "bottom"],
    0.05,
    "[0.1,0.2]",
    "minimalistic",
    "blue",
    "solid",
    "casual",
    ["office"],
    ["summer"],
    ["woman", "all"],
    ["https://example.test/old"],
  ]);
});
