import { logWarn } from "../logger.js";
import { logWardrobeInfo } from "./aiCommon.js";
import type { LogContextLike, PromptDebugImageResult } from "./types.js";
import type { ResolvedCapsuleGenerationDeps } from "./aiGenerationDeps.js";

const LAST_PROMPT_DIR_URL = new URL("../../../last-prompt/", import.meta.url);

async function getPromptDebugImages(
  normalizedItems: Array<Record<string, unknown>>,
  logContext: LogContextLike | null,
  deps: ResolvedCapsuleGenerationDeps,
): Promise<PromptDebugImageResult> {
  const shouldSavePromptDebugArtifacts = process.env.NODE_ENV === "development";

  try {
    const imageFetchStartedAt = Date.now();
    const promptDebugImages = await deps.runWithImageWorkSlotImpl(
      "capsule-images",
      async () =>
        deps.buildPromptDebugImagesInChildImpl({
          normalizedItems,
          saveDebugArtifacts: shouldSavePromptDebugArtifacts,
          debugOutputDir: shouldSavePromptDebugArtifacts
            ? LAST_PROMPT_DIR_URL
            : null,
        }),
    );

    logWardrobeInfo(
      "capsule-images-ready",
      {
        imageFetchDurationMs: Date.now() - imageFetchStartedAt,
        requestedCount: normalizedItems.length,
        cachedCount: promptDebugImages.cachedCount || 0,
        downloadedCount: promptDebugImages.downloadedCount || 0,
        skippedCount: promptDebugImages.skippedCount || 0,
      },
      logContext,
    );

    return promptDebugImages;
  } catch (error) {
    logPromptImageBuildFailure(error, logContext);
    return { categories: [], stitched: null };
  }
}

function logPromptImageBuildFailure(
  error: unknown,
  logContext: LogContextLike | null,
) {
  const message =
    error instanceof Error ? error.message : String(error || "unknown_error");
  if (message.startsWith("prompt_images_child_exit:")) {
    logWardrobeInfo("capsule-images-child-exit", { message }, logContext);
  }
  logWarn("ai.prompt.images.build.failed", { message });
}

export { getPromptDebugImages };
