import { createHash, randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

type R2Config = {
  accountId: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
  imageKeyPrefix: string;
};

type S3ClientLike = {
  send: (command: PutObjectCommand) => Promise<unknown>;
};

type UploadImageInput = {
  buffer: Buffer | Uint8Array;
  mimeType?: string | null;
  capsuleId?: string | null;
  setIndex?: number | string | null;
  namespace?: string | null;
  env?: NodeJS.ProcessEnv;
  client?: S3ClientLike;
};
type UploadWardrobeImageInput = {
  buffer: Buffer | Uint8Array;
  email: string;
  env?: NodeJS.ProcessEnv;
  client?: S3ClientLike;
};
type UploadWardrobeDerivativeInput = {
  buffer: Buffer | Uint8Array;
  key: string;
  mimeType?: string | null;
  env?: NodeJS.ProcessEnv;
  client?: S3ClientLike;
};

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

function sanitizeKeySegment(value: unknown, fallback: string): string {
  const sanitized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return sanitized || fallback;
}

function getImageExtension(mimeType: unknown): string {
  const normalized = String(mimeType || "")
    .trim()
    .toLowerCase();
  if (normalized === "image/jpeg" || normalized === "image/jpg") {
    return "jpg";
  }
  if (normalized === "image/webp") {
    return "webp";
  }
  return "png";
}

function buildR2ImageKey({
  imageKeyPrefix,
  namespace,
  capsuleId,
  setIndex,
  digest,
  mimeType,
}: {
  imageKeyPrefix: string;
  namespace?: string | null;
  capsuleId?: string | null;
  setIndex?: number | string | null;
  digest: string;
  mimeType?: string | null;
}): string {
  const prefix = sanitizeKeySegment(imageKeyPrefix, "outfit-set-images");
  const scope = sanitizeKeySegment(namespace, "generated");
  const capsuleSegment = sanitizeKeySegment(capsuleId, "capsule");
  const setSegment = sanitizeKeySegment(setIndex, "set");
  const extension = getImageExtension(mimeType);
  return `${prefix}/${scope}/${capsuleSegment}/${setSegment}/${digest}.${extension}`;
}

function buildR2PublicUrl(
  config: Pick<R2Config, "publicBaseUrl">,
  key: string,
): string {
  return `${config.publicBaseUrl}/${String(key || "")
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

function buildWardrobeR2ImageKey({
  email,
  digest,
}: {
  email: string;
  digest: string;
}): string {
  const profileHash = createHash("sha256")
    .update(
      String(email || "")
        .trim()
        .toLowerCase(),
    )
    .digest("hex")
    .slice(0, 16);
  return `wardrobe/${profileHash || "profile"}/${randomUUID()}-${digest}.webp`;
}

function getKeyExtension(mimeType: unknown): string {
  return getImageExtension(mimeType);
}

function insertSuffixBeforeExtension(filename: string, suffix: string) {
  const lastDotIndex = filename.lastIndexOf(".");
  if (lastDotIndex <= 0) {
    return `${filename}${suffix}`;
  }

  return `${filename.slice(0, lastDotIndex)}${suffix}${filename.slice(lastDotIndex)}`;
}

function replaceKeyExtension(filename: string, extension: string) {
  const normalizedExtension = extension.replace(/^\.+/, "") || "png";
  const lastDotIndex = filename.lastIndexOf(".");
  if (lastDotIndex <= 0) {
    return `${filename}.${normalizedExtension}`;
  }

  return `${filename.slice(0, lastDotIndex)}.${normalizedExtension}`;
}

function getR2KeyFromPublicUrl(value: unknown): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return "";
  }

  try {
    const url = new URL(normalized);
    return url.pathname
      .split("/")
      .filter(Boolean)
      .map((part) => decodeURIComponent(part))
      .join("/");
  } catch {
    return "";
  }
}

function buildWardrobeDerivativeR2ImageKey({
  sourceKey,
  sourceUrl,
  suffix,
  mimeType,
}: {
  sourceKey?: string | null;
  sourceUrl?: string | null;
  suffix: string;
  mimeType?: string | null;
}): string {
  const key =
    String(sourceKey || "").trim() || getR2KeyFromPublicUrl(sourceUrl);
  if (!key) {
    throw new Error("wardrobe_derivative_source_key_missing");
  }

  const segments = key.split("/").filter(Boolean);
  const filename = segments.pop() || "image";
  const derivativeFilename = replaceKeyExtension(
    insertSuffixBeforeExtension(filename, suffix),
    getKeyExtension(mimeType),
  );
  return [...segments, derivativeFilename].join("/");
}

async function uploadImageToR2({
  buffer,
  mimeType = "image/png",
  capsuleId = null,
  setIndex = null,
  namespace = "generated",
  env = process.env,
  client,
}: UploadImageInput): Promise<{ key: string; url: string; digest: string }> {
  const bytes = Buffer.from(buffer);
  if (bytes.length === 0) {
    throw new Error("R2 image upload received an empty buffer");
  }

  const config = getR2Config(env);
  const digest = createHash("sha256").update(bytes).digest("hex");
  const key = buildR2ImageKey({
    imageKeyPrefix: config.imageKeyPrefix,
    namespace,
    capsuleId: capsuleId || randomUUID(),
    setIndex,
    digest,
    mimeType,
  });
  const s3 = client || createR2Client(config);

  await s3.send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Body: bytes,
      ContentType: String(mimeType || "image/png"),
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return {
    key,
    url: buildR2PublicUrl(config, key),
    digest,
  };
}

async function uploadWardrobeImageToR2({
  buffer,
  email,
  env = process.env,
  client,
}: UploadWardrobeImageInput): Promise<{
  key: string;
  url: string;
  digest: string;
}> {
  const bytes = Buffer.from(buffer);
  if (bytes.length === 0) {
    throw new Error("R2 wardrobe image upload received an empty buffer");
  }

  const config = getR2Config(env);
  const digest = createHash("sha256").update(bytes).digest("hex");
  const key = buildWardrobeR2ImageKey({ email, digest });
  const s3 = client || createR2Client(config);

  await s3.send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Body: bytes,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return {
    key,
    url: buildR2PublicUrl(config, key),
    digest,
  };
}

async function uploadWardrobeDerivativeImageToR2({
  buffer,
  key,
  mimeType = "image/png",
  env = process.env,
  client,
}: UploadWardrobeDerivativeInput): Promise<{
  key: string;
  url: string;
  digest: string;
}> {
  const bytes = Buffer.from(buffer);
  if (bytes.length === 0) {
    throw new Error("R2 wardrobe derivative upload received an empty buffer");
  }

  const normalizedKey = String(key || "").trim();
  if (!normalizedKey) {
    throw new Error("R2 wardrobe derivative upload received an empty key");
  }

  const config = getR2Config(env);
  const digest = createHash("sha256").update(bytes).digest("hex");
  const s3 = client || createR2Client(config);

  await s3.send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: normalizedKey,
      Body: bytes,
      ContentType: String(mimeType || "image/png"),
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return {
    key: normalizedKey,
    url: buildR2PublicUrl(config, normalizedKey),
    digest,
  };
}

function isHttpImageUrl(value: unknown): boolean {
  const trimmed = String(value ?? "").trim();
  return /^https?:\/\//i.test(trimmed);
}

function decodeLegacyBase64Image(value: unknown): Buffer | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed || isHttpImageUrl(trimmed) || /^data:image\//i.test(trimmed)) {
    return null;
  }
  if (!/^[a-z0-9+/]+={0,2}$/i.test(trimmed) || trimmed.length % 4 === 1) {
    return null;
  }

  const buffer = Buffer.from(trimmed, "base64");
  return buffer.length > 0 ? buffer : null;
}

export {
  buildR2Endpoint,
  buildR2ImageKey,
  buildR2PublicUrl,
  buildWardrobeDerivativeR2ImageKey,
  buildWardrobeR2ImageKey,
  decodeLegacyBase64Image,
  getR2Config,
  uploadImageToR2,
  uploadWardrobeDerivativeImageToR2,
  uploadWardrobeImageToR2,
};
