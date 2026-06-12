import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  "content-length",
  "content-encoding"
]);

const PORT = Number.parseInt(process.env.PORT || "10000", 10);
const BFF_UPSTREAM_ORIGIN = String(process.env.BFF_UPSTREAM_ORIGIN || "").trim();
const DEFAULT_APP_PATH = "/personal-items";

if (!BFF_UPSTREAM_ORIGIN) {
  throw new Error("BFF_UPSTREAM_ORIGIN is not set");
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, "dist");
const INDEX_HTML = path.join(DIST_DIR, "index.html");
const app = express();

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

function readSetCookieHeaders(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie().filter(Boolean);
  }

  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

function buildUpstreamUrl(req) {
  const upstreamUrl = new URL(req.originalUrl.replace(/^\/api/, "") || "/", BFF_UPSTREAM_ORIGIN);
  return upstreamUrl.toString();
}

function buildDefaultAppRedirectPath(req) {
  const queryStartIndex = String(req.originalUrl || "").indexOf("?");
  return `${DEFAULT_APP_PATH}${
    queryStartIndex >= 0 ? req.originalUrl.slice(queryStartIndex) : ""
  }`;
}

app.use("/api", express.raw({ type: "*/*", limit: "10mb" }));

app.use("/api", async (req, res) => {
  let upstreamResponse;
  try {
    upstreamResponse = await fetch(buildUpstreamUrl(req), {
      method: req.method,
      headers: filterRequestHeaders(req.headers),
      body: ["GET", "HEAD"].includes(req.method.toUpperCase()) ? undefined : req.body,
      redirect: "manual"
    });
  } catch (error) {
    console.error("[render-bff]", error);
    return res.status(502).json({ error: "upstream_unavailable" });
  }

  const responseHeaders = filterResponseHeaders(upstreamResponse.headers);
  const setCookies = readSetCookieHeaders(upstreamResponse.headers);
  delete responseHeaders["set-cookie"];

  for (const [key, value] of Object.entries(responseHeaders)) {
    res.setHeader(key, value);
  }

  if (setCookies.length > 0) {
    res.setHeader("set-cookie", setCookies);
  }

  const responseBody = Buffer.from(await upstreamResponse.arrayBuffer());
  return res.status(upstreamResponse.status).send(responseBody);
});

app.use(express.static(DIST_DIR, { index: false }));

app.get("/", (req, res) => {
  res.redirect(302, buildDefaultAppRedirectPath(req));
});

app.get("/{*splat}", (_req, res) => {
  res.sendFile(INDEX_HTML);
});

app.listen(PORT, () => {
  console.log(`[render-client] listening on :${PORT}`);
});
