const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
const API_BASE_URL = rawApiBaseUrl.endsWith("/")
  ? rawApiBaseUrl.slice(0, -1)
  : rawApiBaseUrl;

export { API_BASE_URL };
