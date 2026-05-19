import { test, expect } from "vitest";
import {
  buildCapsuleWardrobeSqlParams,
  queryCapsuleWardrobeItems,
  queryCapsuleWardrobeItemsForMultipleAccentColors,
  queryCapsuleWardrobePreferredItems,
  queryCapsuleWardrobeItemsForProfile,
  type CapsuleWardrobeSqlClient,
  type CapsuleWardrobeSqlParams,
} from "./aiSql.js";

function createSqlRecorder() {
  const calls: { text: string; values: readonly unknown[] }[] = [];
  const sql = (async (
    query: string | TemplateStringsArray,
    ...values: readonly unknown[]
  ) => {
    if (typeof query === "string") {
      calls.push({
        text: query,
        values: Array.isArray(values[0])
          ? (values[0] as readonly unknown[])
          : values,
      });
      return [];
    }

    calls.push({ text: query.join("?"), values });
    return [];
  }) as CapsuleWardrobeSqlClient;

  return { sql, calls };
}

function buildBaseSqlParams(
  overrides: Partial<CapsuleWardrobeSqlParams> = {},
): CapsuleWardrobeSqlParams {
  return {
    categories: ["top", "bottom"],
    sourceMode: "catalog_only",
    profileEmail: "person@example.com",
    wardrobeBoost: 25,
    catalogPoolLimit: 10,
    wardrobePoolLimit: 5,
    finalCandidateLimit: 10,
    formalityLevel: "casual",
    style: "classic",
    occasions: ["office"],
    season: ["winter"],
    audienceFilters: ["woman", "all"],
    color: "red",
    pattern: "solid",
    rejectedUrls: ["https://example.com/rejected"],
    embeddingVector: "[0.1,0.2]",
    noiseFactor: 0.05,
    anchorWardrobeItemIds: [],
    anchorWardrobeNumericIds: [],
    anchorSimilarityBonusWeight: 18,
    ...overrides,
  };
}

test("buildCapsuleWardrobeSqlParams preserves defaults and profile filters", () => {
  const params = buildCapsuleWardrobeSqlParams(
    {
      email: "person@example.com",
      sourceMode: "wardrobe_preferred",
      formalityLevel: "casual",
      style: "classic",
      audience: "unknown",
      color: "blue",
      pattern: "  Plaid ",
      rejected: [" https://example.com/one ", "", null],
      text: "Prefer natural fabrics",
    },
    [0.12, -0.34],
    { top: 2, bottom: 1 },
  );

  expect(params.categories).toEqual(["top", "bottom"]);
  expect(params.sourceMode).toBe("wardrobe_preferred");
  expect(params.profileEmail).toBe("person@example.com");
  expect(params.wardrobeBoost).toBe(25);
  expect(params.catalogPoolLimit).toBe(10);
  expect(params.wardrobePoolLimit).toBe(5);
  expect(params.finalCandidateLimit).toBe(10);
  expect(params.formalityLevel).toBe("casual");
  expect(params.style).toBe("classic");
  expect(params.occasions).toEqual([]);
  expect(params.season).toEqual([]);
  expect(params.audienceFilters).toEqual(["man", "woman", "all"]);
  expect(params.color).toBe("blue");
  expect(params.pattern).toBe("plaid");
  expect(params.rejectedUrls).toEqual(["https://example.com/one"]);
  expect(params.embeddingVector).toBe("[0.12,-0.34]");
  expect(params.noiseFactor).toBe(0);
  expect(params.anchorWardrobeItemIds).toEqual([]);
  expect(params.anchorWardrobeNumericIds).toEqual([]);
  expect(params.anchorSimilarityBonusWeight).toBe(18);
});

test("buildCapsuleWardrobeSqlParams falls back to solid pattern and random noise without additional text", () => {
  const params = buildCapsuleWardrobeSqlParams(
    {
      audience: "woman",
      pattern: "   ",
      text: "   ",
    },
    [],
    { shoe: 1 },
  );

  expect(params.categories).toEqual(["shoe"]);
  expect(params.sourceMode).toBe("catalog_only");
  expect(params.profileEmail).toBe("");
  expect(params.audienceFilters).toEqual(["woman", "all"]);
  expect(params.pattern).toBe("solid");
  expect(params.embeddingVector).toBe("[]");
  expect(params.noiseFactor).toBe(0.05);
});

