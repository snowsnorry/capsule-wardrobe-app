import { DeleteObjectsCommand, S3Client } from "@aws-sdk/client-s3";
import { buildR2Endpoint, getR2Config } from "./r2Storage.js";

type S3DeleteClientLike = {
  send: (command: unknown) => Promise<unknown>;
};

type DeleteR2ObjectsInput = {
  keys: string[];
  env?: NodeJS.ProcessEnv;
  client?: S3DeleteClientLike;
};

function createR2DeleteClient(
  config: ReturnType<typeof getR2Config>,
): S3DeleteClientLike {
  return new S3Client({
    region: "auto",
    endpoint: buildR2Endpoint(config.accountId),
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

async function deleteObjectsFromR2({
  keys,
  env = process.env,
  client,
}: DeleteR2ObjectsInput): Promise<{ deleted: number }> {
  const normalizedKeys = Array.from(
    new Set(keys.map((key) => String(key || "").trim()).filter(Boolean)),
  );
  if (normalizedKeys.length === 0) {
    return { deleted: 0 };
  }

  const config = getR2Config(env);
  const s3 = client || createR2DeleteClient(config);
  await s3.send(
    new DeleteObjectsCommand({
      Bucket: config.bucketName,
      Delete: {
        Objects: normalizedKeys.map((key) => ({ Key: key })),
        Quiet: true,
      },
    }),
  );

  return { deleted: normalizedKeys.length };
}

export { deleteObjectsFromR2 };
