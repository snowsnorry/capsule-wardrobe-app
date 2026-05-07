import { createPartialRegenerationService } from "./regenerateSelectedService.js";

const partialRegenerationService = createPartialRegenerationService();
const {
  getPartialRegenerationJob,
  startPartialRegenerationJob,
  regenerateSelectedWardrobeItems,
} = partialRegenerationService;

export {
  buildRegenerateSelectedSystemPrompt,
  buildRegenerateSelectedPrompt,
} from "./regenerateSelectedPrompt.js";
export { regenerateCapsuleWardrobe } from "./regenerateSelectedGeneration.js";
export { createPartialRegenerationService };
export {
  getPartialRegenerationJob,
  regenerateSelectedWardrobeItems,
  startPartialRegenerationJob,
};
