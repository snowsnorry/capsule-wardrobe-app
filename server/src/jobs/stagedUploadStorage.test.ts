import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

async function createTempFile(contents = "image-bytes") {
  const directory = await mkdtemp(path.join(os.tmpdir(), "job-stage-test-"));
  const filePath = path.join(directory, "Source Image.PNG");
  await writeFile(filePath, contents);
  return {
    cleanup: () => rm(directory, { recursive: true, force: true }),
    filePath,
  };
}

test("stageUploadFile stores local originals with sanitized durable job-scoped names", async () => {
  const {
    cleanupStagedUploadFiles,
    stageUploadFile,
    hydrateStagedUploadFiles,
    openLocalStagedUploadStream,
  } = await import("./stagedUploadStorage.js");
  const tempFile = await createTempFile();

  try {
    const staged = await stageUploadFile({
      filePath: tempFile.filePath,
      jobId: "Job With Spaces",
      index: 2,
      mimeType: "image/png",
      originalName: "Summer Dress.PNG",
    });

    expect(staged).toMatchObject({
      storage: "local",
      mimeType: "image/png",
      originalName: "Summer Dress.PNG",
    });
    expect(staged.key).toContain("Job With Spaces");
    expect(staged.key).toContain("2-summer-dress.png");
    await expect(readFile(staged.key, "utf-8")).resolves.toBe("image-bytes");

    const hydrated = await hydrateStagedUploadFiles([staged]);
    expect(hydrated.files).toEqual([
      {
        filePath: staged.key,
        mimeType: "image/png",
        originalName: "Summer Dress.PNG",
      },
    ]);
    await expect(
      new Promise<string>((resolve, reject) => {
        let body = "";
        openLocalStagedUploadStream(staged)
          .setEncoding("utf-8")
          .on("data", (chunk) => {
            body += String(chunk);
          })
          .on("error", reject)
          .on("end", () => resolve(body));
      }),
    ).resolves.toBe("image-bytes");
    await hydrated.cleanup();
    await cleanupStagedUploadFiles([staged]);
    await expect(access(staged.key)).rejects.toThrow();
  } finally {
    await tempFile.cleanup();
  }
});

test("stageUploadFile fails closed in production when durable R2 staging is unavailable", async () => {
  vi.doMock("../appConfig.js", () => ({ NODE_ENV: "production" }));
  const { stageUploadFile } = await import("./stagedUploadStorage.js");
  const tempFile = await createTempFile();

  try {
    await expect(
      stageUploadFile({
        filePath: tempFile.filePath,
        jobId: "job-1",
        index: 0,
        mimeType: "image/png",
        originalName: "shirt.png",
      }),
    ).rejects.toMatchObject({ code: "storage_unavailable" });
  } finally {
    await tempFile.cleanup();
  }
});

test("R2 staging uploads originals and hydrates them back for queued processing", async () => {
  const sends: Array<{ command: string; input: Record<string, unknown> }> = [];
  vi.doMock("../appConfig.js", () => ({ NODE_ENV: "production" }));
  vi.doMock("../r2Storage.js", () => ({
    buildR2Endpoint: (accountId: string) =>
      `https://${accountId}.r2.cloudflarestorage.com`,
    getR2Config: () => ({
      accountId: "account",
      accessKeyId: "access",
      bucketName: "bucket",
      publicBaseUrl: "https://cdn.example.test",
      secretAccessKey: "secret",
    }),
  }));
  vi.doMock("@aws-sdk/client-s3", () => {
    class DeleteObjectCommand {
      input: Record<string, unknown>;

      constructor(input: Record<string, unknown>) {
        this.input = input;
      }
    }
    class PutObjectCommand {
      input: Record<string, unknown>;

      constructor(input: Record<string, unknown>) {
        this.input = input;
      }
    }
    class GetObjectCommand {
      input: Record<string, unknown>;

      constructor(input: Record<string, unknown>) {
        this.input = input;
      }
    }
    class S3Client {
      async send(
        command: PutObjectCommand | GetObjectCommand | DeleteObjectCommand,
      ) {
        sends.push({
          command: command.constructor.name,
          input: command.input,
        });
        if (command instanceof GetObjectCommand) {
          return { Body: Readable.from(["hydrated-bytes"]) };
        }
        return {};
      }
    }
    return {
      DeleteObjectCommand,
      GetObjectCommand,
      PutObjectCommand,
      S3Client,
    };
  });
  vi.stubEnv("R2_ACCOUNT_ID", "account");
  vi.stubEnv("R2_BUCKET_NAME", "bucket");
  vi.stubEnv("R2_ACCESS_KEY_ID", "access");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret");
  vi.stubEnv("R2_PUBLIC_BASE_URL", "https://cdn.example.test");

  const {
    cleanupStagedUploadFiles,
    hydrateStagedUploadFiles,
    stageUploadFile,
  } = await import("./stagedUploadStorage.js");
  const tempFile = await createTempFile("r2-bytes");

  try {
    const staged = await stageUploadFile({
      filePath: tempFile.filePath,
      jobId: "job-1",
      index: 0,
      mimeType: "image/png",
      originalName: "Look 1.PNG",
    });
    expect(staged).toEqual({
      storage: "r2",
      key: "job-staging/job-1/0-look-1.png",
      mimeType: "image/png",
      originalName: "Look 1.PNG",
    });
    expect(sends[0]).toMatchObject({
      command: "PutObjectCommand",
      input: {
        Bucket: "bucket",
        ContentType: "image/png",
        Key: "job-staging/job-1/0-look-1.png",
      },
    });

    const hydrated = await hydrateStagedUploadFiles([staged]);
    await expect(readFile(hydrated.files[0].filePath, "utf-8")).resolves.toBe(
      "hydrated-bytes",
    );
    expect(hydrated.files[0]).toMatchObject({
      mimeType: "image/png",
      originalName: "Look 1.PNG",
    });
    expect(sends[1]).toMatchObject({
      command: "GetObjectCommand",
      input: {
        Bucket: "bucket",
        Key: "job-staging/job-1/0-look-1.png",
      },
    });
    await hydrated.cleanup();
    await cleanupStagedUploadFiles([staged]);
    expect(sends[2]).toMatchObject({
      command: "DeleteObjectCommand",
      input: {
        Bucket: "bucket",
        Key: "job-staging/job-1/0-look-1.png",
      },
    });
  } finally {
    await tempFile.cleanup();
  }
});
