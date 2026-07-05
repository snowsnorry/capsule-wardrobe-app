import { getFirstRow, getResultRows, getSqlClient } from "./core.js";
import { normalizeWardrobeSource, toWardrobeUiItem } from "./wardrobeMapper.js";
import type { UserWardrobeRow, UserWardrobeSource } from "./wardrobeTypes.js";

const WARDROBE_ITEMS_DEFAULT_PAGE_LIMIT = 48;
const WARDROBE_ITEMS_MAX_PAGE_LIMIT = 96;

type WardrobePageCursor = {
  createdAt: string;
  id: string;
  updatedAt: string;
};

type WardrobePageResult = {
  items: Array<Record<string, unknown>>;
  pagination: {
    hasMore: boolean;
    limit: number;
    nextCursor: string | null;
  };
};

export {
  deleteWardrobeItemFromCatalogByUrl,
  saveWardrobeItemFromCatalogByUrl,
} from "./wardrobeCatalog.js";
export { saveUploadedWardrobeItemsByEmail } from "./wardrobeUploadedItems.js";

function normalizeWardrobePageLimit(limit: unknown): number {
  const parsed = Number.parseInt(String(limit || ""), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return WARDROBE_ITEMS_DEFAULT_PAGE_LIMIT;
  }

  return Math.min(parsed, WARDROBE_ITEMS_MAX_PAGE_LIMIT);
}

function normalizeCursorDate(value: unknown): string {
  const text = String(value || "").trim();
  const time = Date.parse(text);
  return Number.isFinite(time) ? new Date(time).toISOString() : "";
}

function normalizeCursorId(value: unknown): string {
  const text = String(value || "").trim();
  return /^[1-9]\d*$/.test(text) ? text : "";
}

export function encodeWardrobePageCursor(
  row: Pick<UserWardrobeRow, "createdAt" | "id" | "updatedAt"> | null,
): string | null {
  if (!row) {
    return null;
  }

  const cursor: WardrobePageCursor = {
    createdAt: normalizeCursorDate(row.createdAt),
    id: normalizeCursorId(row.id),
    updatedAt: normalizeCursorDate(row.updatedAt),
  };
  if (!cursor.createdAt || !cursor.id || !cursor.updatedAt) {
    return null;
  }

  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeWardrobePageCursor(
  cursor: unknown,
): WardrobePageCursor | null {
  const encoded = String(cursor || "").trim();
  if (!encoded) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as Partial<WardrobePageCursor>;
    const decoded = {
      createdAt: normalizeCursorDate(parsed.createdAt),
      id: normalizeCursorId(parsed.id),
      updatedAt: normalizeCursorDate(parsed.updatedAt),
    };
    return decoded.createdAt && decoded.id && decoded.updatedAt
      ? decoded
      : null;
  } catch {
    return null;
  }
}

function getWardrobeRowsPageResult({
  limit,
  rows,
}: {
  limit: number;
  rows: UserWardrobeRow[];
}): WardrobePageResult {
  const pageRows = rows.slice(0, limit);
  const lastRow = pageRows.at(-1) || null;
  return {
    items: pageRows.map(toWardrobeUiItem),
    pagination: {
      hasMore: rows.length > limit,
      limit,
      nextCursor:
        rows.length > limit ? encodeWardrobePageCursor(lastRow) : null,
    },
  };
}

