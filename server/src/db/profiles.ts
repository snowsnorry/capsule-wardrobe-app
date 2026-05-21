import {
  getFirstRow,
  getSqlClient,
  hasAffectedRows,
  type CreateProfileInput,
  type ProfileRow,
  type UpdateProfileActiveCapsuleInput,
  type UpdateProfileInput,
} from "./core.js";

export async function getProfileByEmail(
  email: string,
): Promise<ProfileRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<ProfileRow>`
    select
      email,
      active_capsule_id as "activeCapsuleId",
      locale,
      fullname,
      theme,
      llm,
      image_llm as "imageLlm",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from profiles
    where email = ${email}
    limit 1
  `,
  );
  return row || null;
}

export async function createProfileRecord({
  email,
  locale,
}: CreateProfileInput): Promise<ProfileRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<ProfileRow>`
    insert into profiles (
      email,
      active_capsule_id,
      locale
    )
    values (
      ${email},
      null,
      ${locale}
    )
    on conflict (email) do nothing
    returning
      email,
      active_capsule_id as "activeCapsuleId",
      locale,
      fullname,
      theme,
      llm,
      image_llm as "imageLlm",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `,
  );
  return row || null;
}

export async function updateProfileLocaleByEmail({
  email,
  locale,
}: CreateProfileInput): Promise<ProfileRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<ProfileRow>`
    update profiles
    set
      locale = ${locale},
      updated_at = now()
    where email = ${email}
    returning
      email,
      active_capsule_id as "activeCapsuleId",
      locale,
      fullname,
      theme,
      llm,
      image_llm as "imageLlm",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `,
  );
  return row || null;
}

export async function updateProfileByEmail({
  email,
  locale,
  fullname,
  theme,
  llm,
  imageLlm,
}: UpdateProfileInput): Promise<ProfileRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<ProfileRow>`
    update profiles
    set
      locale = ${locale},
      fullname = ${fullname},
      theme = ${theme},
      llm = ${llm},
      image_llm = ${imageLlm},
      updated_at = now()
    where email = ${email}
    returning
      email,
      active_capsule_id as "activeCapsuleId",
      locale,
      fullname,
      theme,
      llm,
      image_llm as "imageLlm",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `,
  );
  return row || null;
}

export async function updateProfileActiveCapsuleIdByEmail({
  email,
  activeCapsuleId,
}: UpdateProfileActiveCapsuleInput): Promise<ProfileRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<ProfileRow>`
    update profiles
    set
      active_capsule_id = ${activeCapsuleId},
      updated_at = now()
    where email = ${email}
    returning
      email,
      active_capsule_id as "activeCapsuleId",
      locale,
      fullname,
      theme,
      llm,
      image_llm as "imageLlm",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `,
  );
  return row || null;
}

export async function deleteProfileByEmail(email: string): Promise<boolean> {
  const sql = getSqlClient();
  await sql`delete from user_sessions where email = ${email}`;
  await sql`delete from login_codes where email = ${email}`;
  await sql`delete from mcp_oauth_refresh_tokens where user_email = ${email}`;
  await sql`delete from mcp_oauth_grants where user_email = ${email}`;
  await sql`
    delete from mcp_oauth_authorization_codes
    where user_email = ${email}
      and consumed_at is null
  `;
  await sql`delete from passkey_challenges where profile_email = ${email}`;
  await sql`delete from capsules where email = ${email}`;
  await sql`delete from shared_capsules where profile_email = ${email}`;
  await sql`delete from wardrobe where profile_email = ${email}`;
  await sql`delete from search where email = ${email}`;
  await sql`delete from profile_passkeys where profile_email = ${email}`;
  const result = await sql`
    delete from profiles
    where email = ${email}
    returning email
  `;
  return hasAffectedRows(result);
}
