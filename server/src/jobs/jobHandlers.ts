import { logError } from "../logger.js";
import { filterWardrobeItemForDisplay } from "../wardrobeItemDisplay.js";
import type { JobHandlerContext, JobRunRecord } from "./types.js";

type HandlerDeps = Record<string, unknown>;

type FakeResponse = {
  body: unknown;
  statusCode: number;
  json: (body: unknown) => FakeResponse;
  status: (statusCode: number) => FakeResponse;
};

function createFakeResponse(): FakeResponse {
  return {
    body: null,
    statusCode: 200,
    json(body: unknown) {
      this.body = body;
      return this;
    },
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
  };
}

function getErrorCode(error: unknown): string {
  const code = String((error as { code?: unknown } | null)?.code || "").trim();
  if (code) {
    return code;
  }
  const message = String((error as Error | null)?.message || "").trim();
  return message || "service_unavailable";
}

function assertFakeResponseOk(res: FakeResponse) {
  if (res.statusCode >= 400) {
    const body = res.body as {
      error?: unknown;
      suppressJobHandlerLog?: unknown;
    } | null;
    const error = new Error(String(body?.error || "job_failed"));
    const handlerError = error as Error & {
      code?: string;
      suppressJobHandlerLog?: boolean;
    };
    handlerError.code = String(body?.error || "job_failed");
    if (body?.suppressJobHandlerLog === true) {
      handlerError.suppressJobHandlerLog = true;
    }
    throw error;
  }
}

async function waitForLegacyJob(job: unknown) {
  const promise = (job as { promise?: Promise<unknown> | null } | null)
    ?.promise;
  if (promise) {
    await promise;
  }
  const status = String((job as { status?: unknown } | null)?.status || "");
  if (status === "failed") {
    const error =
      (job as { error?: Error | null } | null)?.error ||
      new Error("service_unavailable");
    throw error;
  }
}

function getPayloadString(job: JobRunRecord, key: string): string {
  return String(job.payload?.[key] || "").trim();
}

async function runLegacyCapsuleGeneration(
  deps: HandlerDeps,
  job: JobRunRecord,
) {
  const email = job.profileEmail;
  const capsuleId = job.entityId || getPayloadString(job, "capsuleId");
  const req = {
    body: {},
    params: { id: capsuleId },
    query: {},
    user: { email },
  };
  const res = createFakeResponse();
  const handler = deps.regenerateCapsuleWardrobeHandler as
    ((req: unknown, res: unknown) => Promise<unknown>) | undefined;
  if (!handler) {
    throw new Error("capsule_generation_handler_missing");
  }

  await handler(req, res);
  assertFakeResponseOk(res);
  const legacyJob = (
    deps.getWardrobeJobImpl as
      ((email: string, capsuleId: string) => unknown) | undefined
  )?.(email, capsuleId);
  await waitForLegacyJob(legacyJob);
}

async function runLegacySelectedRegeneration(
  deps: HandlerDeps,
  job: JobRunRecord,
) {
  const email = job.profileEmail;
  const capsuleId = job.entityId || getPayloadString(job, "capsuleId");
  const req = {
    body: {
      itemUrls: Array.isArray(job.payload.itemUrls) ? job.payload.itemUrls : [],
    },
    params: { id: capsuleId },
    query: {},
    user: { email },
  };
  const res = createFakeResponse();
  const handler = deps.regenerateSelectedCapsuleItemsHandler as
    ((req: unknown, res: unknown) => Promise<unknown>) | undefined;
  if (!handler) {
    throw new Error("capsule_selected_regeneration_handler_missing");
  }

  await handler(req, res);
  assertFakeResponseOk(res);
  const legacyJob = (
    deps.getPartialRegenerationJobImpl as
      ((email: string, capsuleId: string) => unknown) | undefined
  )?.(email, capsuleId);
  await waitForLegacyJob(legacyJob);
}

async function runCapsuleReport(deps: HandlerDeps, job: JobRunRecord) {
  const capsuleId = job.entityId || getPayloadString(job, "capsuleId");
  const report = await (
    deps.generateCapsuleReportImpl as (
      email: string,
      capsuleId: string,
    ) => Promise<unknown>
  )(job.profileEmail, capsuleId);
  return { report };
}

async function runOutfitReport(deps: HandlerDeps, job: JobRunRecord) {
  const outfitId = job.entityId || getPayloadString(job, "outfitId");
  const report = await (
    deps.generateOutfitReportImpl as (
      email: string,
      outfitId: string,
    ) => Promise<unknown>
  )(job.profileEmail, outfitId);
  return { report };
}

async function runPersonalItemsReport(deps: HandlerDeps, job: JobRunRecord) {
  const context =
    typeof job.payload.context === "string" ? job.payload.context : null;
  const result = await (
    deps.generatePersonalItemsReportImpl as (
      email: string,
      personalItemsContext?: string | null,
    ) => Promise<Record<string, unknown>>
  )(job.profileEmail, context);
  return result || {};
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
        await runLegacyCapsuleGeneration(deps, job);
        return {};
      case "capsuleRegenerateSelected":
        await runLegacySelectedRegeneration(deps, job);
        return {};
      case "capsuleReportGenerate":
        return await runCapsuleReport(deps, job);
      case "outfitReportGenerate":
        return await runOutfitReport(deps, job);
      case "personalItemsReportGenerate":
        return await runPersonalItemsReport(deps, job);
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