export async function listWardrobeItemsPageByEmail({
  cursor,
  email,
  likedOnly = false,
  limit,
  source,
}: {
  cursor?: string | null;
  email: string;
  likedOnly?: boolean;
  limit?: number | null;
  source?: UserWardrobeSource | null;
}): Promise<WardrobePageResult> {
  const sql = getSqlClient();
  const normalizedCursor = decodeWardrobePageCursor(cursor);
  const normalizedLimit = normalizeWardrobePageLimit(limit);
  const normalizedSource = normalizeWardrobeSource(source);
  const resultLimit = normalizedLimit + 1;

  const rows = getResultRows(
    await sql<UserWardrobeRow>`
    select
      wardrobe.id,
      wardrobe.profile_email as "profileEmail",
      wardrobe.product_id as "productId",
      wardrobe.name,
      wardrobe.url,
      wardrobe.description,
      wardrobe.brand,
      wardrobe.price,
      wardrobe.currency,
      wardrobe.availability,
      wardrobe.image_url as "imageUrl",
      wardrobe.audience,
      wardrobe.category,
      wardrobe.season,
      wardrobe.formality_level as "formalityLevel",
      wardrobe.style,
      wardrobe.occasions,
      wardrobe.color_base as "colorBase",
      wardrobe.pattern,
      wardrobe.finish,
      wardrobe.is_neutral as "isNeutral",
      wardrobe.composition,
      wardrobe.silhouette,
      wardrobe.fit,
      wardrobe.closure_type as "closureType",
      wardrobe.source,
      wardrobe.raw_image_url as "rawImageUrl",
      wardrobe.processing_status as "processingStatus",
      wardrobe.created_at as "createdAt",
      wardrobe.updated_at as "updatedAt",
      exists (
        select 1
        from user_liked_items
        where user_liked_items.user_email = ${email}
          and user_liked_items.item_url = wardrobe.url
      ) as "isLiked"
    from wardrobe
    where wardrobe.profile_email = ${email}
      and (${normalizedSource}::text is null or wardrobe.source = ${normalizedSource})
      and (
        ${normalizedCursor?.updatedAt ?? null}::timestamptz is null
        or (wardrobe.updated_at, wardrobe.created_at, wardrobe.id) < (
          ${normalizedCursor?.updatedAt ?? null}::timestamptz,
          ${normalizedCursor?.createdAt ?? null}::timestamptz,
          ${normalizedCursor?.id ?? null}::bigint
        )
      )
      and (
        ${likedOnly}::boolean is false
        or exists (
          select 1
          from user_liked_items
          where user_liked_items.user_email = ${email}
            and user_liked_items.item_url = wardrobe.url
        )
      )
    order by wardrobe.updated_at desc, wardrobe.created_at desc, wardrobe.id desc
    limit ${resultLimit}
  `,
  );

  return getWardrobeRowsPageResult({ limit: normalizedLimit, rows });
}

export async function listWardrobeItemsByEmail({
  email,
  source,
}: {
  email: string;
  source?: UserWardrobeSource | null;
}): Promise<Array<Record<string, unknown>>> {
  const sql = getSqlClient();
  const normalizedSource = normalizeWardrobeSource(source);

  const rows = getResultRows(
    await sql<UserWardrobeRow>`
    select
      id,
      profile_email as "profileEmail",
      product_id as "productId",
      name,
      url,
      description,
      brand,
      price,
      currency,
      availability,
      image_url as "imageUrl",
      audience,
      category,
      season,
      formality_level as "formalityLevel",
      style,
      occasions,
      color_base as "colorBase",
      pattern,
      finish,
      is_neutral as "isNeutral",
      composition,
      silhouette,
      fit,
      closure_type as "closureType",
      source,
      raw_image_url as "rawImageUrl",
      processing_status as "processingStatus",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from wardrobe
    where profile_email = ${email}
      and (${normalizedSource}::text is null or source = ${normalizedSource})
    order by updated_at desc, created_at desc, id desc
  `,
  );

  return rows.map(toWardrobeUiItem);
}

export async function countWardrobeItemsByEmail({
  email,
  source,
}: {
  email: string;
  source?: UserWardrobeSource | null;
}): Promise<number> {
  const sql = getSqlClient();
  const normalizedSource = normalizeWardrobeSource(source);
  const row = getFirstRow(
    await sql<{ count: string | number }>`
    select count(*) as count
    from wardrobe
    where profile_email = ${email}
      and (${normalizedSource}::text is null or source = ${normalizedSource})
  `,
  );
  return Number(row?.count || 0);
}

