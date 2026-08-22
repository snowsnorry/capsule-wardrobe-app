import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";

export const SEARCH_PAGE_SIZE = 50;

type JsonObject = Record<string, unknown>;
export type SqlResultLike<TRow = unknown> = TRow[] | { count: number };
export type SqlClientLike = {
  <TRow = unknown>(
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ): Promise<SqlResultLike<TRow>>;
};
export type HasAffectedRowsResult = SqlResultLike<{
  id?: string;
  email?: string;
}>;

export type DatabaseConnectionRow = {
  database: string;
  now: string | Date;
};

export type LoginCodeRow = {
  email: string;
  codeHash: string;
  nonce: string;
  expiresAt: string | Date;
  attempts: number;
  consumedAt: string | Date | null;
};

export type SessionRow = {
  sessionId: string;
  email: string;
  csrfToken: string;
  createdAt: string | Date;
  expiresAt: string | Date;
};

export type PasskeyRow = {
  id: string;
  profileEmail: string;
  credentialId: string;
  credentialPublicKey: string;
  counter: number | string;
  deviceType: string | null;
  backedUp: boolean | null;
  transports: string[] | null;
  name: string | null;
  aaguid: string | null;
  lastUsedAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type PasskeyChallengeRow = {
  id: string;
  kind: string;
  challenge: string;
  profileEmail: string | null;
  expiresAt: string | Date;
  consumedAt: string | Date | null;
  createdAt: string | Date;
};

export type VerifyAndConsumeLoginCodeResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "not_found" | "expired" | "max_attempts" };

export type StringValueRow = { value: string | null };
export type BrandOptionRow = { value: string | null; label: string | null };
export type BooleanFlagRow = { hasProfile?: unknown };
export type NumericRangeRow = { min: unknown; max: unknown };
export type CountRow = { total?: unknown };
export type FacetRow = { value: unknown; count: unknown };
export type PriceBucketRow = {
  bucket?: unknown;
  count: unknown;
  rangeMin: unknown;
  rangeMax: unknown;
};

export type PriceBucket = {
  key: string;
  min: number;
  max: number;
  count: number;
};

export type BucketRangeRow = {
  bucket: number;
  rangeMin: number;
  rangeMax: number;
  count: number;
};

export type ProductRow = {
  id: string;
  name: string;
  url: string;
  description: string | null;
  brand: string | null;
  price: number | string | null;
  currency: string | null;
  availability: string | null;
  imageUrl: string | null;
  audience: string | null;
  category: string | null;
  season: string[] | null;
  formalityLevel: string[] | null;
  style: string[] | null;
  occasions: string[] | null;
  colorBase: string[] | null;
  pattern: string | null;
  finish: string | null;
  isNeutral: boolean | null;
  composition: string | null;
  silhouette: string | null;
  fit: string | null;
  closureType: string[] | null;
};

export type ProductSearchRow = ProductRow & {
  distance: number | string | null;
  matchedColor?: string | null;
  matchedColorShare?: number | string | null;
  matchedColorIndex?: number | string | null;
  colorDistance?: number | string | null;
  isSavedToWardrobe?: boolean | null;
  isLiked?: boolean | null;
};

export type ProductWithEmbeddingRow = ProductRow &
  JsonObject & {
    embedding?: unknown;
  };

