import { test, expect } from "vitest";
import { queryRegenerationCandidateItems } from "./regenerateSelectedSql.js";
import type {
  RegenerateSelectedSqlClient,
  RegenerateSelectedSqlParams,
} from "./regenerateSelectedSql.js";

function createSqlRecorder() {
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

  return { calls, sql };
}

function createBaseParams(
  overrides: Partial<RegenerateSelectedSqlParams> = {},
): RegenerateSelectedSqlParams {
  return {
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
    sourceMode: "catalog_only",
    style: "minimalistic",
    ...overrides,
  };
}

test("queryRegenerationCandidateItems builds the expected catalog-only regeneration query", async () => {
  const { calls, sql } = createSqlRecorder();

  const result = await queryRegenerationCandidateItems(sql, createBaseParams());

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
  expect(calls[0].text).toMatch(/FROM products/);
  expect(calls[0].text).not.toMatch(/FROM wardrobe/);
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

test("queryRegenerationCandidateItems reads only current-user ready wardrobe items in wardrobe-only mode", async () => {
  const { calls, sql } = createSqlRecorder();

  await queryRegenerationCandidateItems(
    sql,
    createBaseParams({
      categories: ["swimwear"],
      profileEmail: " person@example.com ",
      sourceMode: "wardrobe_only",
    }),
  );

  expect(calls.length).toBe(1);
  expect(calls[0].text).toMatch(/FROM wardrobe/);
  expect(calls[0].text).toMatch(
    /wardrobe\.profile_email = params\.profile_email/,
  );
  expect(calls[0].text).toMatch(/wardrobe\.processing_status = 'ready'/);
  expect(calls[0].text).toMatch(
    /NULLIF\(trim\(COALESCE\(wardrobe\.url, ''\)\), ''\) IS NOT NULL/,
  );
  expect(calls[0].text).toMatch(/'wardrobe'::text AS item_source/);
  expect(calls[0].text).toMatch(/wardrobe_deduped\.id::text AS wardrobe_id/);
  expect(calls[0].text).toMatch(/wardrobe_deduped\.raw_image_url/);
  expect(calls[0].text).not.toMatch(/FROM products/);
  expect(calls[0].values).toEqual([
    ["swimwear"],
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
    "person@example.com",
    [],
  ]);
});

test("queryRegenerationCandidateItems mixes catalog and wardrobe candidates in wardrobe-preferred mode", async () => {
  const { calls, sql } = createSqlRecorder();

  await queryRegenerationCandidateItems(
    sql,
    createBaseParams({
      profileEmail: "person@example.com",
      sourceMode: "wardrobe_preferred",
    }),
  );

  expect(calls.length).toBe(1);
  expect(calls[0].text).toMatch(/FROM products/);
  expect(calls[0].text).toMatch(/UNION ALL/);
  expect(calls[0].text).toMatch(/FROM wardrobe/);
  expect(calls[0].text).toMatch(/wardrobe\.processing_status = 'ready'/);
  expect(calls[0].text).toMatch(/'catalog'::text AS item_source/);
  expect(calls[0].text).toMatch(/'wardrobe'::text AS item_source/);
  expect(calls[0].text).toMatch(
    /CASE WHEN item_source = 'wardrobe' THEN params\.wardrobe_boost ELSE 0 END/,
  );
  expect(calls[0].text).toMatch(/PARTITION BY item_source/);
  expect(calls[0].text).toMatch(
    /item_source = 'catalog' AND source_rank <= params\.catalog_pool_limit/,
  );
  expect(calls[0].text).toMatch(
    /item_source = 'wardrobe' AND source_rank <= params\.wardrobe_pool_limit/,
  );
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
    "person@example.com",
    25,
    10,
    5,
    [],
  ]);
});

