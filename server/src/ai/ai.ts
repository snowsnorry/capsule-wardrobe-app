import { createWardrobeService } from "./aiService.js";

const wardrobeService = createWardrobeService();
const {
  getCapsuleItems,
  getWardrobeJob,
  regenerateCapsuleWardrobe,
  startWardrobeJob
} = wardrobeService;

export { countItemsByKey, extractLlmUsage, getRequestedWardrobeParams, logWardrobeInfo } from "./aiCommon.js";
export { enforceCategoryCounts } from "./aiCategoryEnforcement.js";
export { getSelectedIdsFromCapsule } from "./aiCategoryEnforcement.js";
export { getWardrobeSelectionPrompt, toWardrobeUiItem } from "./aiSelectionPrompt.js";
export { createWardrobeService };
export {
  getCapsuleItems,
  getWardrobeJob,
  regenerateCapsuleWardrobe,
  startWardrobeJob
};
export { getStoredWardrobePayload } from "./capsuleEvents.js";
