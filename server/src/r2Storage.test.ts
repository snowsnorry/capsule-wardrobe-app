import { afterEach, test, expect, vi } from "vitest";
import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import {
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
} from "./r2Storage.js";
import { deleteObjectsFromR2 } from "./r2Delete.js";

const testEnv = {
  R2_ACCOUNT_ID: "account-1",
  R2_BUCKET_NAME: "capsule-images",
  R2_ACCESS_KEY_ID: "access-key",
  R2_SECRET_ACCESS_KEY: "secret-key",
  R2_PUBLIC_BASE_URL: "https://images.example.com/",
  R2_IMAGE_KEY_PREFIX: "capsule image assets",
} as NodeJS.ProcessEnv;

afterEach(() => {
  setR2ClientFactoryForTests(null);
});

test("getR2Config validates required env and normalizes public URL", () => {
  expect(getR2Config(testEnv)).toEqual({
    accountId: "account-1",
    bucketName: "capsule-images",
    accessKeyId: "access-key",
    secretAccessKey: "secret-key",
    publicBaseUrl: "https://images.example.com",
    imageKeyPrefix: "capsule image assets",
  });

  expect(() => getR2Config({ ...testEnv, R2_BUCKET_NAME: "" })).toThrow(
    /R2_BUCKET_NAME is not set/,
  );
});

test("R2 helpers build endpoint, object keys, and public URLs", () => {
  expect(buildR2Endpoint("account-1")).toBe(
    "https://account-1.r2.cloudflarestorage.com",
  );
  expect(
    buildR2ImageKey({
      imageKeyPrefix: "outfit set images",
      namespace: "generated",
      capsuleId: "Capsule 1",
      setIndex: 2,
      digest: "abc123",
      mimeType: "image/jpeg",
    }),
  ).toBe("outfit-set-images/generated/capsule-1/2/abc123.jpg");
  expect(
    buildR2PublicUrl(
      { publicBaseUrl: "https://images.example.com" },
      "folder/a b.png",
    ),
  ).toBe("https://images.example.com/folder/a%20b.png");
  expect(
    buildWardrobeR2ImageKey({
      email: "Person@Example.com",
      digest: "abc123",
    }),
  ).toMatch(/^wardrobe\/[a-f0-9]{16}\/[a-f0-9-]+-abc123\.webp$/);
  expect(
    buildWardrobeDerivativeR2ImageKey({
      sourceKey: "wardrobe/profile/item.webp",
      suffix: "_clean",
      mimeType: "image/png",
    }),
  ).toBe("wardrobe/profile/item_clean.png");
  expect(
    buildWardrobeDerivativeR2ImageKey({
      sourceKey: "wardrobe/profile/item_clean.png",
      suffix: "_320",
      mimeType: "image/webp",
    }),
  ).toBe("wardrobe/profile/item_clean_320.webp");
  expect(
    getR2KeyFromPublicUrl(
      "https://images.example.com/wardrobe/profile/a%20b.webp",
    ),
  ).toBe("wardrobe/profile/a b.webp");
});

test("uploadImageToR2 sends PutObjectCommand and returns public URL", async () => {
  const commands: PutObjectCommand[] = [];
  const client = {
    send: async (command: PutObjectCommand) => {
      commands.push(command);
      return {};
    },
  };

  const uploaded = await uploadImageToR2({
    buffer: Buffer.from("image"),
    mimeType: "image/png",
    capsuleId: "capsule-1",
    setIndex: 0,
    namespace: "generated",
    env: testEnv,
    client,
  });

  expect(commands.length).toBe(1);
  expect(commands[0].input.Bucket).toBe("capsule-images");
  expect(commands[0].input.ContentType).toBe("image/png");
  expect(commands[0].input.CacheControl).toBe(
    "public, max-age=31536000, immutable",
  );
  expect(String(commands[0].input.Key)).toMatch(
    /^capsule-image-assets\/generated\/capsule-1\/0\/[a-f0-9]{64}\.png$/,
  );
  expect(uploaded.url).toBe(
    `https://images.example.com/${commands[0].input.Key}`,
  );
});

test("copyImageObjectToR2 copies existing objects to a new public key", async () => {
  const commands: CopyObjectCommand[] = [];
  const client = {
    send: async (command: CopyObjectCommand) => {
      commands.push(command);
      return {};
    },
  };

  const uploaded = await copyImageObjectToR2({
    sourceUrl: "https://images.example.com/outfit-set/generated/a%20b.webp",
    capsuleId: "capsule-1",
    setIndex: 0,
    namespace: "copied",
    env: testEnv,
    client,
  });

  expect(commands.length).toBe(1);
  expect(commands[0].input.Bucket).toBe("capsule-images");
  expect(commands[0].input.CopySource).toBe(
    "capsule-images/outfit-set/generated/a%20b.webp",
  );
  expect(commands[0].input.ContentType).toBe("image/webp");
  expect(String(commands[0].input.Key)).toMatch(
    /^capsule-image-assets\/copied\/capsule-1\/0\/[a-f0-9]{64}\.webp$/,
  );
  expect(uploaded.url).toBe(
    `https://images.example.com/${commands[0].input.Key}`,
  );
});

