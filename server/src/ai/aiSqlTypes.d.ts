import type {
  WardrobeUiItemLike
} from "./types.js";

type CapsuleWardrobeSqlRow = WardrobeUiItemLike & {
  embedding?: unknown;
};

type CapsuleWardrobeSqlClient = {
  <TRow = unknown>(strings: TemplateStringsArray, ...values: readonly unknown[]): Promise<TRow[] | { count: number }>;
};

type CapsuleWardrobeSqlParams = {
  categories: string[];
  formalityLevel: string | null;
  style: string | null;
  occasions: string[];
  season: string[];
  audienceFilters: string[];
  color: string | null;
  pattern: string;
  rejectedUrls: string[];
  embeddingVector: string;
  noiseFactor: number;
};

export type {
  CapsuleWardrobeSqlClient,
  CapsuleWardrobeSqlParams,
  CapsuleWardrobeSqlRow
};
