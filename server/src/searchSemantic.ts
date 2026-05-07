import { getPromptEmbeddings } from "./ai/voyageai.js";

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
