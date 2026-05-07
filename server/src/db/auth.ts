import {
  getFirstRow,
  getSqlClient,
  type LoginCodeRow,
  type SessionRow,
  type VerifyAndConsumeLoginCodeResult,
} from "./core.js";

export async function pruneLoginCodes(): Promise<void> {
  const sql = getSqlClient();
  await sql`delete from login_codes where "expiresAt" <= now() or "consumedAt" is not null`;
}

export async function upsertLoginCode({
  email,
  codeHash,
  nonce,
  expiresAt,
}: {
  email: string;
  codeHash: string;
  nonce: string;
  expiresAt: Date;
}): Promise<void> {
  const sql = getSqlClient();
  await sql`
    insert into login_codes (email, "codeHash", nonce, "expiresAt", attempts, "consumedAt")
    values (${email}, ${codeHash}, ${nonce}, ${expiresAt}, 0, null)
    on conflict (email)
    do update set
      "codeHash" = excluded."codeHash",
      nonce = excluded.nonce,
      "expiresAt" = excluded."expiresAt",
      attempts = 0,
      "consumedAt" = null
  `;
}

export async function getLoginCodeByEmail(
  email: string,
): Promise<LoginCodeRow | null> {
  const sql = getSqlClient();
  const entry = getFirstRow(
    await sql<LoginCodeRow>`
    select
      email,
      "codeHash",
      nonce,
      "expiresAt",
      attempts,
      "consumedAt"
    from login_codes
    where email = ${email}
    limit 1
  `,
  );
  return entry || null;
}

export async function verifyAndConsumeLoginCode({
  email,
  codeHash,
  maxAttempts,
}: {
  email: string;
  codeHash: string;
  maxAttempts: number;
}): Promise<VerifyAndConsumeLoginCodeResult> {
  const sql = getSqlClient();

  const consumed = getFirstRow(
    await sql<{ email: string }>`
    update login_codes
    set "consumedAt" = now()
    where
      email = ${email}
      and "consumedAt" is null
      and "expiresAt" > now()
      and attempts < ${maxAttempts}
      and "codeHash" = ${codeHash}
    returning email
  `,
  );
  if (consumed) {
    return { ok: true };
  }

  const incremented = getFirstRow(
    await sql<{ attempts: number }>`
    update login_codes
    set attempts = attempts + 1
    where
      email = ${email}
      and "consumedAt" is null
      and "expiresAt" > now()
      and attempts < ${maxAttempts}
      and "codeHash" <> ${codeHash}
    returning attempts
  `,
  );
  if (incremented) {
    return { ok: false, reason: "invalid" };
  }

  const entry = getFirstRow(
    await sql<Pick<LoginCodeRow, "expiresAt" | "attempts" | "consumedAt">>`
    select "expiresAt", attempts, "consumedAt"
    from login_codes
    where email = ${email}
    limit 1
  `,
  );
  if (!entry) {
    return { ok: false, reason: "not_found" };
  }

  if (entry.consumedAt) {
    return { ok: false, reason: "invalid" };
  }

  if (new Date(entry.expiresAt).getTime() <= Date.now()) {
    await sql`delete from login_codes where email = ${email}`;
    return { ok: false, reason: "expired" };
  }

  if (entry.attempts >= maxAttempts) {
    await sql`delete from login_codes where email = ${email}`;
    return { ok: false, reason: "max_attempts" };
  }

  return { ok: false, reason: "invalid" };
}

export async function insertSession({
  sessionId,
  email,
  csrfToken,
  createdAt,
  expiresAt,
}: SessionRow): Promise<void> {
  const sql = getSqlClient();
  await sql`
    insert into user_sessions ("sessionId", email, "csrfToken", "createdAt", "expiresAt")
    values (${sessionId}, ${email}, ${csrfToken}, ${createdAt}, ${expiresAt})
  `;
}

export async function getSessionById(
  sessionId: string,
): Promise<SessionRow | null> {
  const sql = getSqlClient();
  const session = getFirstRow(
    await sql<SessionRow>`
    select "sessionId", email, "csrfToken", "createdAt", "expiresAt"
    from user_sessions
    where "sessionId" = ${sessionId}
    limit 1
  `,
  );
  return session || null;
}

export async function deleteSessionById(sessionId: string): Promise<void> {
  const sql = getSqlClient();
  await sql`delete from user_sessions where "sessionId" = ${sessionId}`;
}

export async function pruneExpiredSessions(): Promise<void> {
  const sql = getSqlClient();
  await sql`delete from user_sessions where "expiresAt" <= now()`;
}
export * from "./passkeys.js";
