import { test, expect } from "vitest";
import crypto from "node:crypto";
import {
  CODE_TTL_MS,
  RESEND_COOLDOWN_MS,
  MAX_CODE_SENDS_PER_HOUR,
  MAX_VERIFY_ATTEMPTS,
  SESSION_TTL_MS,
  createAuthStore,
} from "./authStore.js";

type LoginCodeUpsertPayload = {
  email: string;
  codeHash: string;
  nonce: string;
  expiresAt: Date;
};

type VerifyPayload = {
  email: string;
  codeHash: string;
  maxAttempts: number;
};

type PersistedSession = {
  sessionId: string;
  email: string;
  csrfToken: string;
  createdAt: Date;
  expiresAt: Date;
};

type SessionLookupRow = {
  email: string;
  csrfToken: string;
  createdAt: string;
  expiresAt: string;
};

type SendStateEntry = {
  lastSentAt: number;
  sendWindowStart: number;
  sendCount: number;
};

function createRandomBytesQueue(hexValues: string[]): () => Buffer {
  const queue = [...hexValues];
  return () => Buffer.from(queue.shift() || "ab".repeat(32), "hex");
}

test("createPendingCode stores hashed login code with generated nonce and expiry", async () => {
  let pruned = 0;
  let upsertPayload: LoginCodeUpsertPayload | null = null;
  const now = 1_700_000_000_000;
  const store = createAuthStore({
    codeSecret: "secret",
    nowMsImpl: () => now,
    randomIntImpl: () => 123456,
    randomBytesImpl: createRandomBytesQueue(["11".repeat(16)]),
    pruneLoginCodesImpl: async () => {
      pruned += 1;
    },
    upsertLoginCodeImpl: async (payload) => {
      upsertPayload = payload;
    },
  });

  const result = await store.createPendingCode("person@example.com");

  expect(result).toEqual({ ok: true, code: "123456" });
  expect(pruned).toBe(1);
  expect(upsertPayload).toBeTruthy();
  expect(upsertPayload.email).toBe("person@example.com");
  expect(upsertPayload.nonce).toBe("11".repeat(16));
  expect(upsertPayload.expiresAt.toISOString()).toBe(
    new Date(now + CODE_TTL_MS).toISOString(),
  );
  expect(upsertPayload.codeHash).toBe(
    crypto
      .createHmac("sha256", "secret")
      .update(`person@example.com:123456:${"11".repeat(16)}`)
      .digest("hex"),
  );
});

test("createPendingCode enforces resend cooldown and hourly limit", async () => {
  let now = 100_000;
  const store = createAuthStore({
    codeSecret: "secret",
    nowMsImpl: () => now,
    randomIntImpl: () => 111111,
    randomBytesImpl: createRandomBytesQueue(
      Array.from({ length: 70 }, (_, index) =>
        String(index + 10)
          .padStart(2, "0")
          .repeat(16),
      ),
    ),
    pruneLoginCodesImpl: async () => {},
    upsertLoginCodeImpl: async () => {},
  });

  const first = await store.createPendingCode("person@example.com");
  expect(first.ok).toBe(true);

  const cooldown = await store.createPendingCode("person@example.com");
  expect(cooldown).toEqual({ ok: false, reason: "cooldown" });

  for (let index = 1; index < MAX_CODE_SENDS_PER_HOUR; index += 1) {
    now += RESEND_COOLDOWN_MS + 1;
    const result = await store.createPendingCode("person@example.com");
    expect(result.ok).toBe(true);
  }

  now += RESEND_COOLDOWN_MS + 1;
  const rateLimitedStore = createAuthStore({
    codeSecret: "secret",
    nowMsImpl: () => now,
    randomIntImpl: () => 111111,
    randomBytesImpl: createRandomBytesQueue(["99".repeat(16)]),
    pruneLoginCodesImpl: async () => {},
    upsertLoginCodeImpl: async () => {},
    initialSendState: [
      [
        "person@example.com",
        {
          lastSentAt: now - RESEND_COOLDOWN_MS - 1,
          sendWindowStart: now - 60 * 60 * 1000 + 10_000,
          sendCount: MAX_CODE_SENDS_PER_HOUR,
        },
      ],
    ] satisfies [string, SendStateEntry][],
  });
  const rateLimited =
    await rateLimitedStore.createPendingCode("person@example.com");
  expect(rateLimited).toEqual({ ok: false, reason: "rate_limit" });
});

