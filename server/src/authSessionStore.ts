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

type SessionStoreDeps = {
  insertSessionImpl: (input: PersistedSession) => Promise<void>;
  getSessionByIdImpl: (sessionId: string) => Promise<SessionRow | null>;
  deleteSessionByIdImpl: (sessionId: string) => Promise<void>;
  pruneExpiredSessionsImpl: () => Promise<void>;
  nowMsImpl: () => number;
  randomBytesImpl: (size: number) => Buffer;
  sessionPruneMinIntervalMs: number;
};

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function createSessionMethods({
  insertSessionImpl,
  getSessionByIdImpl,
  deleteSessionByIdImpl,
  pruneExpiredSessionsImpl,
  nowMsImpl,
  randomBytesImpl,
  sessionPruneMinIntervalMs,
}: SessionStoreDeps) {
  let lastSessionPruneAtMs = 0;

  async function maybePruneExpiredSessions(): Promise<void> {
    const now = nowMsImpl();
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
    const csrfToken = randomBytesImpl(32).toString("hex");
    const createdAt = new Date(nowMsImpl());
    const expiresAt = new Date(createdAt.getTime() + SESSION_TTL_MS);

    await insertSessionImpl({
      sessionId,
      email,
      csrfToken,
      createdAt,
      expiresAt,
    });
    return {
      sessionId,
      session: {
        email,
        csrfToken,
        createdAt: createdAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
      },
    };
  }

  async function getSession(sessionId: string): Promise<SessionView | null> {
    await maybePruneExpiredSessions();
    const session = await getSessionByIdImpl(sessionId);
    return session
      ? getValidSessionView({
          sessionId,
          session,
          nowMs: nowMsImpl(),
          deleteSessionByIdImpl,
        })
      : null;
  }

  async function revokeSession(sessionId: string): Promise<void> {
    await deleteSessionByIdImpl(sessionId);
  }

  return { createSession, getSession, revokeSession };
}

async function getValidSessionView({
  sessionId,
  session,
  nowMs,
  deleteSessionByIdImpl,
}: {
  sessionId: string;
  session: SessionRow;
  nowMs: number;
  deleteSessionByIdImpl: (sessionId: string) => Promise<void>;
}): Promise<SessionView | null> {
  const expiresAt = new Date(session.expiresAt);
  if (expiresAt.getTime() <= nowMs) {
    await deleteSessionByIdImpl(sessionId);
    return null;
  }

  return {
    email: session.email,
    csrfToken: session.csrfToken,
    createdAt: new Date(session.createdAt).getTime(),
    expiresAt: expiresAt.getTime(),
  };
}

export type { PersistedSession, SessionRow };
