import type { McpOAuthConfig, McpReadScope } from "./types.js";

export function scopesToKey(scopes: readonly string[]): string {
  return [...scopes].sort().join(" ");
}

function scopesFromKey(scopes: string): string[] {
  return scopes
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

export function isScopeSubset(
  requestedScopes: string,
  grantedScopes: string,
): boolean {
  const granted = new Set(scopesFromKey(grantedScopes));
  return scopesFromKey(requestedScopes).every((scope) => granted.has(scope));
}

export function parseScopes(
  config: McpOAuthConfig,
  rawScope: string,
): McpReadScope[] | null {
  const requested = rawScope
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
  if (requested.length === 0) {
    return null;
  }

  const supported = new Set(config.scopesSupported);
  if (requested.some((scope) => !supported.has(scope as McpReadScope))) {
    return null;
  }

  return requested as McpReadScope[];
}
