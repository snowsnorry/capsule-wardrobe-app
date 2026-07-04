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

async function waitForCondition(
  condition: () => boolean,
  message = "condition was not met",
) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(message);
}

async function readStreamBody(body: unknown) {
  let result = "";
  for await (const chunk of body as Readable) {
    result += String(chunk);
  }
  return result;
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

test("R2 staging streams originals and hydrates them back for queued processing", async () => {
  const sends: Array<{
    bodyText?: string;
    command: string;
    input: Record<string, unknown>;
  }> = [];
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
        const record: {
          bodyText?: string;
          command: string;
          input: Record<string, unknown>;
        } = {
          command: command.constructor.name,
          input: command.input,
        };
        sends.push(record);
        if (command instanceof GetObjectCommand) {
          return { Body: Readable.from(["hydrated-bytes"]) };
        }
        if (command instanceof PutObjectCommand) {
          record.bodyText = await readStreamBody(command.input.Body);
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
        ContentLength: 8,
        ContentType: "image/png",
        Key: "job-staging/job-1/0-look-1.png",
      },
    });
    expect(typeof (sends[0].input.Body as Readable).pipe).toBe("function");
    expect(sends[0].bodyText).toBe("r2-bytes");

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

test("R2 staging limits concurrent upload sends per process", async () => {
  let activeUploads = 0;
  let maxActiveUploads = 0;
  let startedUploads = 0;
  const releaseUploads: Array<() => void> = [];
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
        if (!(command instanceof PutObjectCommand)) {
          return {};
        }

        activeUploads += 1;
        startedUploads += 1;
        maxActiveUploads = Math.max(maxActiveUploads, activeUploads);
        try {
          await new Promise<void>((resolve) => releaseUploads.push(resolve));
        } finally {
          activeUploads -= 1;
          (command.input.Body as Readable | undefined)?.destroy();
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

  const { stageUploadFile } = await import("./stagedUploadStorage.js");
  const tempFiles = await Promise.all([
    createTempFile("one"),
    createTempFile("two"),
    createTempFile("three"),
  ]);

  try {
    const uploads = tempFiles.map((tempFile, index) =>
      stageUploadFile({
        filePath: tempFile.filePath,
        jobId: "job-1",
        index,
        mimeType: "image/png",
        originalName: `Look ${index}.PNG`,
      }),
    );

    await waitForCondition(
      () => releaseUploads.length === 2,
      "first two uploads did not start",
    );
    expect(activeUploads).toBe(2);
    expect(maxActiveUploads).toBe(2);

    releaseUploads.shift()?.();
    await waitForCondition(
      () => startedUploads === 3,
      "third upload did not start after one slot was released",
    );
    expect(maxActiveUploads).toBe(2);

    releaseUploads.splice(0).forEach((release) => release());
    await Promise.all(uploads);
    expect(maxActiveUploads).toBe(2);
  } finally {
    releaseUploads.splice(0).forEach((release) => release());
    await Promise.all(tempFiles.map((tempFile) => tempFile.cleanup()));
  }
});
