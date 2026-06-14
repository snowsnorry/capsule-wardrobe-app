import { afterEach, expect, test, vi } from "vitest";
import { getPromptDebugImages } from "./aiGenerationImages.js";
import type { ResolvedCapsuleGenerationDeps } from "./aiGenerationDeps.js";

afterEach(() => {
  vi.restoreAllMocks();
});

test("getPromptDebugImages enables debug output in development", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  let payload: Record<string, unknown> | null = null;
  const deps = {
    runWithImageWorkSlotImpl: async (_key, callback) => callback(),
    buildPromptDebugImagesInChildImpl: async (nextPayload) => {
      payload = nextPayload;
      return { categories: [], stitched: null };
    },
  } as unknown as ResolvedCapsuleGenerationDeps;

  try {
    await getPromptDebugImages([{ id: "item-1" }], null, deps);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
  }

  expect(payload?.saveDebugArtifacts).toBe(true);
  expect(String(payload?.debugOutputDir)).toContain("last-prompt");
});

test("getPromptDebugImages falls back when image building throws a non-error", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const deps = {
    runWithImageWorkSlotImpl: async (_key, callback) => callback(),
    buildPromptDebugImagesInChildImpl: async () => {
      throw "";
    },
  } as unknown as ResolvedCapsuleGenerationDeps;

  await expect(getPromptDebugImages([], null, deps)).resolves.toEqual({
    categories: [],
    stitched: null,
  });
  expect(console.warn).toHaveBeenCalledWith(
    "[prompt-images][build-failed]",
    JSON.stringify({ message: "unknown_error" }),
  );
});
