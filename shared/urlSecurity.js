const ALLOWED_HTTP_PROTOCOLS = new Set(["http:", "https:"]);

function getSafeHttpUrl(rawValue) {
  const trimmed = String(rawValue || "").trim();
  if (!trimmed) {
    return "";
  }

  try {
    const parsedUrl = new URL(trimmed);
    if (!ALLOWED_HTTP_PROTOCOLS.has(parsedUrl.protocol)) {
      return "";
    }
    return parsedUrl.toString();
  } catch {
    return "";
  }
}

function isSafeHttpUrl(rawValue) {
  return getSafeHttpUrl(rawValue).length > 0;
}

export {
  ALLOWED_HTTP_PROTOCOLS,
  getSafeHttpUrl,
  isSafeHttpUrl
};
