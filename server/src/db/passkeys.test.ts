import { test, expect, afterEach } from "vitest";
import { setSqlClientOverride, type PasskeyChallengeRow, type PasskeyRow, type SqlClientLike, type SqlResultLike } from "./core.js";
import {
  consumePasskeyChallenge,
  deletePasskeyByIdForEmail,
  getPasskeyByCredentialId,
  insertPasskey,
  insertPasskeyChallenge,
  listPasskeysByEmail,
  normalizePasskeyRow,
  pruneExpiredPasskeyChallenges,
  updatePasskeyAuthentication
} from "./passkeys.js";

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

const passkeyRow: PasskeyRow = {
  id: "passkey-1",
  profileEmail: "person@example.com",
  credentialId: "credential",
  credentialPublicKey: "public-key",
  counter: "7",
  deviceType: "singleDevice",
  backedUp: false,
  transports: null,
  name: "Security key",
  aaguid: "aaguid",
  lastUsedAt: null,
  createdAt: "created",
  updatedAt: "updated"
};

const challengeRow: PasskeyChallengeRow = {
  id: "challenge-1",
  kind: "authentication",
  challenge: "challenge",
  profileEmail: "person@example.com",
  expiresAt: "expires",
  consumedAt: null,
  createdAt: "created"
};

test("normalizePasskeyRow coerces counters and missing transports", () => {
  expect(normalizePasskeyRow(null)).toBe(null);
  expect(normalizePasskeyRow(passkeyRow)).toEqual({
    ...passkeyRow,
    counter: 7,
    transports: []
  });
});

test("passkey credential helpers normalize selected and returned rows", async () => {
  useQueuedSql([
    [passkeyRow],
    [passkeyRow],
    [passkeyRow],
    [passkeyRow],
    [{ id: "passkey-1" }]
  ]);

  expect(await listPasskeysByEmail("person@example.com")).toEqual([{
    ...passkeyRow,
    counter: 7,
    transports: []
  }]);
  expect(await insertPasskey({
    profileEmail: "person@example.com",
    credentialId: "credential",
    credentialPublicKey: "public-key",
    counter: 7,
    deviceType: "singleDevice",
    backedUp: false,
    transports: ["usb"],
    name: "Security key",
    aaguid: "aaguid"
  })).toEqual({
    ...passkeyRow,
    counter: 7,
    transports: []
  });
  expect((await getPasskeyByCredentialId("credential"))?.counter).toBe(7);
  expect((await updatePasskeyAuthentication({
    credentialId: "credential",
    counter: 8,
    deviceType: null,
    backedUp: null
  }))?.credentialId).toBe("credential");
  expect(await deletePasskeyByIdForEmail({
    email: "person@example.com",
    passkeyId: "passkey-1"
  })).toBe(true);
});

test("passkey challenge helpers store, consume, prune, and return null for missing rows", async () => {
  const expiresAt = new Date("2026-05-07T00:00:00Z");
  const { statements, values } = useQueuedSql([[], [challengeRow], [], []]);

  await insertPasskeyChallenge({
    id: "challenge-1",
    kind: "registration",
    challenge: "challenge",
    profileEmail: null,
    expiresAt
  });
  expect(await consumePasskeyChallenge({
    id: "challenge-1",
    kind: "authentication"
  })).toEqual(challengeRow);
  await pruneExpiredPasskeyChallenges();
  expect(await consumePasskeyChallenge({ id: "missing", kind: "authentication" })).toBe(null);
  expect(values[0]).toEqual(["challenge-1", "registration", "challenge", null, expiresAt]);
  expect(statements.some((statement) => statement.includes("set consumed_at = now()"))).toBeTruthy();
  expect(statements.some((statement) => statement.includes("where expires_at <= now() or consumed_at is not null"))).toBeTruthy();
});
