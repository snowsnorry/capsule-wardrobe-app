import { mkdirSync, writeFileSync } from "node:fs";
import type {
  ImageAssetLike,
  PromptDebugImageCategory,
  UserProfileLike,
} from "./types.js";
import { buildRegenerateSelectedSystemPrompt } from "./regenerateSelectedPrompt.js";

export const LAST_PROMPT_DIR_URL = new URL(
  "../../../last-prompt/",
  import.meta.url,
);

export function buildLastPromptArtifact(
  prompt,
  userProfile = null,
  systemPrompt = "",
) {
  if (typeof prompt !== "string") {
    return "";
  }

  const resolvedSystemPrompt =
    typeof systemPrompt === "string" && systemPrompt.trim().length > 0
      ? systemPrompt
      : buildRegenerateSelectedSystemPrompt(userProfile);
  return [
    resolvedSystemPrompt ? `System:\n${resolvedSystemPrompt}` : "",
    `User:\n${prompt}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function saveLastPromptArtifacts({
  prompt,
  currentCapsuleCollage,
  currentOutfitCollage,
  personalItemsCollage,
  userProfile = null,
  systemPrompt = "",
}: {
  prompt?: string | null;
  currentCapsuleCollage?: PromptDebugImageCategory | null;
  currentOutfitCollage?: ImageAssetLike | null;
  personalItemsCollage?: ImageAssetLike | null;
  userProfile?: UserProfileLike | null;
  systemPrompt?: string | null;
} = {}) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  mkdirSync(LAST_PROMPT_DIR_URL, { recursive: true });

  if (typeof prompt === "string") {
    writeFileSync(
      new URL("last_prompt.txt", LAST_PROMPT_DIR_URL),
      buildLastPromptArtifact(prompt, userProfile, systemPrompt),
      "utf8",
    );
  }

  if (currentCapsuleCollage?.buffer) {
    writeFileSync(
      new URL("current-capsule.jpg", LAST_PROMPT_DIR_URL),
      currentCapsuleCollage.buffer,
    );
  }

  if (currentOutfitCollage?.buffer) {
    writeFileSync(
      new URL("current-outfit.jpg", LAST_PROMPT_DIR_URL),
      currentOutfitCollage.buffer,
    );
  }

  if (personalItemsCollage?.buffer) {
    writeFileSync(
      new URL("personal-items.jpg", LAST_PROMPT_DIR_URL),
      personalItemsCollage.buffer,
    );
  }
}
