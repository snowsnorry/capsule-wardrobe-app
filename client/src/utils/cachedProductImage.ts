import { API_BASE_URL } from "../api/config";
import { getSafeHttpUrl } from "../../../shared/urlSecurity.js";

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return bytesToHex(new Uint8Array(digest));
}

async function buildCachedProductImageUrl(originalImageUrl: unknown): Promise<string> {
  const original = String(originalImageUrl ?? "").trim();
  if (!getSafeHttpUrl(original)) {
    return "";
  }

  const digest = await sha256Hex(original);
  return `${API_BASE_URL}/images/${digest}.jpg`;
}

export { buildCachedProductImageUrl, sha256Hex };
