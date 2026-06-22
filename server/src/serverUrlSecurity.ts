import { isIP } from "node:net";
import { getSafeHttpUrl } from "../../shared/urlSecurity.js";

const IPV4_PRIVATE_172_START = 16;
const IPV4_PRIVATE_172_END = 31;
const IPV4_UNSAFE_FIRST_OCTETS = new Set([0, 10, 127]);

function normalizeHostForIpCheck(hostname: string = ""): string {
  return String(hostname || "")
    .trim()
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .toLowerCase();
}

function isLocalHostname(hostname: string = ""): boolean {
  const normalized = String(hostname || "")
    .trim()
    .toLowerCase();
  return normalized === "localhost" || normalized.endsWith(".localhost");
}

function getIpv4Octets(address: string): number[] | null {
  const octets = String(address || "")
    .trim()
    .split(".");
  if (octets.length !== 4) {
    return null;
  }

  const numbers = octets.map((octet) => Number.parseInt(octet, 10));
  return numbers.every(
    (octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255,
  )
    ? numbers
    : null;
}

function isPrivate172Range([first, second]: number[]): boolean {
  return (
    first === 172 &&
    second >= IPV4_PRIVATE_172_START &&
    second <= IPV4_PRIVATE_172_END
  );
}

function isPrivate192Range([first, second]: number[]): boolean {
  return first === 192 && second === 168;
}

function isLinkLocalRange([first, second]: number[]): boolean {
  return first === 169 && second === 254;
}

function isMetadataAddress([first, second, third, fourth]: number[]): boolean {
  return first === 100 && second === 100 && third === 100 && fourth === 200;
}

function isUnsafeIpv4Address(address: string): boolean {
  const octets = getIpv4Octets(address);
  if (!octets) {
    return true;
  }

  return (
    IPV4_UNSAFE_FIRST_OCTETS.has(octets[0]) ||
    octets[0] >= 224 ||
    isMetadataAddress(octets) ||
    isLinkLocalRange(octets) ||
    isPrivate172Range(octets) ||
    isPrivate192Range(octets)
  );
}

function getIpv4MappedIpv6Address(address: string): string {
  const normalized = normalizeHostForIpCheck(address);
  if (!normalized.startsWith("::ffff:")) {
    return "";
  }

  const mapped = normalized.slice("::ffff:".length);
  if (getIpv4Octets(mapped)) {
    return mapped;
  }

  const parts = mapped.split(":");
  if (parts.length !== 2) {
    return "";
  }
  const high = Number.parseInt(parts[0], 16);
  const low = Number.parseInt(parts[1], 16);
  if (
    !Number.isInteger(high) ||
    !Number.isInteger(low) ||
    high < 0 ||
    high > 0xffff ||
    low < 0 ||
    low > 0xffff
  ) {
    return "";
  }

  return [(high >> 8) & 0xff, high & 0xff, (low >> 8) & 0xff, low & 0xff].join(
    ".",
  );
}

function isUnsafeIpv6Address(address: string): boolean {
  const normalized = normalizeHostForIpCheck(address);
  if (!normalized) {
    return true;
  }

  const mappedIpv4 = getIpv4MappedIpv6Address(normalized);
  if (mappedIpv4) {
    return isUnsafeIpv4Address(mappedIpv4);
  }

  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("ff")
  );
}

function isUnsafeServerFetchAddress(address: string): boolean {
  const normalized = normalizeHostForIpCheck(address);
  const ipVersion = isIP(normalized);
  if (ipVersion === 4) {
    return isUnsafeIpv4Address(normalized);
  }
  if (ipVersion === 6) {
    return isUnsafeIpv6Address(normalized);
  }
  return true;
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
  isUnsafeServerFetchAddress,
  normalizeHostForIpCheck,
};