export type SearchRow = {
  email: string;
  query: string | null;
  exactColor: string | null;
  embedding: number[] | null;
  likedOnly: boolean | null;
  brand: string[];
  priceMin: number | null;
  priceMax: number | null;
  audience: string[];
  category: string[];
  season: string[];
  formalityLevel: string[];
  style: string[];
  occasions: string[];
  color: string[];
  pattern: string[];
  silhouette: string[];
  fit: string[];
  closureType: string[];
  page: number;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type SearchRowQuery = Omit<SearchRow, "priceMin" | "priceMax"> & {
  embedding: unknown;
  priceMin: unknown;
  priceMax: unknown;
};

export type UpsertSearchInput = {
  email: string;
  query: string | null;
  exactColor: string | null;
  embedding: number[] | null;
  likedOnly: boolean;
  brand: string[];
  priceMin: number | null;
  priceMax: number | null;
  audience: string[];
  category: string[];
  season: string[];
  formalityLevel: string[];
  style: string[];
  occasions: string[];
  color: string[];
  pattern: string[];
  silhouette: string[];
  fit: string[];
  closureType: string[];
  page: number;
};

export type SearchProductsInput = {
  queryEmbedding?: number[] | null;
  semanticDistanceThreshold?: number | null;
  textQuery?: string | null;
  textSearchMode?: "none" | "lexical" | "hybrid" | "semantic" | null;
  urlPrefix?: string | null;
  profileEmail?: string | null;
  exactColor?: string | null;
  likedOnly?: boolean;
  brand?: string[];
  priceMin?: number | null;
  priceMax?: number | null;
  audience?: string[];
  category?: string[];
  season?: string[];
  formalityLevel?: string[];
  style?: string[];
  occasions?: string[];
  color?: string[];
  pattern?: string[];
  silhouette?: string[];
  fit?: string[];
  closureType?: string[];
  page?: number;
};

export type SearchProductsResult = {
  items: ProductSearchRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type ProfileRow = {
  email: string;
  activeCapsuleId: string | null;
  locale: string;
  fullname: string | null;
  theme: string | null;
  llm: string | null;
  imageLlm: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type CreateProfileInput = {
  email: string;
  locale: string;
};

export type UpdateProfileInput = {
  email: string;
  locale: string;
  fullname: string | null;
  theme: string;
  llm: string;
  imageLlm: string;
};

export type UpdateProfileActiveCapsuleInput = {
  email: string;
  activeCapsuleId: string | null;
};

export type CapsuleRow = {
  id: string;
  email: string;
  name: string;
  pin?: boolean | null;
  draft: JsonObject | null;
  saved: JsonObject | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type OutfitRow = {
  id: string;
  email: string;
  name: string;
  pin?: boolean | null;
  draft: JsonObject | null;
  saved: JsonObject | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type SharedCapsuleRow = {
  id: string;
  profileEmail: string;
  name: string;
  content: JsonObject;
  contentHash: string;
  expiresAt: string | Date;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type CreateCapsuleInput = {
  email: string;
  name: string;
  draft?: JsonObject | null;
  saved?: JsonObject | null;
};

export type CreateOutfitInput = CreateCapsuleInput;

export type CapsuleLookupInput = {
  email: string;
  capsuleId: string;
};

export type OutfitLookupInput = {
  email: string;
  outfitId: string;
};

export type UpdateCapsuleSnapshotInput = {
  email: string;
  capsuleId: string;
  draft: JsonObject | null;
};

export type UpdateCapsuleSavedSnapshotInput = {
  email: string;
  capsuleId: string;
  saved: JsonObject | null;
};

export type UpdateOutfitSnapshotInput = {
  email: string;
  outfitId: string;
  draft: JsonObject | null;
};

export type UpdateOutfitReportInput = {
  email: string;
  outfitId: string;
  report: JsonObject | null;
};

export type UpdateCapsuleReportInput = {
  email: string;
  capsuleId: string;
  report: JsonObject | null;
};

export type RenameCapsuleInput = {
  email: string;
  capsuleId: string;
  name: string;
};

export type RenameOutfitInput = {
  email: string;
  outfitId: string;
  name: string;
};

export type UpdateCapsulePinInput = {
  email: string;
  capsuleId: string;
  pin: boolean;
};

export type UpdateOutfitPinInput = {
  email: string;
  outfitId: string;
  pin: boolean;
};

export type UpsertSharedCapsuleInput = {
  profileEmail: string;
  name: string;
  content: JsonObject;
  contentHash: string;
  expiresAt: string | Date;
};

let sqlClientOverride: SqlClientLike | null = null;

export function getResultRows<TRow>(result: SqlResultLike<TRow>): TRow[] {
  return Array.isArray(result) ? result : [];
}

export function getFirstRow<TRow>(result: SqlResultLike<TRow>): TRow | null {
  return getResultRows(result)[0] ?? null;
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

export function hashCapsuleContent(content: unknown): string {
  return crypto
    .createHash("sha256")
    .update(stableStringify(content))
    .digest("hex");
}

export function toOptionalNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

export function isPriceBucket(
  row: PriceBucket | BucketRangeRow,
): row is PriceBucket {
  return "min" in row && "max" in row;
}

export function getSqlClient(): SqlClientLike {
  if (sqlClientOverride) {
    return sqlClientOverride;
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    const error = new Error("DATABASE_URL is not set");
    (error as Error & { code?: string }).code = "missing_database_url";
    throw error;
  }
  return neon(databaseUrl) as SqlClientLike;
}

export function setSqlClientOverride(
  client: SqlClientLike | null | undefined,
): void {
  sqlClientOverride = client || null;
}

export function hasAffectedRows(
  result: HasAffectedRowsResult | null | undefined,
): boolean {
  if (!result) {
    return false;
  }

  if (Array.isArray(result)) {
    return result.length > 0;
  }

  if (typeof result.count === "number") {
    return result.count > 0;
  }

  return false;
}
