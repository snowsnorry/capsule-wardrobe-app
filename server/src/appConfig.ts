import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PORT = process.env.PORT || 3000;
export const CLIENT_ORIGIN =
  process.env.CLIENT_ORIGIN || "http://localhost:5173";
export const NODE_ENV = process.env.NODE_ENV || "development";
const rawThumbnailAssetBaseUrl =
  process.env.VITE_THUMBNAIL_ASSET_BASE_URL ||
  "https://assets.capsule-wardrobe.org/thumbnails";
export const THUMBNAIL_ASSET_BASE_URL = rawThumbnailAssetBaseUrl.endsWith("/")
  ? rawThumbnailAssetBaseUrl.slice(0, -1)
  : rawThumbnailAssetBaseUrl;
export const AUTH_TEST_MODE =
  NODE_ENV !== "production" &&
  ["1", "true", "yes"].includes(
    String(process.env.AUTH_TEST_MODE || "").toLowerCase(),
  );
export const E2E_SERVER = ["1", "true", "yes"].includes(
  String(process.env.E2E_SERVER || "").toLowerCase(),
);
export const SUPPORTED_LOCALES = new Set(["en", "ru"]);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST_CANDIDATES = [
  path.resolve(__dirname, "../../client/dist"),
  path.resolve(__dirname, "../../../../client/dist"),
  path.resolve(process.cwd(), "../client/dist"),
];
const CLIENT_ROOT_CANDIDATES = [
  path.resolve(__dirname, "../../client"),
  path.resolve(__dirname, "../../../../client"),
  path.resolve(process.cwd(), "../client"),
];

export const CLIENT_DIST_PATH =
  CLIENT_DIST_CANDIDATES.find((candidate) => fs.existsSync(candidate)) ||
  CLIENT_DIST_CANDIDATES[0];
export const CLIENT_ROOT =
  CLIENT_ROOT_CANDIDATES.find((candidate) => fs.existsSync(candidate)) ||
  CLIENT_ROOT_CANDIDATES[0];
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
export const PASSKEY_RP_NAME =
  process.env.PASSKEY_RP_NAME || "Capsule Wardrobe";
export const PASSKEY_RP_ID = process.env.PASSKEY_RP_ID || "localhost";
export const PASSKEY_ORIGIN =
  process.env.PASSKEY_ORIGIN || "http://localhost:3000";
export const PASSKEY_CHALLENGE_COOKIE = "passkey_challenge";
export const PASSKEY_CHALLENGE_TTL_MS = 5 * 60 * 1000;

function readBooleanEnv(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  return ["1", "true", "yes"].includes(String(value).toLowerCase());
}

export const MCP_OAUTH_ENABLED = readBooleanEnv(
  process.env.MCP_OAUTH_ENABLED,
  NODE_ENV !== "production",
);
export const MCP_OAUTH_ISSUER =
  process.env.MCP_OAUTH_ISSUER ||
  (NODE_ENV === "production" ? "" : `http://localhost:${PORT}`);
export const MCP_RESOURCE_URL =
  process.env.MCP_RESOURCE_URL ||
  (MCP_OAUTH_ISSUER ? `${MCP_OAUTH_ISSUER.replace(/\/+$/, "")}/mcp` : "");
export const MCP_ACCESS_TOKEN_TTL_SECONDS = Number(
  process.env.MCP_ACCESS_TOKEN_TTL_SECONDS || 3600,
);
export const MCP_AUTH_CODE_TTL_SECONDS = Number(
  process.env.MCP_AUTH_CODE_TTL_SECONDS || 300,
);
export const MCP_REFRESH_TOKEN_TTL_SECONDS = Number(
  process.env.MCP_REFRESH_TOKEN_TTL_SECONDS || 2592000,
);
export const MCP_JWT_SECRET =
  process.env.MCP_JWT_SECRET ||
  (NODE_ENV === "production" ? "" : "development-mcp-jwt-secret");
export const MCP_ALLOWED_CLIENT_IDS = process.env.MCP_ALLOWED_CLIENT_IDS || "";
export const MCP_ALLOWED_CLIENT_METADATA_HOSTS =
  process.env.MCP_ALLOWED_CLIENT_METADATA_HOSTS || "";
export const MCP_ALLOWED_REDIRECT_URIS =
  process.env.MCP_ALLOWED_REDIRECT_URIS || "";
export const MCP_ALLOWED_REDIRECT_ORIGINS =
  process.env.MCP_ALLOWED_REDIRECT_ORIGINS || "";

function readPositiveIntegerEnv(
  value: string | undefined,
  defaultValue: number,
): number {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

export const JOB_QUEUE_BACKEND = process.env.JOB_QUEUE_BACKEND || "pg_boss";
export const JOB_WORKER_CONCURRENCY = readPositiveIntegerEnv(
  process.env.JOB_WORKER_CONCURRENCY,
  1,
);
export const JOB_WORKER_ENABLED = readBooleanEnv(
  process.env.JOB_WORKER_ENABLED,
  NODE_ENV !== "test" && !E2E_SERVER,
);
