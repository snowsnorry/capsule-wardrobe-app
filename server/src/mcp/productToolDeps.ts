import type { ProductRowLike } from "./productToolOutput.js";

export type ProductToolsDeps = {
  profileEmail: string;
  runSearchImpl: (
    email: string,
    payload: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  getSearchStatsImpl: (
    email: string,
    payload: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  getSearchOptionsImpl: (email: string) => Promise<Record<string, unknown>>;
  getProductByIdImpl: (
    id: string,
    email: string,
  ) => Promise<ProductRowLike | null>;
  getProductByUrlImpl: (
    url: string,
    email: string,
  ) => Promise<ProductRowLike | null>;
};