test("queryRegenerationCandidateItems dispatches the full selected-regeneration SQL matrix", async () => {
  const cases = [
    {
      label: "catalog regular",
      params: createBaseParams({ sourceMode: "catalog_only" }),
      expectedValues: [
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
      ],
      expectedText: [/is_color_match/, /\$5::text AS color/],
      forbiddenText: [/is_non_neutral_color/, /anchor_wardrobe_ids/],
    },
    {
      label: "catalog multiple accent",
      params: createBaseParams({ color: "multiple_accent_colors" }),
      expectedValues: [
        ["top", "bottom"],
        0.05,
        "[0.1,0.2]",
        "minimalistic",
        "solid",
        "casual",
        ["office"],
        ["summer"],
        ["woman", "all"],
        ["https://example.test/old"],
      ],
      expectedText: [/is_non_neutral_color/, /style_role/],
      forbiddenText: [/\$5::text AS color/, /is_color_match/],
    },
    {
      label: "wardrobe-only regular",
      params: createBaseParams({
        anchorWardrobeNumericIds: [12],
        profileEmail: "person@example.com",
        sourceMode: "wardrobe_only",
      }),
      expectedValues: [
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
        "person@example.com",
        [12],
      ],
      expectedText: [/FROM wardrobe/, /anchor_wardrobe_ids/, /is_color_match/],
      forbiddenText: [/is_non_neutral_color/],
    },
    {
      label: "wardrobe-only multiple accent",
      params: createBaseParams({
        anchorWardrobeNumericIds: [12],
        color: "multiple_accent_colors",
        profileEmail: "person@example.com",
        sourceMode: "wardrobe_only",
      }),
      expectedValues: [
        ["top", "bottom"],
        0.05,
        "[0.1,0.2]",
        "minimalistic",
        "solid",
        "casual",
        ["office"],
        ["summer"],
        ["woman", "all"],
        ["https://example.test/old"],
        "person@example.com",
        [12],
      ],
      expectedText: [
        /FROM wardrobe/,
        /anchor_wardrobe_ids/,
        /is_non_neutral_color/,
      ],
      forbiddenText: [/\$5::text AS color/, /is_color_match/],
    },
    {
      label: "wardrobe-preferred regular",
      params: createBaseParams({
        anchorWardrobeNumericIds: [12],
        profileEmail: "person@example.com",
        sourceMode: "wardrobe_preferred",
      }),
      expectedValues: [
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
        "person@example.com",
        25,
        10,
        5,
        [12],
      ],
      expectedText: [/UNION ALL/, /anchor_wardrobe_ids/, /is_color_match/],
      forbiddenText: [/is_non_neutral_color/],
    },
    {
      label: "wardrobe-preferred multiple accent",
      params: createBaseParams({
        anchorWardrobeNumericIds: [12],
        color: "multiple_accent_colors",
        profileEmail: "person@example.com",
        sourceMode: "wardrobe_preferred",
      }),
      expectedValues: [
        ["top", "bottom"],
        0.05,
        "[0.1,0.2]",
        "minimalistic",
        "solid",
        "casual",
        ["office"],
        ["summer"],
        ["woman", "all"],
        ["https://example.test/old"],
        "person@example.com",
        25,
        10,
        5,
        [12],
      ],
      expectedText: [
        /UNION ALL/,
        /anchor_wardrobe_ids/,
        /is_non_neutral_color/,
      ],
      forbiddenText: [/\$5::text AS color/, /is_color_match/],
    },
  ];

  for (const testCase of cases) {
    const { calls, sql } = createSqlRecorder();

    await queryRegenerationCandidateItems(sql, testCase.params);

    expect(calls, testCase.label).toHaveLength(1);
    expect(calls[0].values, testCase.label).toEqual(testCase.expectedValues);
    for (const pattern of testCase.expectedText) {
      expect(calls[0].text, testCase.label).toMatch(pattern);
    }
    for (const pattern of testCase.forbiddenText) {
      expect(calls[0].text, testCase.label).not.toMatch(pattern);
    }
  }
});