export async function getUploadedWardrobeItemById({
  email,
  id,
}: {
  email: string;
  id: string;
}): Promise<Record<string, unknown> | null> {
  const normalizedId = String(id || "").trim();
  if (!normalizedId) {
    return null;
  }

  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<UserWardrobeRow>`
    select
      id,
      profile_email as "profileEmail",
      product_id as "productId",
      name,
      url,
      description,
      brand,
      price,
      currency,
      availability,
      image_url as "imageUrl",
      audience,
      category,
      season,
      formality_level as "formalityLevel",
      style,
      occasions,
      color_base as "colorBase",
      pattern,
      finish,
      is_neutral as "isNeutral",
      composition,
      silhouette,
      fit,
      closure_type as "closureType",
      source,
      raw_image_url as "rawImageUrl",
      processing_status as "processingStatus",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from wardrobe
    where profile_email = ${email}
      and id = ${normalizedId}
      and source = 'uploaded'
  `,
  );

  return row ? toWardrobeUiItem(row) : null;
}

export async function listWardrobeItemsByUrlsForEmail({
  email,
  urls,
  source,
}: {
  email: string;
  urls: unknown[];
  source: UserWardrobeSource;
}): Promise<Array<Record<string, unknown>>> {
  const normalizedUrls = Array.isArray(urls)
    ? urls.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
  const normalizedSource = normalizeWardrobeSource(source);
  if (normalizedUrls.length === 0 || !normalizedSource) {
    return [];
  }

  const sql = getSqlClient();
  const rows = getResultRows(
    await sql<UserWardrobeRow>`
    select
      wardrobe.id,
      wardrobe.profile_email as "profileEmail",
      wardrobe.product_id as "productId",
      wardrobe.name,
      selected.url,
      wardrobe.description,
      wardrobe.brand,
      wardrobe.price,
      wardrobe.currency,
      wardrobe.availability,
      wardrobe.image_url as "imageUrl",
      wardrobe.audience,
      wardrobe.category,
      wardrobe.season,
      wardrobe.formality_level as "formalityLevel",
      wardrobe.style,
      wardrobe.occasions,
      wardrobe.color_base as "colorBase",
      wardrobe.pattern,
      wardrobe.finish,
      wardrobe.is_neutral as "isNeutral",
      wardrobe.composition,
      wardrobe.silhouette,
      wardrobe.fit,
      wardrobe.closure_type as "closureType",
      wardrobe.source,
      wardrobe.raw_image_url as "rawImageUrl",
      wardrobe.processing_status as "processingStatus",
      wardrobe.created_at as "createdAt",
      wardrobe.updated_at as "updatedAt"
    from unnest(${normalizedUrls}::text[]) with ordinality as selected(url, position)
    join wardrobe on (
      wardrobe.url = selected.url
      or (
        ${normalizedSource} = 'uploaded'
        and 'wardrobe://' || wardrobe.id::text = selected.url
      )
    )
    where wardrobe.profile_email = ${email}
      and wardrobe.source = ${normalizedSource}
    order by selected.position asc, wardrobe.id asc
  `,
  );

  return rows.map(toWardrobeUiItem);
}

export async function listWardrobeItemsByIdsForEmail({
  email,
  ids,
}: {
  email: string;
  ids: number[];
}): Promise<Array<Record<string, unknown>>> {
  const normalizedIds = [
    ...new Set(
      ids
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];
  if (normalizedIds.length === 0) {
    return [];
  }

  const sql = getSqlClient();
  const rows = getResultRows(
    await sql<UserWardrobeRow>`
    select
      id,
      profile_email as "profileEmail",
      product_id as "productId",
      name,
      url,
      description,
      brand,
      price,
      currency,
      availability,
      image_url as "imageUrl",
      audience,
      category,
      season,
      formality_level as "formalityLevel",
      style,
      occasions,
      color_base as "colorBase",
      pattern,
      finish,
      is_neutral as "isNeutral",
      composition,
      silhouette,
      fit,
      closure_type as "closureType",
      source,
      raw_image_url as "rawImageUrl",
      processing_status as "processingStatus",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from wardrobe
    where profile_email = ${email}
      and id = any(${normalizedIds}::bigint[])
    order by array_position(${normalizedIds}::bigint[], id), id
  `,
  );

  return rows.map(toWardrobeUiItem);
}
