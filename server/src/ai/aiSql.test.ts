import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCapsuleWardrobeSqlParams,
  queryCapsuleWardrobeItems,
  queryCapsuleWardrobeItemsForMultipleAccentColors,
  queryCapsuleWardrobeItemsForProfile,
  type CapsuleWardrobeSqlClient
} from "./aiSql.js";

function createSqlRecorder() {
  const calls: { strings: string[]; values: readonly unknown[] }[] = [];
  const sql = (async (strings: TemplateStringsArray, ...values: readonly unknown[]) => {
    calls.push({ strings: [...strings], values });
    return [];
  }) as CapsuleWardrobeSqlClient;

  return { sql, calls };
}

function buildBaseSqlParams(overrides = {}) {
  return {
    categories: ["top", "bottom"],
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
    ...overrides
  };
}

test("buildCapsuleWardrobeSqlParams preserves defaults and profile filters", () => {
  const params = buildCapsuleWardrobeSqlParams(
    {
      formalityLevel: "casual",
      style: "classic",
      audience: "unknown",
      color: "blue",
      pattern: "  Plaid ",
      rejected: [" https://example.com/one ", "", null],
      text: "Prefer natural fabrics"
    },
    [0.12, -0.34],
    { top: 2, bottom: 1 }
  );

  assert.deepEqual(params.categories, ["top", "bottom"]);
  assert.equal(params.formalityLevel, "casual");
  assert.equal(params.style, "classic");
  assert.deepEqual(params.occasions, []);
  assert.deepEqual(params.season, []);
  assert.deepEqual(params.audienceFilters, ["man", "woman", "all"]);
  assert.equal(params.color, "blue");
  assert.equal(params.pattern, "plaid");
  assert.deepEqual(params.rejectedUrls, ["https://example.com/one"]);
  assert.equal(params.embeddingVector, "[0.12,-0.34]");
  assert.equal(params.noiseFactor, 0);
});

test("buildCapsuleWardrobeSqlParams falls back to solid pattern and random noise without additional text", () => {
  const params = buildCapsuleWardrobeSqlParams(
    {
      audience: "woman",
      pattern: "   ",
      text: "   "
    },
    [],
    { shoe: 1 }
  );

  assert.deepEqual(params.categories, ["shoe"]);
  assert.deepEqual(params.audienceFilters, ["woman", "all"]);
  assert.equal(params.pattern, "solid");
  assert.equal(params.embeddingVector, "[]");
  assert.equal(params.noiseFactor, 0.05);
});

test("queryCapsuleWardrobeItemsForProfile dispatches regular and multiple accent SQL branches", async () => {
  const regular = createSqlRecorder();
  await queryCapsuleWardrobeItemsForProfile(regular.sql, buildBaseSqlParams({ color: "red" }));

  const directRegular = createSqlRecorder();
  await queryCapsuleWardrobeItems(directRegular.sql, buildBaseSqlParams({ color: "red" }));

  const multiple = createSqlRecorder();
  await queryCapsuleWardrobeItemsForProfile(
    multiple.sql,
    buildBaseSqlParams({ color: "multiple_accent_colors" })
  );

  const directMultiple = createSqlRecorder();
  await queryCapsuleWardrobeItemsForMultipleAccentColors(
    directMultiple.sql,
    buildBaseSqlParams({ color: "multiple_accent_colors" })
  );

  assert.deepEqual(regular.calls, directRegular.calls);
  assert.deepEqual(multiple.calls, directMultiple.calls);
});

test("multiple accent SQL query uses neutral/non-neutral color logic", async () => {
  const params = buildBaseSqlParams({ color: "multiple_accent_colors" });
  const regular = createSqlRecorder();
  const multiple = createSqlRecorder();

  await queryCapsuleWardrobeItems(regular.sql, params);
  await queryCapsuleWardrobeItemsForMultipleAccentColors(multiple.sql, params);

  assert.equal(regular.calls.length, 1);
  assert.equal(multiple.calls.length, 1);
  assert.notDeepEqual(multiple.calls, regular.calls);

  const multipleSqlText = multiple.calls[0].strings.join("?");
  assert.match(multipleSqlText, /neutrality_rank/);
  assert.match(multipleSqlText, /is_non_neutral_color/);
  assert.match(multipleSqlText, /cardinality\(COALESCE\(color_base, ARRAY\[\]::text\[\]\)\) > 0/);
  assert.match(multipleSqlText, /neutrality_rank <= 4/);
  assert.doesNotMatch(multipleSqlText, /is_color_match/);
  assert.doesNotMatch(multipleSqlText, /accent_rank/);

  assert.ok(!multiple.calls[0].values.includes("multiple_accent_colors"));
});
