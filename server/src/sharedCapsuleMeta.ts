import { CLIENT_ORIGIN } from "./appConfig.js";

type SharedCapsuleOgMetadata = {
  title?: string | null;
  description?: string | null;
  image?: string | null;
};

function getShareRouteId(pathname: string): string | null {
  const match = String(pathname || "").match(/^\/share\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function escapeHtmlAttribute(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function resolveClientOrigin(clientOrigin = CLIENT_ORIGIN): string {
  const rawOrigin =
    String(clientOrigin || "").trim() || "http://localhost:5173";
  const originWithProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(rawOrigin)
    ? rawOrigin
    : `http://${rawOrigin}`;

  try {
    return new URL(originWithProtocol).origin;
  } catch {
    return "http://localhost:5173";
  }
}

function buildSharedCapsuleUrl(req, clientOrigin = CLIENT_ORIGIN): string {
  return `${resolveClientOrigin(clientOrigin)}${req.originalUrl}`;
}

function injectOpenGraphMetaTags(
  html: string,
  metadata: SharedCapsuleOgMetadata,
  url: string,
): string {
  const tags = [
    `<meta property="og:title" content="${escapeHtmlAttribute(metadata.title)}" />`,
    `<meta property="og:description" content="${escapeHtmlAttribute(metadata.description)}" />`,
    `<meta property="og:image" content="${escapeHtmlAttribute(metadata.image)}" />`,
    `<meta property="og:url" content="${escapeHtmlAttribute(url)}" />`,
    `<meta property="og:type" content="website" />`,
  ].join("\n    ");

  return html.replace(/<\/head>/i, `    ${tags}\n  </head>`);
}

export async function injectSharedCapsuleMetaTags(
  html: string,
  req,
  getMetadataImpl,
  { clientOrigin = CLIENT_ORIGIN } = {},
): Promise<string> {
  const shareId = getShareRouteId(req.path);
  if (!shareId) {
    return html;
  }

  const metadata = await getMetadataImpl(shareId);
  if (!metadata) {
    return html;
  }

  return injectOpenGraphMetaTags(
    html,
    metadata,
    buildSharedCapsuleUrl(req, clientOrigin),
  );
}
