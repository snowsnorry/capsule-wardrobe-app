import { afterEach, expect, test } from "vitest";
import { setSqlClientOverride, type LoginCodeRow, type SessionRow, type SqlClientLike, type SqlResultLike } from "./core.js";
import {
  deleteSessionById,
  getLoginCodeByEmail,
  getSessionById,
  insertSession,
  pruneExpiredSessions,
  pruneLoginCodes,
  upsertLoginCode,
  verifyAndConsumeLoginCode
} from "./auth.js";

function useQueuedSql(results: SqlResultLike[]) {
  const statements: string[] = [];
  const values: unknown[][] = [];
  const sql = (async (strings: TemplateStringsArray, ...queryValues: readonly unknown[]) => {
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

const loginCodeRow: LoginCodeRow = {
  email: "person@example.com",
  codeHash: "hash",
  nonce: "nonce",
  expiresAt: "2099-01-01T00:00:00.000Z",
  attempts: 0,
  consumedAt: null
};

const sessionRow: SessionRow = {
  sessionId: "session-1",
  email: "person@example.com",
  csrfToken: "csrf",
  createdAt: "2026-05-07T00:00:00.000Z",
  expiresAt: "2026-05-08T00:00:00.000Z"
};

test("login code helpers prune, upsert, and select rows", async () => {
  const expiresAt = new Date("2026-05-07T00:00:00.000Z");
  const { statements, values } = useQueuedSql([[], [], [loginCodeRow], []]);

  await pruneLoginCodes();
  await upsertLoginCode({ email: "person@example.com", codeHash: "hash", nonce: "nonce", expiresAt });
  expect(await getLoginCodeByEmail("person@example.com")).toEqual(loginCodeRow);
  expect(await getLoginCodeByEmail("missing@example.com")).toBeNull();

  expect(statements[0]).toContain("delete from login_codes");
  expect(statements[1]).toContain("on conflict (email)");
  expect(values[1]).toEqual(["person@example.com", "hash", "nonce", expiresAt]);
});

test("verifyAndConsumeLoginCode returns success and invalid attempt branches", async () => {
  useQueuedSql([[{ email: "person@example.com" }]]);
  await expect(verifyAndConsumeLoginCode({
    email: "person@example.com",
    codeHash: "hash",
    maxAttempts: 3
  })).resolves.toEqual({ ok: true });

  useQueuedSql([[], [{ attempts: 1 }]]);
  await expect(verifyAndConsumeLoginCode({
    email: "person@example.com",
    codeHash: "bad-hash",
    maxAttempts: 3
  })).resolves.toEqual({ ok: false, reason: "invalid" });
});

test("verifyAndConsumeLoginCode handles missing, consumed, expired, and max attempts entries", async () => {
  useQueuedSql([[], [], []]);
  await expect(verifyAndConsumeLoginCode({
    email: "missing@example.com",
    codeHash: "hash",
    maxAttempts: 3
  })).resolves.toEqual({ ok: false, reason: "not_found" });

  useQueuedSql([[], [], [{ ...loginCodeRow, consumedAt: "2026-05-07T00:00:00.000Z" }]]);
  await expect(verifyAndConsumeLoginCode({
    email: "person@example.com",
    codeHash: "hash",
    maxAttempts: 3
  })).resolves.toEqual({ ok: false, reason: "invalid" });

  const expiredSql = useQueuedSql([[], [], [{ ...loginCodeRow, expiresAt: "2000-01-01T00:00:00.000Z" }], []]);
  await expect(verifyAndConsumeLoginCode({
    email: "person@example.com",
    codeHash: "hash",
    maxAttempts: 3
  })).resolves.toEqual({ ok: false, reason: "expired" });
  expect(expiredSql.statements.at(-1)).toContain("delete from login_codes where email");

  const maxAttemptsSql = useQueuedSql([[], [], [{ ...loginCodeRow, attempts: 3 }], []]);
  await expect(verifyAndConsumeLoginCode({
    email: "person@example.com",
    codeHash: "hash",
    maxAttempts: 3
  })).resolves.toEqual({ ok: false, reason: "max_attempts" });
  expect(maxAttemptsSql.statements.at(-1)).toContain("delete from login_codes where email");

  useQueuedSql([[], [], [{ ...loginCodeRow, attempts: 1 }]]);
  await expect(verifyAndConsumeLoginCode({
    email: "person@example.com",
    codeHash: "hash",
    maxAttempts: 3
  })).resolves.toEqual({ ok: false, reason: "invalid" });
});

test("session helpers insert, select, delete, and prune sessions", async () => {
  const { statements, values } = useQueuedSql([[], [sessionRow], [], [], []]);

  await insertSession(sessionRow);
  expect(await getSessionById("session-1")).toEqual(sessionRow);
  expect(await getSessionById("missing")).toBeNull();
  await deleteSessionById("session-1");
  await pruneExpiredSessions();

  expect(values[0]).toEqual([
    "session-1",
    "person@example.com",
    "csrf",
    "2026-05-07T00:00:00.000Z",
    "2026-05-08T00:00:00.000Z"
  ]);
  expect(statements.at(-1)).toContain("delete from user_sessions where \"expiresAt\" <= now()");
});
