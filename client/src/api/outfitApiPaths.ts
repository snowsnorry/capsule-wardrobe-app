import { API_BASE_URL } from "./config";

type OutfitListOptions = {
  limit?: number;
  offset?: number;
};

function outfitUrl(path = ""): string {
  return `${API_BASE_URL}/outfits${path}`;
}

function outfitIdPath(id: string): string {
  return `/${encodeURIComponent(String(id || "").trim())}`;
}

function buildOutfitListQuery({ limit, offset }: OutfitListOptions = {}) {
  const params = new URLSearchParams();
  if (typeof limit === "number") {
    params.set("limit", String(limit));
  }
  if (typeof offset === "number") {
    params.set("offset", String(offset));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export { buildOutfitListQuery, outfitIdPath, outfitUrl };
export type { OutfitListOptions };
