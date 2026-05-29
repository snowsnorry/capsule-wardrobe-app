import { S3Client } from "@aws-sdk/client-s3";
import { setWardrobeUploadMetric } from "./wardrobeUploadProcessingMetrics.js";

type R2Config = {
  accountId: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
  imageKeyPrefix: string;
};

type S3ClientLike = {
  destroy?: () => void;
  send: (command: unknown) => Promise<unknown>;
};

type R2ClientFactory = (config: R2Config) => S3ClientLike;

function normalizeEnvValue(value: unknown): string {
  return String(value ?? "").trim();
}

function getRequiredR2Env(env: NodeJS.ProcessEnv, name: string): string {
  const value = normalizeEnvValue(env[name]);
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

function normalizePublicBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function getR2Config(env: NodeJS.ProcessEnv = process.env): R2Config {
  return {
    accountId: getRequiredR2Env(env, "R2_ACCOUNT_ID"),
    bucketName: getRequiredR2Env(env, "R2_BUCKET_NAME"),
    accessKeyId: getRequiredR2Env(env, "R2_ACCESS_KEY_ID"),
    secretAccessKey: getRequiredR2Env(env, "R2_SECRET_ACCESS_KEY"),
    publicBaseUrl: normalizePublicBaseUrl(
      getRequiredR2Env(env, "R2_PUBLIC_BASE_URL"),
    ),
    imageKeyPrefix:
      normalizeEnvValue(env.R2_IMAGE_KEY_PREFIX) || "outfit-set-images",
  };
}

function buildR2Endpoint(accountId: string): string {
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

function createR2Client(config: R2Config): S3ClientLike {
  return new S3Client({
    region: "auto",
    endpoint: buildR2Endpoint(config.accountId),
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

let r2ClientFactory: R2ClientFactory = createR2Client;

const defaultR2ClientCache = new Map<string, S3ClientLike>();

function getR2ClientCacheKey({
  accountId,
  accessKeyId,
  bucketName,
  imageKeyPrefix,
  publicBaseUrl,
}: R2Config): string {
  return JSON.stringify({
    accountId,
    accessKeyId,
    bucketName,
    imageKeyPrefix,
    publicBaseUrl,
  });
}

function getDefaultR2Client(config: R2Config): S3ClientLike {
  const cacheKey = getR2ClientCacheKey(config);
  const cachedClient = defaultR2ClientCache.get(cacheKey);
  if (cachedClient) {
    return cachedClient;
  }

  const client = r2ClientFactory(config);
  defaultR2ClientCache.set(cacheKey, client);
  setWardrobeUploadMetric("r2ClientCacheSize", defaultR2ClientCache.size);
  return client;
}

function clearDefaultR2ClientCache() {
  for (const client of defaultR2ClientCache.values()) {
    client.destroy?.();
  }
  defaultR2ClientCache.clear();
  setWardrobeUploadMetric("r2ClientCacheSize", 0);
}

function getDefaultR2ClientCacheSize() {
  return defaultR2ClientCache.size;
}

function setR2ClientFactoryForTests(factory: R2ClientFactory | null) {
  clearDefaultR2ClientCache();
  r2ClientFactory = factory || createR2Client;
}

export {
  buildR2Endpoint,
  clearDefaultR2ClientCache,
  getDefaultR2Client,
  getDefaultR2ClientCacheSize,
  getR2Config,
  setR2ClientFactoryForTests,
};
export type { R2ClientFactory, R2Config, S3ClientLike };