test("uploadWardrobeImageToR2 writes top-level wardrobe WebP objects", async () => {
  const commands: PutObjectCommand[] = [];
  const client = {
    send: async (command: PutObjectCommand) => {
      commands.push(command);
      return {};
    },
  };

  const uploaded = await uploadWardrobeImageToR2({
    buffer: Buffer.from("webp"),
    email: "person@example.com",
    env: testEnv,
    client,
  });

  expect(commands.length).toBe(1);
  expect(commands[0].input.Bucket).toBe("capsule-images");
  expect(commands[0].input.ContentType).toBe("image/webp");
  expect(String(commands[0].input.Key)).toMatch(
    /^wardrobe\/[a-f0-9]{16}\/[a-f0-9-]+-[a-f0-9]{64}\.webp$/,
  );
  expect(uploaded.key).toBe(commands[0].input.Key);
  expect(uploaded.url).toBe(
    `https://images.example.com/${commands[0].input.Key}`,
  );
});

test("uploadWardrobeDerivativeImageToR2 writes caller-provided wardrobe keys", async () => {
  const commands: PutObjectCommand[] = [];
  const client = {
    send: async (command: PutObjectCommand) => {
      commands.push(command);
      return {};
    },
  };

  const uploaded = await uploadWardrobeDerivativeImageToR2({
    buffer: Buffer.from("clean"),
    key: "wardrobe/profile/image_clean_640.webp",
    mimeType: "image/webp",
    env: testEnv,
    client,
  });

  expect(commands.length).toBe(1);
  expect(commands[0].input.Key).toBe("wardrobe/profile/image_clean_640.webp");
  expect(commands[0].input.ContentType).toBe("image/webp");
  expect(uploaded.url).toBe(
    "https://images.example.com/wardrobe/profile/image_clean_640.webp",
  );
});

test("R2 uploads reuse the cached default client for matching config", async () => {
  const commands: PutObjectCommand[] = [];
  const factory = vi.fn(() => ({
    send: async (command: PutObjectCommand) => {
      commands.push(command);
      return {};
    },
  }));
  setR2ClientFactoryForTests(factory);

  await uploadImageToR2({
    buffer: Buffer.from("image"),
    env: testEnv,
  });
  await uploadWardrobeImageToR2({
    buffer: Buffer.from("wardrobe"),
    email: "person@example.com",
    env: testEnv,
  });
  await uploadWardrobeDerivativeImageToR2({
    buffer: Buffer.from("thumb"),
    key: "wardrobe/profile/image_320.webp",
    env: testEnv,
  });

  expect(factory).toHaveBeenCalledTimes(1);
  expect(commands).toHaveLength(3);
  expect(getDefaultR2ClientCacheSize()).toBe(1);
});

test("R2 default client cache separates stable non-secret config keys", async () => {
  const factory = vi.fn(() => ({
    send: async () => ({}),
  }));
  setR2ClientFactoryForTests(factory);

  await uploadWardrobeImageToR2({
    buffer: Buffer.from("one"),
    email: "person@example.com",
    env: testEnv,
  });
  await uploadWardrobeImageToR2({
    buffer: Buffer.from("two"),
    email: "person@example.com",
    env: {
      ...testEnv,
      R2_BUCKET_NAME: "other-bucket",
      R2_SECRET_ACCESS_KEY: "rotated-secret",
    },
  });

  expect(factory).toHaveBeenCalledTimes(2);
  expect(getDefaultR2ClientCacheSize()).toBe(2);
});

test("R2 explicit injected clients bypass the default client cache", async () => {
  const factory = vi.fn(() => ({
    send: async () => ({}),
  }));
  const injectedClient = {
    send: vi.fn(async () => ({})),
  };
  setR2ClientFactoryForTests(factory);

  await uploadImageToR2({
    buffer: Buffer.from("image"),
    env: testEnv,
    client: injectedClient,
  });
  await uploadWardrobeImageToR2({
    buffer: Buffer.from("wardrobe"),
    email: "person@example.com",
    env: testEnv,
    client: injectedClient,
  });

  expect(factory).not.toHaveBeenCalled();
  expect(injectedClient.send).toHaveBeenCalledTimes(2);
  expect(getDefaultR2ClientCacheSize()).toBe(0);
});

test("R2 default client cache cleanup destroys cached clients", async () => {
  const destroy = vi.fn();
  const factory = vi.fn(() => ({
    destroy,
    send: async () => ({}),
  }));
  setR2ClientFactoryForTests(factory);

  await uploadWardrobeImageToR2({
    buffer: Buffer.from("wardrobe"),
    email: "person@example.com",
    env: testEnv,
  });

  expect(getDefaultR2ClientCacheSize()).toBe(1);
  clearDefaultR2ClientCache();
  expect(destroy).toHaveBeenCalledTimes(1);
  expect(getDefaultR2ClientCacheSize()).toBe(0);
});

test("deleteObjectsFromR2 sends DeleteObjectsCommand with unique keys", async () => {
  const commands: DeleteObjectsCommand[] = [];
  const client = {
    send: async (command: DeleteObjectsCommand | PutObjectCommand) => {
      if (command instanceof DeleteObjectsCommand) {
        commands.push(command);
      }
      return {};
    },
  };

  const deleted = await deleteObjectsFromR2({
    keys: ["wardrobe/profile/image.webp", "wardrobe/profile/image.webp", ""],
    env: testEnv,
    client,
  });

  expect(deleted).toEqual({ deleted: 1 });
  expect(commands.length).toBe(1);
  expect(commands[0].input.Bucket).toBe("capsule-images");
  expect(commands[0].input.Delete?.Objects).toEqual([
    { Key: "wardrobe/profile/image.webp" },
  ]);
  expect(commands[0].input.Delete?.Quiet).toBe(true);
});
