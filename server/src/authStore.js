import crypto from "node:crypto";

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_CODE_SENDS_PER_HOUR = 5;
const MAX_VERIFY_ATTEMPTS = 5;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const pendingCodes = new Map();
const sessions = new Map();

function now() {
  return Date.now();
}

function cleanupExpired() {
  const time = now();
  for (const [email, entry] of pendingCodes) {
    if (entry.expiresAt <= time) {
      pendingCodes.delete(email);
    }
  }
  for (const [sessionId, session] of sessions) {
    if (session.expiresAt <= time) {
      sessions.delete(sessionId);
    }
  }
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashCode(code, salt) {
  return crypto
    .createHash("sha256")
    .update(`${salt}:${code}`)
    .digest("hex");
}

function createPendingCode(email) {
  cleanupExpired();
  const time = now();
  const entry = pendingCodes.get(email);

  if (entry) {
    if (entry.lastSentAt + RESEND_COOLDOWN_MS > time) {
      return { ok: false, reason: "cooldown" };
    }
    if (entry.sendWindowStart + 60 * 60 * 1000 > time && entry.sendCount >= MAX_CODE_SENDS_PER_HOUR) {
      return { ok: false, reason: "rate_limit" };
    }
  }

  const code = generateCode();
  const salt = crypto.randomBytes(16).toString("hex");
  const codeHash = hashCode(code, salt);

  const nextEntry = {
    codeHash,
    salt,
    expiresAt: time + CODE_TTL_MS,
    attempts: 0,
    lastSentAt: time,
    sendWindowStart: entry?.sendWindowStart && entry.sendWindowStart + 60 * 60 * 1000 > time ? entry.sendWindowStart : time,
    sendCount: entry?.sendWindowStart && entry.sendWindowStart + 60 * 60 * 1000 > time ? entry.sendCount + 1 : 1
  };

  pendingCodes.set(email, nextEntry);
  return { ok: true, code };
}

function verifyCode(email, code) {
  cleanupExpired();
  const entry = pendingCodes.get(email);
  if (!entry) {
    return { ok: false, reason: "not_found" };
  }
  if (entry.expiresAt <= now()) {
    pendingCodes.delete(email);
    return { ok: false, reason: "expired" };
  }
  if (entry.attempts >= MAX_VERIFY_ATTEMPTS) {
    pendingCodes.delete(email);
    return { ok: false, reason: "max_attempts" };
  }

  entry.attempts += 1;

  const candidateHash = hashCode(code, entry.salt);
  if (candidateHash !== entry.codeHash) {
    return { ok: false, reason: "invalid" };
  }

  pendingCodes.delete(email);
  return { ok: true };
}

function createSession(email) {
  cleanupExpired();
  const sessionId = crypto.randomBytes(32).toString("hex");
  const session = {
    email,
    createdAt: now(),
    expiresAt: now() + SESSION_TTL_MS
  };
  sessions.set(sessionId, session);
  return { sessionId, session };
}

function getSession(sessionId) {
  cleanupExpired();
  const session = sessions.get(sessionId);
  if (!session) {
    return null;
  }
  if (session.expiresAt <= now()) {
    sessions.delete(sessionId);
    return null;
  }
  return session;
}

function revokeSession(sessionId) {
  sessions.delete(sessionId);
}

export {
  CODE_TTL_MS,
  RESEND_COOLDOWN_MS,
  MAX_CODE_SENDS_PER_HOUR,
  MAX_VERIFY_ATTEMPTS,
  SESSION_TTL_MS,
  createPendingCode,
  verifyCode,
  createSession,
  getSession,
  revokeSession
};