test("createPendingCode resets hourly window after stale send state is cleaned up", async () => {
  let now = 200_000;
  const store = createAuthStore({
    codeSecret: "secret",
    nowMsImpl: () => now,
    randomIntImpl: () => 222222,
    randomBytesImpl: createRandomBytesQueue(["22".repeat(16), "33".repeat(16)]),
    pruneLoginCodesImpl: async () => {},
    upsertLoginCodeImpl: async () => {},
  });

  expect((await store.createPendingCode("person@example.com")).ok).toBe(true);

  now += 60 * 60 * 1000 + 1;
  const afterCleanup = await store.createPendingCode("person@example.com");
  expect(afterCleanup).toEqual({ ok: true, code: "222222" });
});

test("verifyCode returns not_found without stored login code and hashes candidate for verification", async () => {
  let verifyPayload: VerifyPayload | null = null;
  const store = createAuthStore({
    codeSecret: "secret",
    getLoginCodeByEmailImpl: async (email) =>
      email === "found@example.com" ? { nonce: "44".repeat(16) } : null,
    verifyAndConsumeLoginCodeImpl: async (payload) => {
      verifyPayload = payload;
      return { ok: true };
    },
  });

  const missing = await store.verifyCode("missing@example.com", "123456");
  expect(missing).toEqual({ ok: false, reason: "not_found" });

  const success = await store.verifyCode("found@example.com", "654321");
  expect(success).toEqual({ ok: true });
  expect(verifyPayload).toBeTruthy();
  expect(verifyPayload).toEqual({
    email: "found@example.com",
    codeHash: crypto
      .createHmac("sha256", "secret")
      .update(`found@example.com:654321:${"44".repeat(16)}`)
      .digest("hex"),
    maxAttempts: MAX_VERIFY_ATTEMPTS,
  });
});

test("createSession prunes expired sessions, inserts session, and respects prune interval", async () => {
  let now = 10_000;
  let pruneCalls = 0;
  const inserted: PersistedSession[] = [];
  const store = createAuthStore({
    codeSecret: "secret",
    nowMsImpl: () => now,
    randomBytesImpl: createRandomBytesQueue([
      "aa".repeat(32),
      "bb".repeat(32),
      "cc".repeat(32),
      "dd".repeat(32),
    ]),
    sessionPruneMinIntervalMs: 5_000,
    pruneExpiredSessionsImpl: async () => {
      pruneCalls += 1;
    },
    insertSessionImpl: async (payload) => {
      inserted.push(payload);
    },
  });

  const first = await store.createSession("person@example.com");
  expect(pruneCalls).toBe(1);
  expect(first.sessionId).toBe("aa".repeat(32));
  expect(first.session.csrfToken).toBe("bb".repeat(32));
  expect(inserted[0].expiresAt.toISOString()).toBe(
    new Date(now + SESSION_TTL_MS).toISOString(),
  );

  now += 1_000;
  await store.createSession("person@example.com");
  expect(pruneCalls).toBe(1);

  now += 6_000;
  await store.createSession("person@example.com");
  expect(pruneCalls).toBe(2);
});

test("getSession normalizes valid sessions and deletes expired sessions", async () => {
  const now = 50_000;
  const deletedIds: string[] = [];
  const store = createAuthStore({
    codeSecret: "secret",
    nowMsImpl: () => now,
    pruneExpiredSessionsImpl: async () => {},
    getSessionByIdImpl: async (sessionId): Promise<SessionLookupRow | null> => {
      if (sessionId === "missing") {
        return null;
      }
      if (sessionId === "expired") {
        return {
          email: "person@example.com",
          csrfToken: "csrf",
          createdAt: new Date(now - 1000).toISOString(),
          expiresAt: new Date(now - 1).toISOString(),
        };
      }
      return {
        email: "person@example.com",
        csrfToken: "csrf",
        createdAt: new Date(now - 1000).toISOString(),
        expiresAt: new Date(now + 5000).toISOString(),
      };
    },
    deleteSessionByIdImpl: async (sessionId) => {
      deletedIds.push(sessionId);
    },
  });

  expect(await store.getSession("missing")).toBe(null);
  expect(await store.getSession("expired")).toBe(null);
  expect(deletedIds).toEqual(["expired"]);

  const valid = await store.getSession("valid");
  expect(valid).toEqual({
    email: "person@example.com",
    csrfToken: "csrf",
    createdAt: now - 1000,
    expiresAt: now + 5000,
  });
});

test("revokeSession deletes persisted session by id", async () => {
  const deletedIds: string[] = [];
  const store = createAuthStore({
    codeSecret: "secret",
    deleteSessionByIdImpl: async (sessionId) => {
      deletedIds.push(sessionId);
    },
  });

  await store.revokeSession("session-42");
  expect(deletedIds).toEqual(["session-42"]);
});
