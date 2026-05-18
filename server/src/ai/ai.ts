import { createWardrobeService } from "./aiService.js";

const wardrobeService = createWardrobeService();
const {
  clearWardrobeJobsForEmail,
  getCapsuleItems,
  getWardrobeJob,
  regenerateCapsuleWardrobe,
  startWardrobeJob,
} = wardrobeService;

export {
  countItemsByKey,
  extractLlmUsage,
  logWardrobeInfo,
} from "./aiCommon.js";
export { enforceCategoryCounts } from "./aiCategoryEnforcement.js";
export { getSelectedIdsFromCapsule } from "./aiCategoryEnforcement.js";
export {
  getWardrobeSelectionPrompt,
  toWardrobeUiItem,
} from "./aiSelectionPrompt.js";
export { createWardrobeService };
export {
  clearWardrobeJobsForEmail,
  getCapsuleItems,
  getWardrobeJob,
  regenerateCapsuleWardrobe,
  startWardrobeJob,
};
export { getStoredWardrobePayload } from "./capsuleEvents.js";