test("wardrobe preferred SQL mixes catalog and wardrobe candidates with quotas and owned boost", async () => {
  const recorder = createSqlRecorder();

  await queryCapsuleWardrobeItems(
    recorder.sql,
    buildBaseSqlParams({ sourceMode: "wardrobe_preferred" }),
  );

  expect(recorder.calls.length).toBe(1);
  const sqlText = recorder.calls[0].text;
  expect(sqlText).toMatch(/WITH query_params AS/i);
  expect(sqlText).toMatch(/\$13::text AS profile_email/i);
  expect(sqlText).toMatch(/FROM wardrobe/i);
  expect(sqlText).toMatch(/wardrobe\.profile_email = params\.profile_email/i);
  expect(sqlText).toMatch(/wardrobe\.processing_status = 'ready'/i);
  expect(sqlText).not.toMatch(/wardrobe\.source <> 'uploaded'/i);
  expect(sqlText).not.toMatch(
    /NULLIF\(trim\(COALESCE\(wardrobe\.name, ''\)\), ''\) IS NOT NULL/i,
  );
  expect(sqlText).not.toMatch(
    /NULLIF\(trim\(COALESCE\(wardrobe\.audience, ''\)\), ''\) IS NOT NULL/i,
  );
  expect(sqlText).not.toMatch(
    /NULLIF\(trim\(COALESCE\(wardrobe\.category, ''\)\), ''\) IS NOT NULL/i,
  );
  expect(sqlText).not.toMatch(
    /cardinality\(COALESCE\(wardrobe\.season, ARRAY\[\]::text\[\]\)\) > 0/i,
  );
  expect(sqlText).toMatch(
    /NULLIF\(trim\(COALESCE\(wardrobe\.url, ''\)\), ''\) IS NOT NULL/i,
  );
  expect(sqlText).toMatch(
    /PARTITION BY COALESCE\(wardrobe\.product_id, 'wardrobe:' \|\| wardrobe\.id::text\)/i,
  );
  expect(sqlText).toMatch(/owned\.product_id = products\.id::text/i);
  expect(sqlText).toMatch(/\('W' \|\| wardrobe_deduped\.id::text\) AS id/i);
  expect(sqlText).toMatch(/'wardrobe'::text AS item_source/i);
  expect(sqlText).toMatch(/wardrobe_deduped\.raw_image_url/i);
  expect(sqlText).toMatch(/wardrobe_deduped\.processing_status/i);
  expect(sqlText).toMatch(/wardrobe_deduped\.id::text AS wardrobe_id/i);
  expect(sqlText).toMatch(
    /CASE WHEN item_source = 'wardrobe' THEN params\.wardrobe_boost ELSE 0 END/i,
  );
  expect(sqlText).toMatch(/PARTITION BY item_source/i);
  expect(sqlText).toMatch(
    /item_source = 'catalog' AND source_rank <= params\.catalog_pool_limit/i,
  );
  expect(sqlText).toMatch(
    /item_source = 'wardrobe' AND source_rank <= params\.wardrobe_pool_limit/i,
  );
  expect(sqlText).toMatch(
    /LIMIT \(SELECT final_candidate_limit FROM query_params\)/i,
  );
  expect(recorder.calls[0].values).toEqual([
    ["top", "bottom"],
    0.05,
    "[0.1,0.2]",
    "classic",
    "red",
    "solid",
    "casual",
    ["office"],
    ["winter"],
    ["woman", "all"],
    ["https://example.com/rejected"],
    10,
    "person@example.com",
    25,
    10,
    5,
  ]);
});

test("catalog-only SQL keeps products-only retrieval with catalog item source", async () => {
  const recorder = createSqlRecorder();

  await queryCapsuleWardrobeItems(recorder.sql, buildBaseSqlParams());

  const sqlText = recorder.calls[0].text;
  expect(sqlText).toMatch(/WITH query_params AS/i);
  expect(sqlText).toMatch(/\$12::int AS final_candidate_limit/i);
  expect(sqlText).toMatch(/FROM products/i);
  expect(sqlText).toMatch(/'catalog'::text as item_source/i);
  expect(sqlText).not.toMatch(/FROM wardrobe/i);
  expect(sqlText).toMatch(
    /LIMIT \(SELECT final_candidate_limit FROM query_params\)/i,
  );
  expect(recorder.calls[0].values).toEqual([
    ["top", "bottom"],
    0.05,
    "[0.1,0.2]",
    "classic",
    "red",
    "solid",
    "casual",
    ["office"],
    ["winter"],
    ["woman", "all"],
    ["https://example.com/rejected"],
    10,
  ]);
});

