import express from "express";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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
  "content-encoding",
]);

const DEFAULT_PORT = 10000;
const DEFAULT_APP_PATH = "/personal-items";
const REQUEST_BODY_LIMIT = "10mb";
export const UPSTREAM_RESPONSE_BODY_LIMIT_BYTES = 10 * 1024 * 1024;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIST_DIR = path.resolve(__dirname, "dist");
const DEFAULT_INDEX_HTML = path.join(DEFAULT_DIST_DIR, "index.html");

export class InvalidProxyPathError extends Error {
  constructor(message = "Invalid proxy path") {
    super(message);
    this.name = "InvalidProxyPathError";
  }
}

export class UpstreamResponseTooLargeError extends Error {
  constructor(message = "Upstream response exceeds proxy limit") {
    super(message);
    this.name = "UpstreamResponseTooLargeError";
  }
}

class DownstreamClosedError extends Error {
  constructor(message = "Downstream response closed") {
    super(message);
    this.name = "DownstreamClosedError";
  }
}

export function normalizeUpstreamOrigin(value) {
  const originText = String(value || "").trim();
  if (!originText) {
    throw new Error("BFF_UPSTREAM_ORIGIN is not set");
  }

  const upstreamUrl = new URL(originText);
  if (!["http:", "https:"].includes(upstreamUrl.protocol)) {
    throw new Error("BFF_UPSTREAM_ORIGIN must use http or https");
  }

  return upstreamUrl.origin;
}

function getProxyPath(originalUrl) {
  const value = String(originalUrl || "");
  if (!value.match(/^\/api(?:[/?]|$)/)) {
    throw new InvalidProxyPathError("Proxy request path must start with /api");
  }

  return value.replace(/^\/api/, "") || "/";
}

function assertSafeProxyPath(proxyPath) {
  const queryStartIndex = proxyPath.indexOf("?");
  const rawPathname =
    queryStartIndex >= 0 ? proxyPath.slice(0, queryStartIndex) : proxyPath;

  if (rawPathname.startsWith("//")) {
    throw new InvalidProxyPathError();
  }

  let decodedPathname;
  try {
    decodedPathname = decodeURIComponent(rawPathname);
  } catch {
    throw new InvalidProxyPathError("Proxy path contains invalid encoding");
  }

  if (decodedPathname.startsWith("//")) {
    throw new InvalidProxyPathError();
  }
}

export function buildUpstreamUrl(req, upstreamOrigin) {
  const normalizedOrigin = normalizeUpstreamOrigin(upstreamOrigin);
  const proxyPath = getProxyPath(req.originalUrl);
  assertSafeProxyPath(proxyPath);

  const upstreamBase = new URL(normalizedOrigin);
  const upstreamUrl = new URL("/", upstreamBase);
  const parsedProxyPath = new URL(proxyPath, upstreamBase);

  upstreamUrl.pathname = parsedProxyPath.pathname;
  upstreamUrl.search = parsedProxyPath.search;

  if (upstreamUrl.origin !== normalizedOrigin) {
    throw new InvalidProxyPathError();
  }

  return upstreamUrl.toString();
}

export function filterRequestHeaders(headers = {}) {
  const result = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!value) continue;
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) continue;
    result[key] = value;
  }
  return result;
}

export function filterResponseHeaders(headers) {
  const result = {};
  for (const [key, value] of headers.entries()) {
    if (!value) continue;
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) continue;
    result[key] = value;
  }
  return result;
}

export function readSetCookieHeaders(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie().filter(Boolean);
  }

  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

export function shouldPassthroughStreamResponse(response) {
  const contentType = String(response.headers.get("content-type") || "")
    .toLowerCase()
    .trim();
  const contentDisposition = String(
    response.headers.get("content-disposition") || "",
  )
    .toLowerCase()
    .trim();

  return (
    contentType.includes("text/event-stream") ||
    contentType.includes("application/pdf") ||
    contentDisposition.includes("attachment")
  );
}

export async function readLimitedResponseBody(
  response,
  limitBytes = UPSTREAM_RESPONSE_BODY_LIMIT_BYTES,
) {
  const contentLength = response.headers.get("content-length");
  if (contentLength) {
    const parsedLength = Number.parseInt(contentLength, 10);
    if (Number.isFinite(parsedLength) && parsedLength > limitBytes) {
      throw new UpstreamResponseTooLargeError();
    }
  }

  if (!response.body) {
    return Buffer.from(await response.arrayBuffer());
  }

  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of response.body) {
    const buffer = Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > limitBytes) {
      throw new UpstreamResponseTooLargeError();
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks, totalBytes);
}

