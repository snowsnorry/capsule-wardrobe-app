import { createMcpOAuthConfig } from "./mcp/oauthConfig.js";

const REQUIRED_PRODUCTION_ENV = [
  "CLIENT_ORIGIN",
  "PASSKEY_ORIGIN",
  "PASSKEY_RP_ID",
  "DATABASE_URL",
  "AUTH_CODE_SECRET",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
] as const;

const LOCAL_HOSTNAMES = new Set([
  "localhost",
  "0.0.0.0",
  "127.0.0.1",
  "::1",
  "[::1]",
]);

type StartupPreflightOptions = {
  clientOrigin?: string;
  createMcpOAuthConfigImpl?: () => unknown;
  env?: NodeJS.ProcessEnv;
  nodeEnv?: string;
  passkeyOrigin?: string;
  passkeyRpId?: string;
};

function readRequiredEnv(
  env: NodeJS.ProcessEnv,
  name: (typeof REQUIRED_PRODUCTION_ENV)[number],
  failures: string[],
): string {
  const value = String(env[name] || "").trim();
  if (!value) {
    failures.push(`${name} is not set`);
  }
  return value;
}

function normalizeHostname(hostname: string): string {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/^\[(.*)]$/, "$1");
}

function isLocalHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  return LOCAL_HOSTNAMES.has(normalized) || normalized.startsWith("127.");
}

function parseHttpsNonLocalOrigin(
  value: string,
  name: string,
  failures: string[],
): URL | null {
  try {
    const url = new URL(value);
    if (url.origin !== value.replace(/\/+$/, "")) {
      failures.push(`${name} must be an origin without path, query, or hash`);
    }
    if (url.protocol !== "https:") {
      failures.push(`${name} must use https`);
    }
    if (isLocalHostname(url.hostname)) {
      failures.push(`${name} must not use localhost or loopback`);
    }
    return url;
  } catch {
    failures.push(`${name} must be a valid URL origin`);
    return null;
  }
}

function validateHostnameOnly(
  value: string,
  name: string,
  failures: string[],
): string | null {
  if (/[/:@?#\s]/.test(value)) {
    failures.push(`${name} must be a hostname only`);
    return null;
  }

  try {
    const url = new URL(`https://${value}`);
    if (url.hostname !== value.toLowerCase() || url.pathname !== "/") {
      failures.push(`${name} must be a hostname only`);
      return null;
    }
    if (isLocalHostname(url.hostname)) {
      failures.push(`${name} must not use localhost or loopback`);
    }
    return url.hostname;
  } catch {
    failures.push(`${name} must be a valid hostname`);
    return null;
  }
}

function throwPreflightError(failures: string[]): never {
  throw new Error(
    `production_startup_preflight_failed: ${failures.join("; ")}`,
  );
}

function readRequiredProductionEnvValues(
  env: NodeJS.ProcessEnv,
  failures: string[],
): Record<(typeof REQUIRED_PRODUCTION_ENV)[number], string> {
  return Object.fromEntries(
    REQUIRED_PRODUCTION_ENV.map((name) => [
      name,
      readRequiredEnv(env, name, failures),
    ]),
  ) as Record<(typeof REQUIRED_PRODUCTION_ENV)[number], string>;
}

function validateProductionOrigins({
  clientOrigin,
  passkeyOrigin,
  passkeyRpId,
}: Pick<
  StartupPreflightOptions,
  "clientOrigin" | "passkeyOrigin" | "passkeyRpId"
>): string[] {
  const failures: string[] = [];
  const clientOriginUrl = parseHttpsNonLocalOrigin(
    clientOrigin || "",
    "CLIENT_ORIGIN",
    failures,
  );
  const passkeyOriginUrl = parseHttpsNonLocalOrigin(
    passkeyOrigin || "",
    "PASSKEY_ORIGIN",
    failures,
  );
  const passkeyRpHostname = validateHostnameOnly(
    passkeyRpId || "",
    "PASSKEY_RP_ID",
    failures,
  );

  if (
    clientOriginUrl &&
    passkeyOriginUrl &&
    clientOriginUrl.origin !== passkeyOriginUrl.origin
  ) {
    failures.push("CLIENT_ORIGIN must match PASSKEY_ORIGIN");
  }

  if (
    passkeyOriginUrl &&
    passkeyRpHostname &&
    passkeyRpHostname !== passkeyOriginUrl.hostname
  ) {
    failures.push("PASSKEY_RP_ID must match PASSKEY_ORIGIN hostname");
  }

  return failures;
}

function validateMcpOAuthConfig(
  createMcpOAuthConfigImpl: () => unknown,
): string[] {
  try {
    createMcpOAuthConfigImpl();
    return [];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [`MCP OAuth config invalid: ${message}`];
  }
}

function resolveConfiguredValue(
  requiredValue: string,
  configuredValue: string | undefined,
): string {
  if (requiredValue) {
    return requiredValue;
  }
  return configuredValue?.trim() || "";
}

function collectProductionStartupFailures({
  clientOrigin,
  createMcpOAuthConfigImpl = createMcpOAuthConfig,
  env = process.env,
  passkeyOrigin,
  passkeyRpId,
}: StartupPreflightOptions): string[] {
  const failures: string[] = [];
  const requiredValues = readRequiredProductionEnvValues(env, failures);

  failures.push(
    ...validateProductionOrigins({
      clientOrigin: resolveConfiguredValue(
        requiredValues.CLIENT_ORIGIN,
        clientOrigin,
      ),
      passkeyOrigin: resolveConfiguredValue(
        requiredValues.PASSKEY_ORIGIN,
        passkeyOrigin,
      ),
      passkeyRpId: resolveConfiguredValue(
        requiredValues.PASSKEY_RP_ID,
        passkeyRpId,
      ),
    }),
    ...validateMcpOAuthConfig(createMcpOAuthConfigImpl),
  );

  return failures;
}

export function runProductionStartupPreflight(
  options: StartupPreflightOptions = {},
): void {
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;
  if (nodeEnv !== "production") {
    return;
  }

  const failures = collectProductionStartupFailures(options);
  if (failures.length > 0) {
    throwPreflightError(failures);
  }
}
