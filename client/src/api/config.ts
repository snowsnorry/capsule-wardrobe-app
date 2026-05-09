const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
const API_BASE_URL = rawApiBaseUrl.endsWith("/")
  ? rawApiBaseUrl.slice(0, -1)
  : rawApiBaseUrl;

const rawThumbnailAssetBaseUrl =
  import.meta.env.VITE_THUMBNAIL_ASSET_BASE_URL ||
  "https://assets.capsule-wardrobe.org/thumbnails";
const THUMBNAIL_ASSET_BASE_URL = rawThumbnailAssetBaseUrl.endsWith("/")
  ? rawThumbnailAssetBaseUrl.slice(0, -1)
  : rawThumbnailAssetBaseUrl;

export { API_BASE_URL, THUMBNAIL_ASSET_BASE_URL };
