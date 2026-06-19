import { getFirstRow, getSqlClient, hasAffectedRows } from "./core.js";

type PersonalItemsReportRow = {
  email: string;
  report: Record<string, unknown>;
  personalItemUrls: string[];
  generatedAt: string | Date;
};

function normalizePersonalItemUrls(urls: unknown[]) {
  return [
    ...new Set(
      (Array.isArray(urls) ? urls : [])
        .map((url) => String(url || "").trim())
        .filter(Boolean),
    ),
  ].sort((left, right) => left.localeCompare(right));
}

export async function getPersonalItemsReportByEmail(
  email: string,
): Promise<PersonalItemsReportRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<PersonalItemsReportRow>`
    select
      email,
      report,
      personal_item_urls as "personalItemUrls",
      generated_at as "generatedAt"
    from personal_items_reports
    where email = ${email}
  `,
  );
  return row || null;
}

export async function upsertPersonalItemsReportByEmail({
  email,
  personalItemUrls,
  report,
}: {
  email: string;
  personalItemUrls: string[];
  report: Record<string, unknown>;
}): Promise<PersonalItemsReportRow> {
  const sql = getSqlClient();
  const normalizedUrls = normalizePersonalItemUrls(personalItemUrls);
  const reportJson = JSON.stringify(report);
  const row = getFirstRow(
    await sql<PersonalItemsReportRow>`
    insert into personal_items_reports (
      email,
      report,
      personal_item_urls,
      generated_at
    )
    values (
      ${email},
      ${reportJson}::jsonb,
      ${normalizedUrls}::text[],
      now()
    )
    on conflict (email) do update
    set
      report = excluded.report,
      personal_item_urls = excluded.personal_item_urls,
      generated_at = excluded.generated_at
    returning
      email,
      report,
      personal_item_urls as "personalItemUrls",
      generated_at as "generatedAt"
  `,
  );
  if (!row) {
    throw new Error("personal_items_report_upsert_failed");
  }
  return row;
}

export async function deletePersonalItemsReportByEmail(
  email: string,
): Promise<boolean> {
  const sql = getSqlClient();
  const result = await sql`
    delete from personal_items_reports
    where email = ${email}
  `;
  return hasAffectedRows(result);
}
