import { logError } from "../logger.js";
import { filterWardrobeItemForDisplay } from "../wardrobeItemDisplay.js";
import type { JobHandlerContext, JobRunRecord } from "./types.js";

type HandlerDeps = Record<string, unknown>;

function getErrorCode(error: unknown): string {
  const code = String((error as { code?: unknown } | null)?.code || "").trim();
  if (code) {
    return code;
  }
  const message = String((error as Error | null)?.message || "").trim();
  return message || "service_unavailable";
}

function getPayloadString(job: JobRunRecord, key: string): string {
  return String(job.payload?.[key] || "").trim();
}

async function runCapsuleGeneration(
  deps: HandlerDeps,
  job: JobRunRecord,
  context: JobHandlerContext,
) {
  const capsuleId = job.entityId || getPayloadString(job, "capsuleId");
  const handler = deps.runCapsuleGenerationJobImpl as
    | ((input: {
        deps: HandlerDeps;
        email: string;
        capsuleId: string;
        signal?: AbortSignal;
        updateProgress: JobHandlerContext["updateProgress"];
      }) => Promise<Record<string, unknown>>)
    | undefined;
  if (!handler) {
    throw new Error("capsule_generation_handler_missing");
  }
  return handler({
    deps,
    email: job.profileEmail,
    capsuleId,
    signal: context.signal,
    updateProgress: context.updateProgress,
  });
}

async function runSelectedRegeneration(
  deps: HandlerDeps,
  job: JobRunRecord,
  context: JobHandlerContext,
) {
  const capsuleId = job.entityId || getPayloadString(job, "capsuleId");
  const handler = deps.runSelectedRegenerationJobImpl as
    | ((input: {
        deps: HandlerDeps;
        email: string;
        capsuleId: string;
        itemUrls: unknown;
        signal?: AbortSignal;
        updateProgress: JobHandlerContext["updateProgress"];
      }) => Promise<Record<string, unknown>>)
    | undefined;
  if (!handler) {
    throw new Error("capsule_selected_regeneration_handler_missing");
  }
  return handler({
    deps,
    email: job.profileEmail,
    capsuleId,
    itemUrls: job.payload.itemUrls,
    signal: context.signal,
    updateProgress: context.updateProgress,
  });
}

async function runCapsuleReport(
  deps: HandlerDeps,
  job: JobRunRecord,
  signal?: AbortSignal,
) {
  const capsuleId = job.entityId || getPayloadString(job, "capsuleId");
  const report = await (
    deps.generateCapsuleReportImpl as (
      email: string,
      capsuleId: string,
      options?: { signal?: AbortSignal | null },
    ) => Promise<unknown>
  )(job.profileEmail, capsuleId, { signal });
  return { report };
}

async function runOutfitReport(
  deps: HandlerDeps,
  job: JobRunRecord,
  signal?: AbortSignal,
) {
  const outfitId = job.entityId || getPayloadString(job, "outfitId");
  const report = await (
    deps.generateOutfitReportImpl as (
      email: string,
      outfitId: string,
      options?: { signal?: AbortSignal | null },
    ) => Promise<unknown>
  )(job.profileEmail, outfitId, { signal });
  return { report };
}

async function runPersonalItemsReport(
  deps: HandlerDeps,
  job: JobRunRecord,
  signal?: AbortSignal,
) {
  const context =
    typeof job.payload.context === "string" ? job.payload.context : null;
  const result = await (
    deps.generatePersonalItemsReportImpl as (
      email: string,
      personalItemsContext?: string | null,
      options?: { signal?: AbortSignal | null },
    ) => Promise<Record<string, unknown>>
  )(job.profileEmail, context, { signal });
  return result || {};
}

async function runOutfitImage(
  deps: HandlerDeps,
  job: JobRunRecord,
  signal?: AbortSignal,
) {
  const outfitId = job.entityId || getPayloadString(job, "outfitId");
  const result = await (
    deps.runOutfitImageGenerationJobImpl as
      | ((input: {
          deps: HandlerDeps;
          email: string;
          outfitId: string;
          signal?: AbortSignal;
        }) => Promise<Record<string, unknown>>)
      | undefined
  )?.({
    deps,
    email: job.profileEmail,
    outfitId,
    signal,
  });
  if (!result) {
    throw new Error("outfit_image_handler_missing");
  }
  return result;
}

