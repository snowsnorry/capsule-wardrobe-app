import {
  getFirstRow,
  getSqlClient,
  type LoginCodeRow,
  type SessionRow,
  type VerifyAndConsumeLoginCodeResult,
} from "./core.js";

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
    insert into login_codes (email, code_hash, nonce, expires_at, attempts, consumed_at)
    values (${email}, ${codeHash}, ${nonce}, ${expiresAt}, 0, null)
    on conflict (email)
    do update set
      code_hash = excluded.code_hash,
      nonce = excluded.nonce,
      expires_at = excluded.expires_at,
      attempts = 0,
      consumed_at = null
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
      code_hash as "codeHash",
      nonce,
      expires_at as "expiresAt",
      attempts,
      consumed_at as "consumedAt"
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
    set consumed_at = now()
    where
      email = ${email}
      and consumed_at is null
      and expires_at > now()
      and attempts < ${maxAttempts}
      and code_hash = ${codeHash}
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
      and consumed_at is null
      and expires_at > now()
      and attempts < ${maxAttempts}
      and code_hash <> ${codeHash}
    returning attempts
  `,
  );
  if (incremented) {
    return { ok: false, reason: "invalid" };
  }

  const entry = getFirstRow(
    await sql<Pick<LoginCodeRow, "expiresAt" | "attempts" | "consumedAt">>`
    select
      expires_at as "expiresAt",
      attempts,
      consumed_at as "consumedAt"
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
    insert into user_sessions (session_id, email, csrf_token, created_at, expires_at)
    values (${sessionId}, ${email}, ${csrfToken}, ${createdAt}, ${expiresAt})
  `;
}

export async function getSessionById(
  sessionId: string,
): Promise<SessionRow | null> {
  const sql = getSqlClient();
  const session = getFirstRow(
    await sql<SessionRow>`
    select
      session_id as "sessionId",
      email,
      csrf_token as "csrfToken",
      created_at as "createdAt",
      expires_at as "expiresAt"
    from user_sessions
    where session_id = ${sessionId}
    limit 1
  `,
  );
  return session || null;
}

export async function deleteSessionById(sessionId: string): Promise<void> {
  const sql = getSqlClient();
  await sql`delete from user_sessions where session_id = ${sessionId}`;
}
export * from "./passkeys.js";