test("queryCapsuleWardrobeItemsForProfile dispatches regular and multiple accent SQL branches", async () => {
  const regular = createSqlRecorder();
  await queryCapsuleWardrobeItemsForProfile(
    regular.sql,
    buildBaseSqlParams({ color: "red" }),
  );

  const directRegular = createSqlRecorder();
  await queryCapsuleWardrobeItems(
    directRegular.sql,
    buildBaseSqlParams({ color: "red" }),
  );

  const multiple = createSqlRecorder();
  await queryCapsuleWardrobeItemsForProfile(
    multiple.sql,
    buildBaseSqlParams({ color: "multiple_accent_colors" }),
  );

  const directMultiple = createSqlRecorder();
  await queryCapsuleWardrobeItemsForMultipleAccentColors(
    directMultiple.sql,
    buildBaseSqlParams({ color: "multiple_accent_colors" }),
  );

  expect(regular.calls).toEqual(directRegular.calls);
  expect(multiple.calls).toEqual(directMultiple.calls);
});

test("queryCapsuleWardrobeItemsForProfile dispatches wardrobe preferred regular and multiple accent branches", async () => {
  const regular = createSqlRecorder();
  await queryCapsuleWardrobeItemsForProfile(
    regular.sql,
    buildBaseSqlParams({ color: "red", sourceMode: "wardrobe_preferred" }),
  );

  const directRegular = createSqlRecorder();
  await queryCapsuleWardrobePreferredItems(
    directRegular.sql,
    buildBaseSqlParams({ color: "red", sourceMode: "wardrobe_preferred" }),
  );

  const multiple = createSqlRecorder();
  await queryCapsuleWardrobeItemsForProfile(
    multiple.sql,
    buildBaseSqlParams({
      color: "multiple_accent_colors",
      sourceMode: "wardrobe_preferred",
    }),
  );

  const directMultiple = createSqlRecorder();
  await queryCapsuleWardrobeItemsForMultipleAccentColors(
    directMultiple.sql,
    buildBaseSqlParams({
      color: "multiple_accent_colors",
      sourceMode: "wardrobe_preferred",
    }),
  );

  expect(regular.calls).toEqual(directRegular.calls);
  expect(multiple.calls).toEqual(directMultiple.calls);
  expect(multiple.calls[0].text).toMatch(/neutrality_rank/);
  expect(multiple.calls[0].text).toMatch(/'wardrobe'::text AS item_source/i);
  expect(multiple.calls[0].text).toMatch(
    /wardrobe\.processing_status = 'ready'/i,
  );
  expect(multiple.calls[0].text).not.toMatch(/wardrobe\.source <> 'uploaded'/i);
  expect(multiple.calls[0].text).not.toMatch(
    /cardinality\(COALESCE\(wardrobe\.season, ARRAY\[\]::text\[\]\)\) > 0/i,
  );
  expect(multiple.calls[0].text).toMatch(
    /wardrobe_deduped\.id::text AS wardrobe_id/i,
  );
  expect(multiple.calls[0].text).toMatch(
    /wardrobe\.profile_email = params\.profile_email/i,
  );
  expect(multiple.calls[0].text).toMatch(/\$12::text AS profile_email/i);
  expect(multiple.calls[0].text).toMatch(
    /CASE WHEN item_source = 'wardrobe' THEN params\.wardrobe_boost ELSE 0 END/i,
  );
  expect(multiple.calls[0].text).toMatch(
    /item_source = 'catalog' AND source_rank <= params\.catalog_pool_limit/i,
  );
  expect(multiple.calls[0].text).toMatch(
    /item_source = 'wardrobe' AND source_rank <= params\.wardrobe_pool_limit/i,
  );
  expect(multiple.calls[0].values).toEqual([
    ["top", "bottom"],
    0.05,
    "[0.1,0.2]",
    "classic",
    "solid",
    "casual",
    ["office"],
    ["winter"],
    ["woman", "all"],
    ["https://example.com/rejected"],
    10,
    "person@example.com",
    25,
    10,
    5,
  ]);
});

test("multiple accent SQL query uses neutral/non-neutral color logic", async () => {
  const params = buildBaseSqlParams({ color: "multiple_accent_colors" });
  const regular = createSqlRecorder();
  const multiple = createSqlRecorder();

  await queryCapsuleWardrobeItems(regular.sql, params);
  await queryCapsuleWardrobeItemsForMultipleAccentColors(multiple.sql, params);

  expect(regular.calls.length).toBe(1);
  expect(multiple.calls.length).toBe(1);
  expect(multiple.calls).not.toEqual(regular.calls);

  const multipleSqlText = multiple.calls[0].text;
  expect(multipleSqlText).toMatch(/neutrality_rank/);
  expect(multipleSqlText).toMatch(/is_non_neutral_color/);
  expect(multipleSqlText).toMatch(
    /cardinality\(COALESCE\(color_base, ARRAY\[\]::text\[\]\)\) > 0/,
  );
  expect(multipleSqlText).toMatch(/neutrality_rank <= 4/);
  expect(multipleSqlText).not.toMatch(/is_color_match/);
  expect(multipleSqlText).not.toMatch(/accent_rank/);

  expect(
    !multiple.calls[0].values.includes("multiple_accent_colors"),
  ).toBeTruthy();
  expect(multiple.calls[0].values).toEqual([
    ["top", "bottom"],
    0.05,
    "[0.1,0.2]",
    "classic",
    "solid",
    "casual",
    ["office"],
    ["winter"],
    ["woman", "all"],
    ["https://example.com/rejected"],
    10,
  ]);
});

