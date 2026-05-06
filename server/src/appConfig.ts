import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PORT = process.env.PORT || 3000;
export const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
export const NODE_ENV = process.env.NODE_ENV || "development";
export const AUTH_TEST_MODE =
  NODE_ENV !== "production" && ["1", "true", "yes"].includes(String(process.env.AUTH_TEST_MODE || "").toLowerCase());
export const SUPPORTED_LOCALES = new Set(["en", "ru"]);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST_CANDIDATES = [
  path.resolve(__dirname, "../../client/dist"),
  path.resolve(__dirname, "../../../../client/dist"),
  path.resolve(process.cwd(), "../client/dist")
];
const CLIENT_ROOT_CANDIDATES = [
  path.resolve(__dirname, "../../client"),
  path.resolve(__dirname, "../../../../client"),
  path.resolve(process.cwd(), "../client")
];

export const CLIENT_DIST_PATH =
  CLIENT_DIST_CANDIDATES.find((candidate) => fs.existsSync(candidate)) || CLIENT_DIST_CANDIDATES[0];
export const CLIENT_ROOT =
  CLIENT_ROOT_CANDIDATES.find((candidate) => fs.existsSync(candidate)) || CLIENT_ROOT_CANDIDATES[0];
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
export const PASSKEY_RP_NAME = process.env.PASSKEY_RP_NAME || "Capsule Wardrobe";
export const PASSKEY_RP_ID = process.env.PASSKEY_RP_ID || "localhost";
export const PASSKEY_ORIGIN = process.env.PASSKEY_ORIGIN || "http://localhost:3000";
export const PASSKEY_CHALLENGE_COOKIE = "passkey_challenge";
export const PASSKEY_CHALLENGE_TTL_MS = 5 * 60 * 1000;
