import crypto from "node:crypto";
import {
  getLoginCodeByEmail,
  verifyAndConsumeLoginCode,
  pruneLoginCodes,
  upsertLoginCode,
  insertSession,
  getSessionById,
  deleteSessionById,
  pruneExpiredSessions
} from "./db.js";

type LoginCodeRow = {
  nonce: string;
};

type VerifyCodeResult = {
  ok: boolean;
  reason?: string;
  [key: string]: unknown;
};

type SessionRow = {
  email: string;
  csrfToken: string;
  createdAt: string | Date;
  expiresAt: string | Date;
};

type PersistedSession = {
  sessionId: string;
  email: string;
  csrfToken: string;
  createdAt: Date;
  expiresAt: Date;
};

type SessionView = {
  email: string;
  csrfToken: string;
  createdAt: number;
  expiresAt: number;
};

type CreatedSession = {
  sessionId: string;
  session: {
    email: string;
    csrfToken: string;
    createdAt: string;
    expiresAt: string;
  };
};

type SendStateEntry = {
  lastSentAt: number;
  sendWindowStart: number;
  sendCount: number;
};

type CreatePendingCodeResult =
  | { ok: true; code: string }
  | { ok: false; reason: "cooldown" | "rate_limit" };

type AuthStoreDeps = {
  getLoginCodeByEmailImpl?: (email: string) => Promise<LoginCodeRow | null>;
  verifyAndConsumeLoginCodeImpl?: (input: { email: string; codeHash: string; maxAttempts: number }) => Promise<VerifyCodeResult>;
  pruneLoginCodesImpl?: () => Promise<void>;
  upsertLoginCodeImpl?: (input: {
    email: string;
    codeHash: string;
    nonce: string;
    expiresAt: Date;
  }) => Promise<void>;
  insertSessionImpl?: (input: PersistedSession) => Promise<void>;
  getSessionByIdImpl?: (sessionId: string) => Promise<SessionRow | null>;
  deleteSessionByIdImpl?: (sessionId: string) => Promise<void>;
  pruneExpiredSessionsImpl?: () => Promise<void>;
  nowMsImpl?: () => number;
  randomIntImpl?: (min: number, max: number) => number;
  randomBytesImpl?: (size: number) => Buffer;
  codeSecret?: string | undefined;
  sessionPruneMinIntervalMs?: number;
  initialSendState?: Iterable<[string, SendStateEntry]>;
};

const CODE_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_CODE_SENDS_PER_HOUR = 60;
const MAX_VERIFY_ATTEMPTS = 5;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_PRUNE_MIN_INTERVAL_MS = Math.max(
  0,
  Number.parseInt(process.env.SESSION_PRUNE_MIN_INTERVAL_MS || "0", 10) || 0
);

