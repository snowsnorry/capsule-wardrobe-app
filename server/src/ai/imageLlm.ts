import {
  DEFAULT_PROFILE_IMAGE_LLM,
  PROFILE_IMAGE_LLM_VALUES
} from "../../../shared/profileSettings.js";
import type { UserProfileLike } from "./types.js";
import { logWarn } from "../logger.js";

type ImageLlmResolution =
  | {
    provider: "openai" | "gemini";
    model: string;
    imageLlm: string;
    requestedImageLlm: string;
    fallbackReason?: string;
  };

function getProfileImageLlm(userProfile: UserProfileLike | null = null) {
  const imageLlm = String(userProfile?.imageLlm || "").trim();
  return imageLlm || DEFAULT_PROFILE_IMAGE_LLM;
}

function resolveImageLlmProvider(userProfile: UserProfileLike | null = null): ImageLlmResolution {
  const imageLlm = getProfileImageLlm(userProfile);

  if ((PROFILE_IMAGE_LLM_VALUES as readonly string[]).includes(imageLlm)) {
    const separatorIndex = imageLlm.indexOf(":");
    const provider = imageLlm.slice(0, separatorIndex);
    const model = imageLlm.slice(separatorIndex + 1).trim();
    if ((provider === "openai" || provider === "gemini") && model) {
      return {
        provider,
        model,
        imageLlm,
        requestedImageLlm: imageLlm
      };
    }
  }

  logWarn("[wardrobe-ai][image-llm-unknown-model]", JSON.stringify({
    requestedImageLlm: imageLlm,
    fallbackProvider: "openai",
    fallbackModel: "gpt-image-2"
  }));

  return {
    provider: "openai",
    model: "gpt-image-2",
    imageLlm: DEFAULT_PROFILE_IMAGE_LLM,
    requestedImageLlm: imageLlm,
    fallbackReason: "unknown_model"
  };
}

export {
  getProfileImageLlm,
  resolveImageLlmProvider
};
export type { ImageLlmResolution };