function applyUpstreamResponseHeaders(upstreamResponse, res) {
  const responseHeaders = filterResponseHeaders(upstreamResponse.headers);
  const setCookies = readSetCookieHeaders(upstreamResponse.headers);
  delete responseHeaders["set-cookie"];

  for (const [key, value] of Object.entries(responseHeaders)) {
    res.setHeader(key, value);
  }

  if (setCookies.length > 0) {
    res.setHeader("set-cookie", setCookies);
  }
}

function waitForDrainOrClose(res) {
  if (res.destroyed || res.writableEnded) {
    return Promise.reject(new DownstreamClosedError());
  }

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      res.off("drain", onDrain);
      res.off("close", onClose);
      res.off("error", onError);
    };
    const onDrain = () => {
      cleanup();
      resolve();
    };
    const onClose = () => {
      cleanup();
      reject(new DownstreamClosedError());
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };

    res.once("drain", onDrain);
    res.once("close", onClose);
    res.once("error", onError);
  });
}

export async function sendPassthroughResponse(upstreamResponse, res) {
  applyUpstreamResponseHeaders(upstreamResponse, res);
  res.status(upstreamResponse.status);

  if (!upstreamResponse.body) {
    return res.end();
  }

  for await (const chunk of upstreamResponse.body) {
    if (res.destroyed || res.writableEnded) {
      throw new DownstreamClosedError();
    }

    const canContinue = res.write(Buffer.from(chunk));
    if (!canContinue) {
      await waitForDrainOrClose(res);
    }
  }

  return res.end();
}

export function buildDefaultAppRedirectPath(req) {
  const queryStartIndex = String(req.originalUrl || "").indexOf("?");
  return `${DEFAULT_APP_PATH}${
    queryStartIndex >= 0 ? req.originalUrl.slice(queryStartIndex) : ""
  }`;
}

export function createRenderApp({
  upstreamOrigin,
  distDir = DEFAULT_DIST_DIR,
  indexHtml = DEFAULT_INDEX_HTML,
  fetchImpl = fetch,
}) {
  const normalizedOrigin = normalizeUpstreamOrigin(upstreamOrigin);
  const app = express();

  app.use("/api", express.raw({ type: "*/*", limit: REQUEST_BODY_LIMIT }));

  app.use("/api", async (req, res) => {
    const upstreamAbortController = new AbortController();
    const abortUpstream = () => upstreamAbortController.abort();
    res.once("close", abortUpstream);
    res.once("error", abortUpstream);

    let upstreamResponse;
    try {
      upstreamResponse = await fetchImpl(
        buildUpstreamUrl(req, normalizedOrigin),
        {
          method: req.method,
          headers: filterRequestHeaders(req.headers),
          body: ["GET", "HEAD"].includes(req.method.toUpperCase())
            ? undefined
            : req.body,
          redirect: "manual",
          signal: upstreamAbortController.signal,
        },
      );
    } catch (error) {
      res.off("close", abortUpstream);
      res.off("error", abortUpstream);
      if (upstreamAbortController.signal.aborted || res.destroyed) {
        return;
      }

      if (error instanceof InvalidProxyPathError) {
        return res.status(400).json({ error: "invalid_proxy_path" });
      }

      console.error("[render-bff]", error);
      return res.status(502).json({ error: "upstream_unavailable" });
    }

    try {
      if (shouldPassthroughStreamResponse(upstreamResponse)) {
        return await sendPassthroughResponse(upstreamResponse, res);
      }

      let responseBody;
      try {
        responseBody = await readLimitedResponseBody(upstreamResponse);
      } catch (error) {
        if (error instanceof UpstreamResponseTooLargeError) {
          return res.status(502).json({ error: "upstream_response_too_large" });
        }

        throw error;
      }

      applyUpstreamResponseHeaders(upstreamResponse, res);
      return res.status(upstreamResponse.status).send(responseBody);
    } catch (error) {
      if (
        error instanceof DownstreamClosedError ||
        upstreamAbortController.signal.aborted ||
        res.destroyed
      ) {
        return;
      }

      console.error("[render-bff]", error);
      if (!res.headersSent) {
        return res.status(502).json({ error: "upstream_unavailable" });
      }
      return res.destroy(error);
    } finally {
      res.off("close", abortUpstream);
      res.off("error", abortUpstream);
    }
  });

  app.use(express.static(distDir, { index: false }));

  app.get("/", (req, res) => {
    res.redirect(302, buildDefaultAppRedirectPath(req));
  });

  app.get("/{*splat}", (_req, res) => {
    res.sendFile(indexHtml);
  });

  return app;
}

export function startRenderServer({
  port = Number.parseInt(process.env.PORT || String(DEFAULT_PORT), 10),
  upstreamOrigin = process.env.BFF_UPSTREAM_ORIGIN,
} = {}) {
  const app = createRenderApp({ upstreamOrigin });
  return app.listen(port, () => {
    console.log(`[render-client] listening on :${port}`);
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  startRenderServer();
}
