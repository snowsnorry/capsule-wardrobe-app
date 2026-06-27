import { createReadStream, createWriteStream } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { buildR2Endpoint, getR2Config } from "../r2Storage.js";
import { NODE_ENV } from "../appConfig.js";

export type StagedUploadFile = {
  storage: "local" | "r2";
  key: string;
  mimeType: string;
  originalName: string;
};

function sanitizeSegment(value: unknown, fallback: string): string {
  const sanitized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return sanitized || fallback;
}

function createR2Client(config: ReturnType<typeof getR2Config>) {
  return new S3Client({
    region: "auto",
    endpoint: buildR2Endpoint(config.accountId),
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

function canUseR2(env: NodeJS.ProcessEnv) {
  return Boolean(
    env.R2_ACCOUNT_ID &&
    env.R2_BUCKET_NAME &&
    env.R2_ACCESS_KEY_ID &&
    env.R2_SECRET_ACCESS_KEY &&
    env.R2_PUBLIC_BASE_URL,
  );
}

async function stageFileToR2({
  filePath,
  jobId,
  index,
  mimeType,
  originalName,
}: {
  filePath: string;
  jobId: string;
  index: number;
  mimeType: string;
  originalName: string;
}): Promise<StagedUploadFile> {
  const config = getR2Config();
  const client = createR2Client(config);
  const key = `job-staging/${sanitizeSegment(jobId, "job")}/${index}-${sanitizeSegment(originalName, "image")}`;
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Body: await readFile(filePath),
      ContentType: mimeType,
    }),
  );
  return { storage: "r2", key, mimeType, originalName };
}

async function stageFileLocally({
  filePath,
  jobId,
  index,
  mimeType,
  originalName,
}: {
  filePath: string;
  jobId: string;
  index: number;
  mimeType: string;
  originalName: string;
}): Promise<StagedUploadFile> {
  const directory = path.join(os.tmpdir(), "capsule-job-staging", jobId);
  await mkdir(directory, { recursive: true });
  const destination = path.join(
    directory,
    `${index}-${sanitizeSegment(originalName, "image")}`,
  );
  await copyFile(filePath, destination);
  return { storage: "local", key: destination, mimeType, originalName };
}

export async function stageUploadFile(input: {
  filePath: string;
  jobId: string;
  index: number;
  mimeType: string;
  originalName: string;
}): Promise<StagedUploadFile> {
  if (canUseR2(process.env)) {
    return stageFileToR2(input);
  }

  if (NODE_ENV === "production") {
    const error = new Error("storage_unavailable");
    (error as Error & { code?: string }).code = "storage_unavailable";
    throw error;
  }

  return stageFileLocally(input);
}

async function hydrateR2StagedFile(file: StagedUploadFile, directory: string) {
  const config = getR2Config();
  const client = createR2Client(config);
  await mkdir(directory, { recursive: true });
  const target = path.join(
    directory,
    sanitizeSegment(file.originalName, "image"),
  );
  const result = await client.send(
    new GetObjectCommand({
      Bucket: config.bucketName,
      Key: file.key,
    }),
  );
  const body = result.Body;
  if (!body || typeof (body as { pipe?: unknown }).pipe !== "function") {
    throw new Error("staged_upload_body_unavailable");
  }
  await pipeline(body as NodeJS.ReadableStream, createWriteStream(target));
  return target;
}

export async function hydrateStagedUploadFiles(
  stagedFiles: StagedUploadFile[],
): Promise<{
  cleanup: () => Promise<void>;
  files: Array<{ filePath: string; mimeType: string; originalName: string }>;
}> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "wardrobe-job-"));
  const files = [];

  for (const [index, file] of stagedFiles.entries()) {
    if (file.storage === "local") {
      files.push({
        filePath: file.key,
        mimeType: file.mimeType,
        originalName: file.originalName,
      });
      continue;
    }

    files.push({
      filePath: await hydrateR2StagedFile(
        file,
        path.join(directory, `${index}`),
      ),
      mimeType: file.mimeType,
      originalName: file.originalName,
    });
  }

  return {
    cleanup: () => rm(directory, { recursive: true, force: true }),
    files,
  };
}

async function deleteR2StagedUploadFile(file: StagedUploadFile) {
  const config = getR2Config();
  const client = createR2Client(config);
  await client.send(
    new DeleteObjectCommand({
      Bucket: config.bucketName,
      Key: file.key,
    }),
  );
}

async function deleteLocalStagedUploadFile(file: StagedUploadFile) {
  await rm(file.key, { force: true });
  await rm(path.dirname(file.key), { recursive: false }).catch(() => {});
}

export async function cleanupStagedUploadFiles(
  stagedFiles: StagedUploadFile[] = [],
): Promise<void> {
  await Promise.all(
    stagedFiles.map((file) =>
      file.storage === "r2"
        ? deleteR2StagedUploadFile(file)
        : deleteLocalStagedUploadFile(file),
    ),
  );
}

export function openLocalStagedUploadStream(file: StagedUploadFile) {
  return createReadStream(file.key);
}
