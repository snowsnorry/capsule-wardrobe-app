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

function buildUpstreamUrl(event, upstreamOrigin) {
  const rawPath = event.path.replace(/^\/\.netlify\/functions\/bff/, "") || "/";
  const upstreamUrl = new URL(rawPath, upstreamOrigin);
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
