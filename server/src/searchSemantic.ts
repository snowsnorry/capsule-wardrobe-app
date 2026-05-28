import { getPromptEmbeddings } from "./ai/voyageai.js";

export type SearchTextMode =
  | "none"
  | "urlPrefix"
  | "lexical"
  | "hybrid"
  | "semantic";

type SearchTextRouting = {
  mode: SearchTextMode;
  query: string;
  textQuery: string | null;
  urlPrefix: string | null;
  usesEmbedding: boolean;
};

type SearchRow = {
  query?: unknown;
  embedding?: number[] | null;
};

function normalizeQuery(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function normalizeStoredEmbedding(value: unknown): number[] | null {
  return Array.isArray(value) && value.length > 0 ? value : null;
}

export function getSemanticDistanceThreshold(
  query: string = "",
): number | null {
  const normalizedLength = String(query || "").trim().length;

  if (normalizedLength === 0) {
    return null;
  }

  if (normalizedLength < 20) {
    return 0.4;
  }

  if (normalizedLength < 60) {
    return 0.35;
  }

  return 0.31;
}

export function getRelaxedSemanticDistanceThreshold(
  query: string = "",
): number | null {
  const baseThreshold = getSemanticDistanceThreshold(query);
  if (baseThreshold === null) {
    return null;
  }

  return Math.min(baseThreshold + 0.08, 0.5);
}

export function isHttpUrlQuery(query: unknown): boolean {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return false;
  }

  try {
    const url = new URL(normalized);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function routeSearchText(query: unknown): SearchTextRouting {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return {
      mode: "none",
      query: "",
      textQuery: null,
      urlPrefix: null,
      usesEmbedding: false,
    };
  }

  if (isHttpUrlQuery(normalized)) {
    return {
      mode: "urlPrefix",
      query: normalized,
      textQuery: null,
      urlPrefix: normalized,
      usesEmbedding: false,
    };
  }

  if (normalized.length <= 2) {
    return {
      mode: "none",
      query: normalized,
      textQuery: null,
      urlPrefix: null,
      usesEmbedding: false,
    };
  }

  if (normalized.length < 20) {
    return {
      mode: "lexical",
      query: normalized,
      textQuery: normalized,
      urlPrefix: null,
      usesEmbedding: false,
    };
  }

  if (normalized.length < 60) {
    return {
      mode: "hybrid",
      query: normalized,
      textQuery: normalized,
      urlPrefix: null,
      usesEmbedding: true,
    };
  }

  return {
    mode: "semantic",
    query: normalized,
    textQuery: normalized,
    urlPrefix: null,
    usesEmbedding: true,
  };
}

export async function resolveSearchEmbedding({
  currentSearch,
  query,
}: {
  currentSearch: SearchRow | null | undefined;
  query: string;
}): Promise<number[] | null> {
  if (!query) {
    return null;
  }

  if (isHttpUrlQuery(query)) {
    return null;
  }

  const savedQuery = normalizeQuery(currentSearch?.query);
  const savedEmbedding = normalizeStoredEmbedding(currentSearch?.embedding);

  if (savedQuery === query && savedEmbedding) {
    return savedEmbedding;
  }

  return getPromptEmbeddings(query);
}