function createAuthStore({
  getLoginCodeByEmailImpl = getLoginCodeByEmail,
  verifyAndConsumeLoginCodeImpl = verifyAndConsumeLoginCode,
  pruneLoginCodesImpl = pruneLoginCodes,
  upsertLoginCodeImpl = upsertLoginCode,
  insertSessionImpl = insertSession,
  getSessionByIdImpl = getSessionById,
  deleteSessionByIdImpl = deleteSessionById,
  pruneExpiredSessionsImpl = pruneExpiredSessions,
  nowMsImpl = () => Date.now(),
  randomIntImpl = (...args) => crypto.randomInt(...args),
  randomBytesImpl = (size) => crypto.randomBytes(size),
  codeSecret = process.env.AUTH_CODE_SECRET,
  sessionPruneMinIntervalMs = SESSION_PRUNE_MIN_INTERVAL_MS,
  initialSendState = []
}: AuthStoreDeps = {}) {
  const sendState = new Map<string, SendStateEntry>(initialSendState);
  let lastSessionPruneAtMs = 0;

  function nowMs(): number {
    return nowMsImpl();
  }

  function cleanupSendState() {
    const time = nowMs();
    for (const [email, entry] of sendState) {
      if (entry.sendWindowStart + 60 * 60 * 1000 <= time) {
        sendState.delete(email);
      }
    }
  }

  function generateCode(): string {
    return String(randomIntImpl(100000, 1000000));
  }

  function generateNonce(): string {
    return randomBytesImpl(16).toString("hex");
  }

  function generateCsrfToken(): string {
    return randomBytesImpl(32).toString("hex");
  }

  function getCodeSecret(): string {
    if (!codeSecret) {
      const error = new Error("AUTH_CODE_SECRET is not set");
      (error as Error & { code?: string }).code = "missing_auth_code_secret";
      throw error;
    }
    return codeSecret;
  }

  function hashCode({ email, code, nonce }: { email: string; code: string; nonce: string }): string {
    return crypto
      .createHmac("sha256", getCodeSecret())
      .update(`${email}:${code}:${nonce}`)
      .digest("hex");
  }

  async function createPendingCode(email: string): Promise<CreatePendingCodeResult> {
    cleanupSendState();
    const time = nowMs();
    const entry = sendState.get(email);

    if (entry) {
      if (entry.lastSentAt + RESEND_COOLDOWN_MS > time) {
        return { ok: false, reason: "cooldown" };
      }
      if (entry.sendWindowStart + 60 * 60 * 1000 > time && entry.sendCount >= MAX_CODE_SENDS_PER_HOUR) {
        return { ok: false, reason: "rate_limit" };
      }
    }

    const code = generateCode();
    const nonce = generateNonce();
    const codeHash = hashCode({ email, code, nonce });
    const expiresAt = new Date(time + CODE_TTL_MS);

    await pruneLoginCodesImpl();
    await upsertLoginCodeImpl({ email, codeHash, nonce, expiresAt });

    const nextState = {
      lastSentAt: time,
      sendWindowStart: entry?.sendWindowStart && entry.sendWindowStart + 60 * 60 * 1000 > time ? entry.sendWindowStart : time,
      sendCount: entry?.sendWindowStart && entry.sendWindowStart + 60 * 60 * 1000 > time ? entry.sendCount + 1 : 1
    };

    sendState.set(email, nextState);
    return { ok: true, code };
  }

  async function verifyCode(email: string, code: string): Promise<VerifyCodeResult> {
    const entry = await getLoginCodeByEmailImpl(email);

    if (!entry) {
      return { ok: false, reason: "not_found" };
    }

    const candidateHash = hashCode({ email, code, nonce: entry.nonce });
    return verifyAndConsumeLoginCodeImpl({
      email,
      codeHash: candidateHash,
      maxAttempts: MAX_VERIFY_ATTEMPTS
    });
  }

  async function maybePruneExpiredSessions(): Promise<void> {
    const now = nowMs();
    if (
      sessionPruneMinIntervalMs > 0 &&
      now - lastSessionPruneAtMs < sessionPruneMinIntervalMs
    ) {
      return;
    }

    await pruneExpiredSessionsImpl();
    lastSessionPruneAtMs = now;
  }

  async function createSession(email: string): Promise<CreatedSession> {
    await maybePruneExpiredSessions();

    const sessionId = randomBytesImpl(32).toString("hex");
    const csrfToken = generateCsrfToken();
    const createdAt = new Date(nowMs());
    const expiresAt = new Date(createdAt.getTime() + SESSION_TTL_MS);

    await insertSessionImpl({
      sessionId,
      email,
      csrfToken,
      createdAt,
      expiresAt
    });

    return {
      sessionId,
      session: {
        email,
        csrfToken,
        createdAt: createdAt.toISOString(),
        expiresAt: expiresAt.toISOString()
      }
    };
  }

  async function getSession(sessionId: string): Promise<SessionView | null> {
    await maybePruneExpiredSessions();

    const session = await getSessionByIdImpl(sessionId);
    if (!session) {
      return null;
    }

    const expiresAt = new Date(session.expiresAt);
    if (expiresAt.getTime() <= nowMs()) {
      await deleteSessionByIdImpl(sessionId);
      return null;
    }

    return {
      email: session.email,
      csrfToken: session.csrfToken,
      createdAt: new Date(session.createdAt).getTime(),
      expiresAt: expiresAt.getTime()
    };
  }

  async function revokeSession(sessionId: string): Promise<void> {
    await deleteSessionByIdImpl(sessionId);
  }

  return {
    createPendingCode,
    verifyCode,
    createSession,
    getSession,
    revokeSession
  };
}

const authStore = createAuthStore();
const {
  createPendingCode,
  verifyCode,
  createSession,
  getSession,
  revokeSession
} = authStore;

export {
  CODE_TTL_MS,
  RESEND_COOLDOWN_MS,
  MAX_CODE_SENDS_PER_HOUR,
  MAX_VERIFY_ATTEMPTS,
  SESSION_TTL_MS,
  createAuthStore,
  createPendingCode,
  verifyCode,
  createSession,
  getSession,
  revokeSession
};
