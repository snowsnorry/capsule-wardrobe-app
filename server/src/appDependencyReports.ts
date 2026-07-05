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
  deleteWardrobePdfJob(email);
  await clearJobRunsForEmail(email);
}

export function generateOutfitReportWithStoreLookups(
  email: string,
  outfitId: string,
  options: { signal?: AbortSignal | null } = {},
) {
  return generateOutfitReport(
    email,
    outfitId,
    {
      getProductsByUrlsForEmailImpl: getProductsByUrlsForEmailInOrder,
      listWardrobeItemsByUrlsImpl: listWardrobeItemsByUrlsForEmail,
      updateOutfitReportImpl: updateOutfitReport,
    },
    options,
  );
}

export function generateCapsuleReportWithStoreLookups(
  email: string,
  capsuleId: string,
  options: { signal?: AbortSignal | null } = {},
) {
  return generateCapsuleReport(
    email,
    capsuleId,
    {
      updateCapsuleReportImpl: updateCapsuleReport,
    },
    options,
  );
}

export function generatePersonalItemsReportWithStoreLookups(
  email: string,
  personalItemsContext?: string | null,
  options: { signal?: AbortSignal | null } = {},
) {
  return generatePersonalItemsReport(
    email,
    personalItemsContext,
    {
      listWardrobeItemsImpl: listWardrobeItemsByEmail,
      upsertPersonalItemsReportImpl: upsertPersonalItemsReportByEmail,
    },
    options,
  );
}

export function createAccountCleanupDependencies() {
  return {
    clearAccountTransientStateImpl: clearAccountTransientState,
  };
}
