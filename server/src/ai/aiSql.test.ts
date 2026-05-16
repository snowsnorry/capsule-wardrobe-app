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
  const calls: { strings: string[]; values: readonly unknown[] }[] = [];
  const sql = (async (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ) => {
    calls.push({ strings: [...strings], values });
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
    catalogPoolLimit: 8,
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
  expect(params.catalogPoolLimit).toBe(8);
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
  const sqlText = recorder.calls[0].strings.join("?");
  expect(sqlText).toMatch(/FROM wardrobe/i);
  expect(sqlText).toMatch(/wardrobe\.profile_email = \?::text/i);
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
    /CASE WHEN item_source = 'wardrobe' THEN \?::int ELSE 0 END/i,
  );
  expect(sqlText).toMatch(/PARTITION BY item_source/i);
  expect(sqlText).toMatch(
    /item_source = 'catalog' AND source_rank <= \?::int/i,
  );
  expect(sqlText).toMatch(
    /item_source = 'wardrobe' AND source_rank <= \?::int/i,
  );
  expect(sqlText).toMatch(/LIMIT \?::int/i);
  expect(recorder.calls[0].values).toEqual(
    expect.arrayContaining(["person@example.com", 25, 8, 5, 10]),
  );
});

test("catalog-only SQL keeps products-only retrieval with catalog item source", async () => {
  const recorder = createSqlRecorder();

  await queryCapsuleWardrobeItems(recorder.sql, buildBaseSqlParams());

  const sqlText = recorder.calls[0].strings.join("?");
  expect(sqlText).toMatch(/FROM products/i);
  expect(sqlText).toMatch(/'catalog'::text as item_source/i);
  expect(sqlText).not.toMatch(/FROM wardrobe/i);
  expect(sqlText).toMatch(/LIMIT \?::int/i);
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
  expect(multiple.calls[0].strings.join("?")).toMatch(/neutrality_rank/);
  expect(multiple.calls[0].strings.join("?")).toMatch(
    /'wardrobe'::text AS item_source/i,
  );
  expect(multiple.calls[0].strings.join("?")).toMatch(
    /wardrobe\.processing_status = 'ready'/i,
  );
  expect(multiple.calls[0].strings.join("?")).not.toMatch(
    /wardrobe\.source <> 'uploaded'/i,
  );
  expect(multiple.calls[0].strings.join("?")).not.toMatch(
    /cardinality\(COALESCE\(wardrobe\.season, ARRAY\[\]::text\[\]\)\) > 0/i,
  );
  expect(multiple.calls[0].strings.join("?")).toMatch(
    /wardrobe_deduped\.id::text AS wardrobe_id/i,
  );
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

  const multipleSqlText = multiple.calls[0].strings.join("?");
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
});
