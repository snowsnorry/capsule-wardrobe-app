import { test, expect } from "vitest";
import {
  buildCapsuleWardrobeSqlParams,
  queryCapsuleWardrobeItems,
  queryCapsuleWardrobeItemsForMultipleAccentColors,
  queryCapsuleWardrobeItemsForProfile,
  type CapsuleWardrobeSqlClient,
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
    ...overrides,
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
      text: "Prefer natural fabrics",
    },
    [0.12, -0.34],
    { top: 2, bottom: 1 },
  );

  expect(params.categories).toEqual(["top", "bottom"]);
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
  expect(params.audienceFilters).toEqual(["woman", "all"]);
  expect(params.pattern).toBe("solid");
  expect(params.embeddingVector).toBe("[]");
  expect(params.noiseFactor).toBe(0.05);
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
