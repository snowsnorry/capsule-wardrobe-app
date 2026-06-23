import type { ProductRow } from "./core.js";

type JsonObject = Record<string, unknown>;

export type UserWardrobeSource = "uploaded" | "from_catalog";
type UserWardrobeProcessingStatus =
  | "uploaded"
  | "image_processing"
  | "metadata_processed"
  | "needs_review"
  | "ready"
  | "failed";

export type UserWardrobeRow = ProductRow &
  JsonObject & {
    id: string;
    profileEmail: string;
    productId: string | null;
    ownedR2ImageKeys?: string[] | null;
    source: UserWardrobeSource;
    rawImageUrl: string | null;
    processingStatus: UserWardrobeProcessingStatus;
    embedding?: unknown;
    createdAt: string | Date;
    updatedAt: string | Date;
  };
