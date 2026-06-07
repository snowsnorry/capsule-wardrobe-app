import { API_BASE_URL } from "./config";
import { requestJson } from "./request";
import type { JsonObject } from "./request";

type LikedItemResponse = JsonObject & {
  itemUrl?: string;
  isLiked?: boolean;
};

async function likeItem(itemUrl: string): Promise<LikedItemResponse> {
  return requestJson(`${API_BASE_URL}/liked-items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ itemUrl }),
  }) as Promise<LikedItemResponse>;
}

async function removeItemLike(itemUrl: string): Promise<LikedItemResponse> {
  return requestJson(`${API_BASE_URL}/liked-items`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ itemUrl }),
  }) as Promise<LikedItemResponse>;
}

export { likeItem, removeItemLike };
