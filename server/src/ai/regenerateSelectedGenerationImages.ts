import { logWarn } from "../logger.js";
import { logWardrobeInfo } from "./ai.js";
import { LAST_PROMPT_DIR_URL } from "./regenerateSelectedArtifacts.js";

export async function buildRegenerationPromptImages({
  normalizedItems,
  currentCapsuleItems,
  logContext,
  deps,
}) {
  const shouldSavePromptDebugArtifacts = process.env.NODE_ENV === "development";
  const promptDebugImages = await buildRegenerationCandidateImages(
    normalizedItems,
    shouldSavePromptDebugArtifacts,
    logContext,
    deps,
  );
  const currentCapsuleCollage = await buildCurrentCapsuleCollage(
    currentCapsuleItems,
    logContext,
    deps,
  );
  return { currentCapsuleCollage, promptDebugImages };
}

async function buildRegenerationCandidateImages(
  normalizedItems,
  shouldSavePromptDebugArtifacts,
  logContext,
  deps,
) {
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

function logPromptImageBuildFailure(error, logContext) {
  if (String(error?.message || "").startsWith("prompt_images_child_exit:")) {
    logWardrobeInfo(
      "capsule-images-child-exit",
      { message: error.message },
      logContext,
    );
  }
  logWarn("[prompt-images][build-failed]", {
    message: error?.message || "unknown_error",
  });
}

async function buildCurrentCapsuleCollage(
  currentCapsuleItems,
  logContext,
  deps,
) {
  if (currentCapsuleItems.length === 0) {
    return null;
  }

  try {
    const currentCapsuleImageStartedAt = Date.now();
    const currentCapsuleImage = await deps.runWithImageWorkSlotImpl(
      "capsule-images",
      async () =>
        deps.buildPromptDebugImagesForCategoryImpl({
          category: "Current Capsule",
          items: currentCapsuleItems,
        }),
    );
    const currentCapsuleCollage = currentCapsuleImage?.category || null;
    logWardrobeInfo(
      "current-capsule-collage-ready",
      buildCurrentCapsuleCollageLogPayload(
        currentCapsuleCollage,
        currentCapsuleItems,
        currentCapsuleImageStartedAt,
      ),
      logContext,
    );
    return currentCapsuleCollage;
  } catch (error) {
    logWarn("[prompt-images][current-capsule-build-failed]", {
      message: error?.message || "unknown_error",
    });
    return null;
  }
}

function buildCurrentCapsuleCollageLogPayload(
  currentCapsuleCollage,
  currentCapsuleItems,
  currentCapsuleImageStartedAt,
) {
  return {
    imageFetchDurationMs: Date.now() - currentCapsuleImageStartedAt,
    currentCapsuleItemsTotal: currentCapsuleItems.length,
    cachedCount: currentCapsuleCollage?.cachedCount || 0,
    downloadedCount: currentCapsuleCollage?.downloadedCount || 0,
    skippedCount: currentCapsuleCollage?.skippedCount || 0,
  };
}