test("anchor-aware SQL dispatch selects all four anchor variants", async () => {
  const anchorParams = {
    anchorWardrobeItemIds: ["W12"],
    anchorWardrobeNumericIds: [12],
  };

  const catalog = createSqlRecorder();
  await queryCapsuleWardrobeItems(
    catalog.sql,
    buildBaseSqlParams(anchorParams),
  );

  const catalogMultiple = createSqlRecorder();
  await queryCapsuleWardrobeItemsForMultipleAccentColors(
    catalogMultiple.sql,
    buildBaseSqlParams({ ...anchorParams, color: "multiple_accent_colors" }),
  );

  const wardrobe = createSqlRecorder();
  await queryCapsuleWardrobePreferredItems(
    wardrobe.sql,
    buildBaseSqlParams({ ...anchorParams, sourceMode: "wardrobe_preferred" }),
  );

  const wardrobeMultiple = createSqlRecorder();
  await queryCapsuleWardrobeItemsForMultipleAccentColors(
    wardrobeMultiple.sql,
    buildBaseSqlParams({
      ...anchorParams,
      color: "multiple_accent_colors",
      sourceMode: "wardrobe_preferred",
    }),
  );

  expect(catalog.calls[0].text).toMatch(/selection_role/i);
  expect(catalog.calls[0].text).toMatch(
    /\$14::bigint\[\] AS anchor_wardrobe_ids/i,
  );
  expect(catalog.calls[0].text).toMatch(/is_color_match/i);
  expect(catalog.calls[0].text).toMatch(/accent_rank/i);
  expect(catalog.calls[0].text).toMatch(
    /is_color_match IS NOT TRUE OR accent_rank <= 3/i,
  );
  expect(catalog.calls[0].text).toMatch(/color_rank ASC/i);
  expect(catalog.calls[0].values.slice(-3)).toEqual([
    "person@example.com",
    [12],
    18,
  ]);
  expect(catalogMultiple.calls[0].text).toMatch(
    /\$13::bigint\[\] AS anchor_wardrobe_ids/i,
  );
  expect(catalogMultiple.calls[0].text).toMatch(/neutrality_rank/i);
  expect(catalogMultiple.calls[0].text).toMatch(/style_rank/i);
  expect(catalogMultiple.calls[0].text).toMatch(/pattern_rank/i);
  expect(catalogMultiple.calls[0].text).toMatch(/neutrality_rank <= 4/i);
  expect(catalogMultiple.calls[0].text).toMatch(/color_rank ASC/i);
  expect(catalogMultiple.calls[0].text).not.toMatch(/accent_rank/);
  expect(wardrobe.calls[0].text).toMatch(
    /wardrobe\.id <> ALL\(params\.anchor_wardrobe_ids\)/i,
  );
  expect(wardrobe.calls[0].text).toMatch(
    /params\.wardrobe_pool_limit - COALESCE/i,
  );
  expect(wardrobe.calls[0].text).toMatch(/is_color_match/i);
  expect(wardrobe.calls[0].text).toMatch(/accent_rank/i);
  expect(wardrobe.calls[0].text).toMatch(
    /is_color_match IS NOT TRUE OR accent_rank <= 3/i,
  );
  expect(wardrobe.calls[0].text).toMatch(/color_rank ASC/i);
  expect(wardrobeMultiple.calls[0].text).toMatch(
    /\$16::bigint\[\] AS anchor_wardrobe_ids/i,
  );
  expect(wardrobeMultiple.calls[0].text).toMatch(/neutrality_rank/i);
  expect(wardrobeMultiple.calls[0].text).toMatch(/style_rank/i);
  expect(wardrobeMultiple.calls[0].text).toMatch(/pattern_rank/i);
  expect(wardrobeMultiple.calls[0].text).toMatch(/neutrality_rank <= 4/i);
  expect(wardrobeMultiple.calls[0].text).toMatch(/color_rank ASC/i);
  expect(wardrobeMultiple.calls[0].text).not.toMatch(/accent_rank/);
});
