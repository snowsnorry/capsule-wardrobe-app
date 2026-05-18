import { expect, test } from "vitest";
import type { SqlClientLike, SqlResultLike } from "../db/core.js";
import {
  normalizeSnapshotItemKeys,
  normalizeWardrobeItemKeys,
  redactDatabaseUrl,
  runNamingConventionMigration,
} from "./namingConventionMigration.js";

function createSql(results: SqlResultLike[]) {
  const statements: string[] = [];
  const values: unknown[][] = [];
  const sql = (async (
    strings: TemplateStringsArray,
    ...queryValues: readonly unknown[]
  ) => {
    statements.push(strings.join("?").replace(/\s+/g, " ").trim());
    values.push([...queryValues]);
    return results.shift() ?? [];
  }) as SqlClientLike;
  return { sql, statements, values };
}

const oldColumns = [
  { tableName: "login_codes", columnName: "codeHash" },
  { tableName: "login_codes", columnName: "expiresAt" },
  { tableName: "login_codes", columnName: "consumedAt" },
  { tableName: "user_sessions", columnName: "sessionId" },
  { tableName: "user_sessions", columnName: "csrfToken" },
  { tableName: "user_sessions", columnName: "createdAt" },
  { tableName: "user_sessions", columnName: "expiresAt" },
];

const newColumns = [
  { tableName: "login_codes", columnName: "code_hash" },
  { tableName: "login_codes", columnName: "expires_at" },
  { tableName: "login_codes", columnName: "consumed_at" },
  { tableName: "user_sessions", columnName: "session_id" },
  { tableName: "user_sessions", columnName: "csrf_token" },
  { tableName: "user_sessions", columnName: "created_at" },
  { tableName: "user_sessions", columnName: "expires_at" },
];

test("normalizeWardrobeItemKeys keeps camelCase when both old and new keys exist", () => {
  expect(
    normalizeWardrobeItemKeys({
      id: "item-1",
      image_url: "https://old.example/item.jpg",
      imageUrl: "https://new.example/item.jpg",
      formality_level: ["old"],
      formalityLevel: ["new"],
      source: "from_catalog",
    }),
  ).toEqual({
    item: {
      id: "item-1",
      imageUrl: "https://new.example/item.jpg",
      formalityLevel: ["new"],
      source: "from_catalog",
    },
    renamed: 2,
  });
});

test("normalizeSnapshotItemKeys renames nested wardrobe item keys only", () => {
  expect(
    normalizeSnapshotItemKeys({
      filters: { sourceMode: "wardrobe_preferred" },
      data: {
        wardrobe: {
          items: [
            {
              product_id: "p1",
              image_url: "https://example.com/item.jpg",
              color_base: ["black"],
              is_neutral: true,
              processing_status: "ready",
            },
          ],
          outfitSets: [{ itemIds: ["p1"] }],
        },
        rejectedUrls: [],
      },
    }),
  ).toEqual({
    snapshot: {
      filters: { sourceMode: "wardrobe_preferred" },
      data: {
        wardrobe: {
          items: [
            {
              productId: "p1",
              imageUrl: "https://example.com/item.jpg",
              colorBase: ["black"],
              isNeutral: true,
              processingStatus: "ready",
            },
          ],
          outfitSets: [{ itemIds: ["p1"] }],
        },
        rejectedUrls: [],
      },
    },
    renamed: 5,
  });
});

test("runNamingConventionMigration renames schema columns and persisted JSON", async () => {
  const branchCapsule = {
    id: "capsule-1",
    draft: {
      data: {
        wardrobe: {
          items: [{ image_url: "https://example.com/draft.jpg" }],
        },
      },
    },
    saved: null,
  };
  const branchShare = {
    id: "share-1",
    content: {
      data: {
        wardrobe: {
          items: [{ wardrobe_id: "7", raw_image_url: "https://raw.test" }],
        },
      },
    },
  };
  const { sql, statements } = createSql([
    oldColumns,
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [branchCapsule],
    [],
    [branchShare],
    [],
    newColumns,
    [],
    [],
  ]);

  await expect(runNamingConventionMigration(sql)).resolves.toEqual({
    schemaColumnsRenamed: 7,
    capsulesUpdated: 1,
    sharedCapsulesUpdated: 1,
    itemKeysRenamed: 3,
  });
  expect(statements.join("\n")).toContain(
    'alter table public.login_codes rename column "codeHash" to code_hash',
  );
  expect(statements.join("\n")).toContain("update public.capsules");
  expect(statements.join("\n")).toContain("update public.shared_capsules");
});

test("redactDatabaseUrl hides credentials", () => {
  expect(redactDatabaseUrl("postgres://user:secret@example.test/neondb")).toBe(
    "postgres://user:****@example.test/neondb",
  );
});
