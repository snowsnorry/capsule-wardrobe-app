import crypto from "node:crypto";
import {
  getLoginCodeByEmail,
  verifyAndConsumeLoginCode,
  pruneLoginCodes,
  upsertLoginCode,
  insertSession,
  getSessionById,
  deleteSessionById,
  pruneExpiredSessions,
} from "./db.js";
import {
  SESSION_TTL_MS,
  createSessionMethods,
  type PersistedSession,
  type SessionRow,
} from "./authSessionStore.js";

type LoginCodeRow = {
  nonce: string;
};

type VerifyCodeResult = {
  ok: boolean;
  reason?: string;
  [key: string]: unknown;
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
  verifyAndConsumeLoginCodeImpl?: (input: {
    email: string;
    codeHash: string;
    maxAttempts: number;
  }) => Promise<VerifyCodeResult>;
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
const SESSION_PRUNE_MIN_INTERVAL_MS = Math.max(
  0,
  Number.parseInt(process.env.SESSION_PRUNE_MIN_INTERVAL_MS || "0", 10) || 0,
);

function createAuthStore(deps: AuthStoreDeps = {}) {
  return {
    ...createLoginCodeMethods(getLoginCodeDeps(deps)),
    ...createSessionMethods(getSessionDeps(deps)),
  };
}

function getLoginCodeDeps(deps: AuthStoreDeps) {
  return {
    getLoginCodeByEmailImpl:
      deps.getLoginCodeByEmailImpl ?? getLoginCodeByEmail,
    verifyAndConsumeLoginCodeImpl:
      deps.verifyAndConsumeLoginCodeImpl ?? verifyAndConsumeLoginCode,
    pruneLoginCodesImpl: deps.pruneLoginCodesImpl ?? pruneLoginCodes,
    upsertLoginCodeImpl: deps.upsertLoginCodeImpl ?? upsertLoginCode,
    nowMsImpl: deps.nowMsImpl ?? (() => Date.now()),
    randomIntImpl:
      deps.randomIntImpl ?? ((...args) => crypto.randomInt(...args)),
    randomBytesImpl:
      deps.randomBytesImpl ?? ((size) => crypto.randomBytes(size)),
    codeSecret: deps.codeSecret ?? process.env.AUTH_CODE_SECRET,
    initialSendState: deps.initialSendState ?? [],
  };
}

function getSessionDeps(deps: AuthStoreDeps) {
  return {
    insertSessionImpl: deps.insertSessionImpl ?? insertSession,
    getSessionByIdImpl: deps.getSessionByIdImpl ?? getSessionById,
    deleteSessionByIdImpl: deps.deleteSessionByIdImpl ?? deleteSessionById,
    pruneExpiredSessionsImpl:
      deps.pruneExpiredSessionsImpl ?? pruneExpiredSessions,
    nowMsImpl: deps.nowMsImpl ?? (() => Date.now()),
    randomBytesImpl:
      deps.randomBytesImpl ?? ((size) => crypto.randomBytes(size)),
    sessionPruneMinIntervalMs:
      deps.sessionPruneMinIntervalMs ?? SESSION_PRUNE_MIN_INTERVAL_MS,
  };
}

function createLoginCodeMethods({
  getLoginCodeByEmailImpl,
  verifyAndConsumeLoginCodeImpl,
  pruneLoginCodesImpl,
  upsertLoginCodeImpl,
  nowMsImpl,
  randomIntImpl,
  randomBytesImpl,
  codeSecret,
  initialSendState,
}: Required<
  Pick<
    AuthStoreDeps,
    | "getLoginCodeByEmailImpl"
    | "verifyAndConsumeLoginCodeImpl"
    | "pruneLoginCodesImpl"
    | "upsertLoginCodeImpl"
    | "nowMsImpl"
    | "randomIntImpl"
    | "randomBytesImpl"
  >
> &
  Pick<AuthStoreDeps, "codeSecret" | "initialSendState">) {
  const sendState = new Map<string, SendStateEntry>(initialSendState);
  const getCodeSecret = () => requireCodeSecret(codeSecret);
  const hashCode = ({
    email,
    code,
    nonce,
  }: {
    email: string;
    code: string;
    nonce: string;
  }): string =>
    crypto
      .createHmac("sha256", getCodeSecret())
      .update(`${email}:${code}:${nonce}`)
      .digest("hex");

  async function createPendingCode(
    email: string,
  ): Promise<CreatePendingCodeResult> {
    cleanupSendState(sendState, nowMsImpl());
    const time = nowMsImpl();
    const entry = sendState.get(email);
    const blockedResult = getSendBlockedResult(entry, time);
    if (blockedResult) {
      return blockedResult;
    }

    const code = String(randomIntImpl(100000, 1000000));
    const nonce = randomBytesImpl(16).toString("hex");
    await pruneLoginCodesImpl();
    await upsertLoginCodeImpl({
      email,
      codeHash: hashCode({ email, code, nonce }),
      nonce,
      expiresAt: new Date(time + CODE_TTL_MS),
    });
    sendState.set(email, getNextSendState(entry, time));
    return { ok: true, code };
  }

  async function verifyCode(
    email: string,
    code: string,
  ): Promise<VerifyCodeResult> {
    const entry = await getLoginCodeByEmailImpl(email);
    if (!entry) {
      return { ok: false, reason: "not_found" };
    }

    return verifyAndConsumeLoginCodeImpl({
      email,
      codeHash: hashCode({ email, code, nonce: entry.nonce }),
      maxAttempts: MAX_VERIFY_ATTEMPTS,
    });
  }

  return { createPendingCode, verifyCode };
}

function requireCodeSecret(codeSecret: string | undefined): string {
  if (codeSecret) {
    return codeSecret;
  }
  const error = new Error("AUTH_CODE_SECRET is not set");
  (error as Error & { code?: string }).code = "missing_auth_code_secret";
  throw error;
}

function cleanupSendState(
  sendState: Map<string, SendStateEntry>,
  time: number,
): void {
  for (const [email, entry] of sendState) {
    if (entry.sendWindowStart + 60 * 60 * 1000 <= time) {
      sendState.delete(email);
    }
  }
}

function getSendBlockedResult(
  entry: SendStateEntry | undefined,
  time: number,
): CreatePendingCodeResult | null {
  if (!entry) {
    return null;
  }
  if (entry.lastSentAt + RESEND_COOLDOWN_MS > time) {
    return { ok: false, reason: "cooldown" };
  }
  return entry.sendWindowStart + 60 * 60 * 1000 > time &&
    entry.sendCount >= MAX_CODE_SENDS_PER_HOUR
    ? { ok: false, reason: "rate_limit" }
    : null;
}

function getNextSendState(
  entry: SendStateEntry | undefined,
  time: number,
): SendStateEntry {
  const isSameWindow = Boolean(
    entry?.sendWindowStart && entry.sendWindowStart + 60 * 60 * 1000 > time,
  );
  return {
    lastSentAt: time,
    sendWindowStart: isSameWindow && entry ? entry.sendWindowStart : time,
    sendCount: isSameWindow && entry ? entry.sendCount + 1 : 1,
  };
}

const authStore = createAuthStore();
const {
  createPendingCode,
  verifyCode,
  createSession,
  getSession,
  revokeSession,
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
  revokeSession,
};
