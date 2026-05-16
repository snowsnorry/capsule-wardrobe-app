import type { WardrobeUiItemLike } from "./types.js";

type CapsuleWardrobeSqlRow = WardrobeUiItemLike & {
  embedding?: unknown;
  item_source?: "catalog" | "wardrobe";
};

type CapsuleWardrobeSqlClient = {
  <TRow = unknown>(
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ): Promise<TRow[] | { count: number }>;
};

type CapsuleWardrobeSqlParams = {
  categories: string[];
  sourceMode: "catalog_only" | "wardrobe_preferred";
  profileEmail: string;
  wardrobeBoost: number;
  catalogPoolLimit: number;
  wardrobePoolLimit: number;
  finalCandidateLimit: number;
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
  CapsuleWardrobeSqlRow,
};
