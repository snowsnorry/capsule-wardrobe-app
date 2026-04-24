import test from "node:test";
import assert from "node:assert/strict";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import {
  buildR2Endpoint,
  buildR2ImageKey,
  buildR2PublicUrl,
  decodeLegacyBase64Image,
  getR2Config,
  uploadImageToR2
} from "./r2Storage.js";

const testEnv = {
  R2_ACCOUNT_ID: "account-1",
  R2_BUCKET_NAME: "capsule-images",
  R2_ACCESS_KEY_ID: "access-key",
  R2_SECRET_ACCESS_KEY: "secret-key",
  R2_PUBLIC_BASE_URL: "https://images.example.com/",
  R2_IMAGE_KEY_PREFIX: "capsule image assets"
} as NodeJS.ProcessEnv;

test("getR2Config validates required env and normalizes public URL", () => {
  assert.deepEqual(getR2Config(testEnv), {
    accountId: "account-1",
    bucketName: "capsule-images",
    accessKeyId: "access-key",
    secretAccessKey: "secret-key",
    publicBaseUrl: "https://images.example.com",
    imageKeyPrefix: "capsule image assets"
  });

  assert.throws(() => getR2Config({ ...testEnv, R2_BUCKET_NAME: "" }), /R2_BUCKET_NAME is not set/);
});

test("R2 helpers build endpoint, object keys, and public URLs", () => {
  assert.equal(buildR2Endpoint("account-1"), "https://account-1.r2.cloudflarestorage.com");
  assert.equal(
    buildR2ImageKey({
      imageKeyPrefix: "outfit set images",
      namespace: "generated",
      capsuleId: "Capsule 1",
      setIndex: 2,
      digest: "abc123",
      mimeType: "image/jpeg"
    }),
    "outfit-set-images/generated/capsule-1/2/abc123.jpg"
  );
  assert.equal(
    buildR2PublicUrl({ publicBaseUrl: "https://images.example.com" }, "folder/a b.png"),
    "https://images.example.com/folder/a%20b.png"
  );
});

test("uploadImageToR2 sends PutObjectCommand and returns public URL", async () => {
  const commands: PutObjectCommand[] = [];
  const client = {
    send: async (command: PutObjectCommand) => {
      commands.push(command);
      return {};
    }
  };

  const uploaded = await uploadImageToR2({
    buffer: Buffer.from("image"),
    mimeType: "image/png",
    capsuleId: "capsule-1",
    setIndex: 0,
    namespace: "generated",
    env: testEnv,
    client
  });

  assert.equal(commands.length, 1);
  assert.equal(commands[0].input.Bucket, "capsule-images");
  assert.equal(commands[0].input.ContentType, "image/png");
  assert.equal(commands[0].input.CacheControl, "public, max-age=31536000, immutable");
  assert.match(String(commands[0].input.Key), /^capsule-image-assets\/generated\/capsule-1\/0\/[a-f0-9]{64}\.png$/);
  assert.equal(uploaded.url, `https://images.example.com/${commands[0].input.Key}`);
});

test("decodeLegacyBase64Image skips URLs, data URLs, and invalid values", () => {
  assert.equal(decodeLegacyBase64Image("https://images.example.com/set.png"), null);
  assert.equal(decodeLegacyBase64Image("data:image/png;base64,abc"), null);
  assert.equal(decodeLegacyBase64Image("not base64!"), null);
  assert.equal(decodeLegacyBase64Image(Buffer.from("image").toString("base64"))?.toString("utf8"), "image");
});
