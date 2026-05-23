import type { McpOAuthConfig } from "./types.js";

export function redirectWithOAuthError(
  redirectUri: string,
  state: string,
  error: string,
): string {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  if (state) {
    url.searchParams.set("state", state);
  }
  return url.toString();
}

export function hasValidRedirect(
  config: McpOAuthConfig,
  redirectUri: string,
): boolean {
  if (config.allowedRedirectUris.has(redirectUri)) {
    return true;
  }

  try {
    const redirectUrl = new URL(redirectUri);
    if (config.allowedRedirectOrigins.has(redirectUrl.origin)) {
      return true;
    }

    return [...config.allowedRedirectOrigins].some((allowedOrigin) =>
      allowsLoopbackRedirectOrigin(allowedOrigin, redirectUrl),
    );
  } catch {
    return false;
  }
}

function normalizeLoopbackHost(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, "").toLowerCase();
}

function isLoopbackHost(hostname: string): boolean {
  return ["localhost", "127.0.0.1", "::1"].includes(
    normalizeLoopbackHost(hostname),
  );
}

function allowsLoopbackRedirectOrigin(
  allowedOrigin: string,
  redirectUrl: URL,
): boolean {
  let allowedUrl: URL;
  try {
    allowedUrl = new URL(allowedOrigin);
  } catch {
    return false;
  }

  return (
    isLoopbackHost(allowedUrl.hostname) &&
    isLoopbackHost(redirectUrl.hostname) &&
    normalizeLoopbackHost(allowedUrl.hostname) ===
      normalizeLoopbackHost(redirectUrl.hostname) &&
    allowedUrl.protocol === redirectUrl.protocol
  );
}
