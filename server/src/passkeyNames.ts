const PASSKEY_FALLBACK_NAME = "Passkey";

const AAGUID_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const PASSKEY_PROVIDER_BY_AAGUID: Record<string, string> = {
  "bada5566-a7aa-401f-bd96-45619a55120d": "1Password",
  "d548826e-79b4-db40-a3d8-11116f7e8349": "Bitwarden",
  "ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4": "Google Password Manager",
  "fbfc3007-154e-4ecc-8c0b-6e020557d7bd": "iCloud Keychain / Apple Passwords",
  "dd4ec289-e01d-41c9-bb89-70fa845d4bf2": "iCloud Keychain / Apple Passwords",
  "08987058-cadc-4b81-b6e1-30de50dcbe96": "Windows Hello",
  "9ddd1817-af5a-4672-a2b9-3e3dd95000a9": "Windows Hello",
  "6028b017-b1d4-4c02-b4b3-afcdafc96bb2": "Windows Hello",
  "cb69481e-8ff7-4039-93ec-0a2729a154a8": "YubiKey",
  "ee882879-721c-4913-9775-3dfcce97072a": "YubiKey",
  "fa2b99dc-9e39-4257-8f92-4a30d23c4118": "YubiKey",
  "2fc0579f-8113-47ea-b116-bb5a8db9202a": "YubiKey",
  "1ac71f64-468d-4fe0-bef1-0e5f2f551f18": "YubiKey",
  "6ab56fad-881f-4a43-acb2-0be065924522": "YubiKey",
  "b2c1a50b-dad8-4dc7-ba4d-0ce9597904bc": "YubiKey",
  "20ac7a17-c814-4833-93fe-539f0d5e3389": "YubiKey",
  "4599062e-6926-4fe7-9566-9e8fb1aedaa0": "YubiKey"
};

function normalizePasskeyAaguid(aaguid: unknown): string | null {
  if (typeof aaguid !== "string") {
    return null;
  }
  const normalized = aaguid.trim().toLowerCase();
  return AAGUID_UUID_PATTERN.test(normalized) ? normalized : null;
}

function getPasskeyProviderName(aaguid: unknown): string | null {
  const normalized = normalizePasskeyAaguid(aaguid);
  return normalized ? PASSKEY_PROVIDER_BY_AAGUID[normalized] || null : null;
}

function getUserAgentPasskeyLabel(userAgent: unknown): string | null {
  if (typeof userAgent !== "string") {
    return null;
  }

  const ua = userAgent.trim();
  if (!ua) {
    return null;
  }

  const os = getUserAgentOs(ua);
  const browser = getUserAgentBrowser(ua);
  return os && browser ? `${os} ${browser}` : null;
}

function getUserAgentOs(userAgent: string): string | null {
  if (/\biphone\b/i.test(userAgent)) return "iPhone";
  if (/\bipad\b/i.test(userAgent) || /\bmacintosh\b/i.test(userAgent) && /\bmobile\//i.test(userAgent)) return "iPad";
  if (/\bandroid\b/i.test(userAgent)) return "Android";
  if (/\bwindows nt\b/i.test(userAgent)) return "Windows";
  if (/\bmac os x\b|\bmacintosh\b/i.test(userAgent)) return "macOS";
  if (/\blinux\b/i.test(userAgent)) return "Linux";
  return null;
}

function getUserAgentBrowser(userAgent: string): string | null {
  if (/\bedg\//i.test(userAgent)) return "Edge";
  if (/\bfirefox\//i.test(userAgent) || /\bfxios\//i.test(userAgent)) return "Firefox";
  if (/\bcrios\//i.test(userAgent) || /\bchrome\//i.test(userAgent)) return "Chrome";
  if (/\bsafari\//i.test(userAgent) && /\bversion\//i.test(userAgent)) return "Safari";
  return null;
}

function getDefaultPasskeyName({ aaguid, userAgent }: { aaguid: unknown; userAgent: unknown }): string {
  return getPasskeyProviderName(aaguid)
    || getUserAgentPasskeyLabel(userAgent)
    || PASSKEY_FALLBACK_NAME;
}

export {
  PASSKEY_FALLBACK_NAME,
  getDefaultPasskeyName,
  getPasskeyProviderName,
  getUserAgentPasskeyLabel,
  normalizePasskeyAaguid
};