async function runOutfitSetImage(
  deps: HandlerDeps,
  job: JobRunRecord,
  signal?: AbortSignal,
) {
  const capsuleId = job.entityId || getPayloadString(job, "capsuleId");
  const setIndex = Number.parseInt(String(job.payload.setIndex ?? ""), 10);
  const result = await (
    deps.runOutfitSetImageGenerationJobImpl as
      | ((input: {
          deps: HandlerDeps;
          email: string;
          capsuleId: string;
          setIndex: number;
          signal?: AbortSignal;
        }) => Promise<Record<string, unknown>>)
      | undefined
  )?.({
    deps,
    email: job.profileEmail,
    capsuleId,
    setIndex,
    signal,
  });
  if (!result) {
    throw new Error("outfit_set_image_handler_missing");
  }
  return result;
}

async function runUploadUrls(
  deps: HandlerDeps,
  job: JobRunRecord,
  signal?: AbortSignal,
) {
  const urls = Array.isArray(job.payload.urls)
    ? job.payload.urls.map((url) => String(url || "").trim()).filter(Boolean)
    : [];
  const handler = deps.processQueuedWardrobeUrlUploadImpl as
    | ((input: {
        email: string;
        signal?: AbortSignal;
        urls: string[];
      }) => Promise<Record<string, unknown>>)
    | undefined;
  if (!handler) {
    throw new Error("wardrobe_url_upload_handler_missing");
  }
  return handler({
    email: job.profileEmail,
    signal,
    urls,
  });
}

async function runUploadFiles(
  deps: HandlerDeps,
  job: JobRunRecord,
  signal?: AbortSignal,
) {
  const stagedFiles = Array.isArray(job.payload.stagedFiles)
    ? job.payload.stagedFiles
    : [];
  const handler = deps.processQueuedWardrobeFileUploadImpl as
    | ((input: {
        email: string;
        stagedFiles: unknown[];
        signal?: AbortSignal;
        filterItem: typeof filterWardrobeItemForDisplay;
      }) => Promise<Record<string, unknown>>)
    | undefined;
  if (!handler) {
    throw new Error("wardrobe_file_upload_handler_missing");
  }
  return handler({
    email: job.profileEmail,
    stagedFiles,
    signal,
    filterItem: filterWardrobeItemForDisplay,
  });
}

export async function runJobHandler(
  deps: HandlerDeps,
  context: JobHandlerContext,
): Promise<Record<string, unknown> | null> {
  const { job } = context;
  await context.updateProgress({
    phase: "running",
    current: 0,
    label: "Running",
  });

  try {
    switch (job.kind) {
      case "capsuleGenerate":
        return await runCapsuleGeneration(deps, job, context);
      case "capsuleRegenerateSelected":
        return await runSelectedRegeneration(deps, job, context);
      case "capsuleReportGenerate":
        return await runCapsuleReport(deps, job, context.signal);
      case "outfitImageGenerate":
        return await runOutfitImage(deps, job, context.signal);
      case "outfitReportGenerate":
        return await runOutfitReport(deps, job, context.signal);
      case "outfitSetImageGenerate":
        return await runOutfitSetImage(deps, job, context.signal);
      case "personalItemsReportGenerate":
        return await runPersonalItemsReport(deps, job, context.signal);
      case "personalItemUploadUrls":
        return await runUploadUrls(deps, job, context.signal);
      case "personalItemUploadFiles":
        return await runUploadFiles(deps, job, context.signal);
      default:
        throw new Error("unsupported_job_kind");
    }
  } catch (error) {
    if (!(error as { suppressJobHandlerLog?: unknown }).suppressJobHandlerLog) {
      logError("[jobs][handler]", { jobId: job.id, kind: job.kind }, error);
    }
    (error as Error & { code?: string }).code = getErrorCode(error);
    throw error;
  }
}
