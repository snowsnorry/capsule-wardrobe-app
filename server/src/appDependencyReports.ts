import { clearWardrobeJobsForEmail } from "./ai/ai.js";
import { clearPartialRegenerationJobsForEmail } from "./ai/partialRegenerationJobs.js";
import { clearOutfitSetImageJobsForEmail } from "./ai/outfitSetImageJobs.js";
import { clearOutfitImageJobsForEmail } from "./ai/outfitImageJobs.js";
import { generateOutfitReport } from "./ai/outfitReportService.js";
import { generateCapsuleReport } from "./ai/capsuleReportService.js";
import { generatePersonalItemsReport } from "./ai/personalItemsReportService.js";
import { updateCapsuleReport } from "./capsuleStore.js";
import {
  clearJobRunsForEmail,
  getProductsByUrlsForEmailInOrder,
  listWardrobeItemsByEmail,
  listWardrobeItemsByUrlsForEmail,
  upsertPersonalItemsReportByEmail,
} from "./db.js";
import { updateOutfitReport } from "./outfitStore.js";
import { deleteWardrobePdfJob } from "./wardrobePdfJobRegistry.js";

async function clearAccountTransientState(email: string) {
  clearWardrobeJobsForEmail(email);
  clearPartialRegenerationJobsForEmail(email);
  clearOutfitSetImageJobsForEmail(email);
  clearOutfitImageJobsForEmail(email);
  deleteWardrobePdfJob(email);
  await clearJobRunsForEmail(email);
}

export function generateOutfitReportWithStoreLookups(
  email: string,
  outfitId: string,
) {
  return generateOutfitReport(email, outfitId, {
    getProductsByUrlsForEmailImpl: getProductsByUrlsForEmailInOrder,
    listWardrobeItemsByUrlsImpl: listWardrobeItemsByUrlsForEmail,
    updateOutfitReportImpl: updateOutfitReport,
  });
}

export function generateCapsuleReportWithStoreLookups(
  email: string,
  capsuleId: string,
) {
  return generateCapsuleReport(email, capsuleId, {
    updateCapsuleReportImpl: updateCapsuleReport,
  });
}

export function generatePersonalItemsReportWithStoreLookups(
  email: string,
  personalItemsContext?: string | null,
) {
  return generatePersonalItemsReport(email, personalItemsContext, {
    listWardrobeItemsImpl: listWardrobeItemsByEmail,
    upsertPersonalItemsReportImpl: upsertPersonalItemsReportByEmail,
  });
}

export function createAccountCleanupDependencies() {
  return {
    clearAccountTransientStateImpl: clearAccountTransientState,
  };
}
