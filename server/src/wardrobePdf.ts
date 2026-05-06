import { createWardrobePdfJobManager } from "./wardrobePdfJobs.js";

const wardrobePdfJobManager = createWardrobePdfJobManager();
const { startWardrobePdfJob, ensureWardrobePdfJob, getWardrobePdfJob, downloadWardrobePdf } = wardrobePdfJobManager;

export { DEFAULT_PDF_IMAGE_TARGET_SIZE, createWardrobePdfGenerationKey, resolveWardrobePdfChildEntryUrl, resolveWardrobePdfChildExecArgv } from "./wardrobePdfCore.js";
export { buildWardrobePdf } from "./wardrobePdfRender.js";
export { buildWardrobePdfInChild } from "./wardrobePdfChildRunner.js";
export { createWardrobePdfJobManager, getWardrobePdfJob };
export { startWardrobePdfJob, ensureWardrobePdfJob, downloadWardrobePdf };
