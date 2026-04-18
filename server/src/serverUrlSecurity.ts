import { isIP } from "node:net";
import { getSafeHttpUrl } from "../../shared/urlSecurity.js";

function normalizeHostForIpCheck(hostname: string = ""): string {
  return String(hostname || "")
    .trim()
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .toLowerCase();
}

function isLocalHostname(hostname: string = ""): boolean {
  const normalized = String(hostname || "").trim().toLowerCase();
  return normalized === "localhost" || normalized.endsWith(".localhost");
}

function getSafeServerFetchUrl(rawValue: unknown): string {
  const safeUrl = getSafeHttpUrl(rawValue);
  if (!safeUrl) {
    return "";
  }

  try {
    const parsedUrl = new URL(safeUrl);
    const hostname = normalizeHostForIpCheck(parsedUrl.hostname);

    if (!hostname || isLocalHostname(hostname)) {
      return "";
    }

    // Reject all literal IP hosts so private, loopback, and link-local
    // addresses cannot be reached through server-side fetches.
    if (isIP(hostname)) {
      return "";
    }

    return parsedUrl.toString();
  } catch {
    return "";
  }
}

export {
  getSafeServerFetchUrl,
  isLocalHostname,
  normalizeHostForIpCheck
};
