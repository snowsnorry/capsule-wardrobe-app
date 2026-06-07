import { afterEach, expect, test } from "vitest";
import {
  setSqlClientOverride,
  type ProfileRow,
  type SqlClientLike,
  type SqlResultLike,
} from "./core.js";
import {
  createProfileRecord,
  deleteProfileByEmail,
  getProfileByEmail,
  updateProfileActiveCapsuleIdByEmail,
  updateProfileByEmail,
  updateProfileLocaleByEmail,
} from "./profiles.js";

function useQueuedSql(results: SqlResultLike[]) {
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

  setSqlClientOverride(sql);
  return { statements, values };
}

afterEach(() => {
  setSqlClientOverride(null);
});

const profileRow: ProfileRow = {
  email: "person@example.com",
  activeCapsuleId: "capsule-1",
  locale: "en",
  fullname: "Person",
  theme: "system",
  llm: "openai:gpt-5.5",
  imageLlm: "openai:gpt-image-2",
  createdAt: "2026-05-07T00:00:00.000Z",
  updatedAt: "2026-05-07T00:00:00.000Z",
};

test("profile helpers return selected rows or null for missing rows", async () => {
  const { values } = useQueuedSql([
    [profileRow],
    [],
    [profileRow],
    [],
    [profileRow],
    [],
    [profileRow],
    [],
  ]);

  await expect(getProfileByEmail("person@example.com")).resolves.toEqual(
    profileRow,
  );
  await expect(getProfileByEmail("missing@example.com")).resolves.toBeNull();
  await expect(
    createProfileRecord({ email: "person@example.com", locale: "en" }),
  ).resolves.toEqual(profileRow);
  await expect(
    createProfileRecord({ email: "person@example.com", locale: "en" }),
  ).resolves.toBeNull();
  await expect(
    updateProfileLocaleByEmail({ email: "person@example.com", locale: "ru" }),
  ).resolves.toEqual(profileRow);
  await expect(
    updateProfileLocaleByEmail({ email: "missing@example.com", locale: "ru" }),
  ).resolves.toBeNull();
  await expect(
    updateProfileActiveCapsuleIdByEmail({
      email: "person@example.com",
      activeCapsuleId: "capsule-2",
    }),
  ).resolves.toEqual(profileRow);
  await expect(
    updateProfileActiveCapsuleIdByEmail({
      email: "missing@example.com",
      activeCapsuleId: null,
    }),
  ).resolves.toBeNull();

  expect(values[0]).toEqual(["person@example.com"]);
  expect(values[2]).toEqual(["person@example.com", "en"]);
  expect(values[4]).toEqual(["ru", "person@example.com"]);
  expect(values[6]).toEqual(["capsule-2", "person@example.com"]);
});

test("updateProfileByEmail writes all editable profile fields", async () => {
  const { statements, values } = useQueuedSql([[profileRow], []]);

  await expect(
    updateProfileByEmail({
      email: "person@example.com",
      locale: "ru",
      fullname: "New Name",
      theme: "dark",
      llm: "none",
      imageLlm: "none",
    }),
  ).resolves.toEqual(profileRow);
  await expect(
    updateProfileByEmail({
      email: "missing@example.com",
      locale: "en",
      fullname: null,
      theme: "system",
      llm: "openai:gpt-5.5",
      imageLlm: "openai:gpt-image-2",
    }),
  ).resolves.toBeNull();

  expect(statements[0]).toContain("image_llm = ?");
  expect(values[0]).toEqual([
    "ru",
    "New Name",
    "dark",
    "none",
    "none",
    "person@example.com",
  ]);
});

test("deleteProfileByEmail deletes account data and returns affected profile state", async () => {
  const deletedSql = useQueuedSql([
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [{ email: "person@example.com" }],
  ]);
  await expect(deleteProfileByEmail("person@example.com")).resolves.toBe(true);
  expect(deletedSql.statements).toEqual([
    "delete from user_sessions where email = ?",
    "delete from login_codes where email = ?",
    "delete from mcp_oauth_refresh_tokens where user_email = ?",
    "delete from mcp_oauth_grants where user_email = ?",
    "delete from mcp_oauth_authorization_codes where user_email = ? and consumed_at is null",
    "delete from passkey_challenges where profile_email = ?",
    "delete from capsules where email = ?",
    "delete from outfits where email = ?",
    "delete from shared_capsules where profile_email = ?",
    "delete from wardrobe where profile_email = ?",
    "delete from user_liked_items where user_email = ?",
    "delete from search where email = ?",
    "delete from profile_passkeys where profile_email = ?",
    "delete from profiles where email = ? returning email",
  ]);

  useQueuedSql([[], [], [], [], [], [], [], [], [], [], [], [], [], []]);
  await expect(deleteProfileByEmail("missing@example.com")).resolves.toBe(
    false,
  );
});
