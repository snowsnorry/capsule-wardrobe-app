import type {
  getCapsule,
  updateCapsuleSavedSnapshot,
  updateCapsuleSnapshot,
} from "../capsuleStore.js";
import type { getProfile } from "../profileStore.js";
import type { uploadImageToR2 } from "../r2Storage.js";
import type { generateImageWithGemini } from "./geminiImage.js";
import type { generateImageWithOpenAi } from "./openaiImage.js";
import type { buildOutfitSetDescription } from "./outfitSetImageDescription.js";
import type { downloadProductImageAssets } from "./promptImages.js";

type OutfitSetImageServiceOptions = {
  getCapsuleImpl?: typeof getCapsule;
  getProfileImpl?: typeof getProfile;
  updateCapsuleSavedSnapshotImpl?: typeof updateCapsuleSavedSnapshot;
  updateCapsuleSnapshotImpl?: typeof updateCapsuleSnapshot;
  publishSnapshotImpl?: (
    email: string,
    capsuleId: string,
    snapshot: unknown,
  ) => void | boolean;
  buildCapsuleEventSnapshotImpl?: (
    payload?: Record<string, unknown>,
  ) => unknown;
  downloadProductImageAssetsImpl?: typeof downloadProductImageAssets;
  generateImageWithOpenAiImpl?: typeof generateImageWithOpenAi;
  generateImageWithGeminiImpl?: typeof generateImageWithGemini;
  uploadImageToR2Impl?: typeof uploadImageToR2;
  buildOutfitSetDescriptionImpl?: typeof buildOutfitSetDescription;
};

export type { OutfitSetImageServiceOptions };
