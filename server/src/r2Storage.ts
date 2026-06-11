import { createHash, randomUUID } from "node:crypto";
import { CopyObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  buildR2Endpoint,
  clearDefaultR2ClientCache,
  getDefaultR2Client,
  getDefaultR2ClientCacheSize,
  getR2Config,
  setR2ClientFactoryForTests,
  type R2Config,
  type S3ClientLike,
} from "./r2ClientCache.js";

type UploadImageInput = {
  buffer: Buffer | Uint8Array;
  mimeType?: string | null;
  capsuleId?: string | null;
  setIndex?: number | string | null;
  namespace?: string | null;
  env?: NodeJS.ProcessEnv;
  client?: S3ClientLike;
};
type CopyImageInput = {
  sourceUrl?: string | null;
  sourceKey?: string | null;
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

function getMimeTypeFromKey(key: unknown): string {
  const normalized = String(key || "")
    .trim()
    .toLowerCase();
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (normalized.endsWith(".webp")) {
    return "image/webp";
  }
  return "image/png";
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
  const s3 = client || getDefaultR2Client(config);

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

async function copyImageObjectToR2({
  sourceUrl = null,
  sourceKey = null,
  capsuleId = null,
  setIndex = null,
  namespace = "copied",
  env = process.env,
  client,
}: CopyImageInput): Promise<{ key: string; url: string; digest: string }> {
  const normalizedSourceKey =
    String(sourceKey || "").trim() || getR2KeyFromPublicUrl(sourceUrl);
  if (!normalizedSourceKey) {
    throw new Error("R2 image copy received an empty source key");
  }

  const config = getR2Config(env);
  const digest = createHash("sha256")
    .update(`${normalizedSourceKey}:${randomUUID()}`)
    .digest("hex");
  const mimeType = getMimeTypeFromKey(normalizedSourceKey);
  const key = buildR2ImageKey({
    imageKeyPrefix: config.imageKeyPrefix,
    namespace,
    capsuleId: capsuleId || randomUUID(),
    setIndex,
    digest,
    mimeType,
  });
  const s3 = client || getDefaultR2Client(config);

  await s3.send(
    new CopyObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      CopySource: `${config.bucketName}/${encodeURIComponent(normalizedSourceKey).replace(/%2F/g, "/")}`,
      CacheControl: "public, max-age=31536000, immutable",
      MetadataDirective: "REPLACE",
      ContentType: mimeType,
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
  const s3 = client || getDefaultR2Client(config);

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
  const s3 = client || getDefaultR2Client(config);

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

export {
  buildR2Endpoint,
  buildR2ImageKey,
  buildR2PublicUrl,
  buildWardrobeDerivativeR2ImageKey,
  buildWardrobeR2ImageKey,
  clearDefaultR2ClientCache,
  copyImageObjectToR2,
  getDefaultR2ClientCacheSize,
  getR2KeyFromPublicUrl,
  getR2Config,
  setR2ClientFactoryForTests,
  uploadImageToR2,
  uploadWardrobeDerivativeImageToR2,
  uploadWardrobeImageToR2,
};
