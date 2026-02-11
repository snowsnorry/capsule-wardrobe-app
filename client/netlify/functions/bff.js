const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length"
]);

function matchesPrefix(path, prefix) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

function stripPrefix(path, prefix) {
  const stripped = path.slice(prefix.length);
  return stripped ? (stripped.startsWith("/") ? stripped : `/${stripped}`) : "/";
}

function getStripPrefixes() {
  return String(process.env.BFF_STRIP_PREFIXES || "/api")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (item.startsWith("/") ? item : `/${item}`));
}

function toPathnameFromUrl(rawUrl) {
  if (!rawUrl) return null;
  try {
    return new URL(rawUrl).pathname;
  } catch {
    return null;
  }
}

function normalizePath(pathValue) {
  let path = String(pathValue || "");
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  return path;
}

function stripFunctionsMountPrefix(path) {
  const marker = "/functions/";
  const markerIndex = path.indexOf(marker);
  if (markerIndex === -1) return null;

  const afterMarker = path.slice(markerIndex + marker.length);
  const slashIndex = afterMarker.indexOf("/");
  if (slashIndex === -1) return "/";

  return `/${afterMarker.slice(slashIndex + 1)}`;
}

function normalizeEventPath(event) {
  const candidates = [toPathnameFromUrl(event.rawUrl), event.rawPath, event.path]
    .filter(Boolean)
    .map(normalizePath);

  const prefixes = getStripPrefixes();
  for (const candidate of candidates) {
    for (const prefix of prefixes) {
      if (matchesPrefix(candidate, prefix)) {
        return stripPrefix(candidate, prefix);
      }
    }
  }

  for (const candidate of candidates) {
    const stripped = stripFunctionsMountPrefix(candidate);
    if (stripped) {
      return stripped;
    }
  }

  return candidates[0] || "/";
}

function buildUpstreamUrl(event, upstreamOrigin) {
  const upstreamUrl = new URL(normalizeEventPath(event), upstreamOrigin);
  if (event.rawQuery) {
    upstreamUrl.search = event.rawQuery;
  }
  return upstreamUrl.toString();
}

function filterRequestHeaders(headers = {}) {
  const result = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!value) continue;
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) continue;
    result[key] = value;
  }
  return result;
}

function filterResponseHeaders(headers) {
  const result = {};
  for (const [key, value] of headers.entries()) {
    if (!value) continue;
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) continue;
    result[key] = value;
  }
  return result;
}

export async function handler(event) {
  const upstreamOrigin = process.env.BFF_UPSTREAM_ORIGIN;
  if (!upstreamOrigin) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "missing_bff_upstream_origin" })
    };
  }

  const url = buildUpstreamUrl(event, upstreamOrigin);
  const method = event.httpMethod || "GET";
  const headers = filterRequestHeaders(event.headers);
  const hasBody = !["GET", "HEAD"].includes(method.toUpperCase());
  const body = hasBody
    ? event.isBase64Encoded
      ? Buffer.from(event.body || "", "base64")
      : event.body
    : undefined;

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(url, {
      method,
      headers,
      body,
      redirect: "manual"
    });
  } catch (error) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: "upstream_unavailable" })
    };
  }

  const responseHeaders = filterResponseHeaders(upstreamResponse.headers);
  const setCookie = upstreamResponse.headers.get("set-cookie");
  if (setCookie) {
    responseHeaders["set-cookie"] = setCookie;
  }

  const responseBody = await upstreamResponse.text();
  return {
    statusCode: upstreamResponse.status,
    headers: responseHeaders,
    body: responseBody
  };
}
