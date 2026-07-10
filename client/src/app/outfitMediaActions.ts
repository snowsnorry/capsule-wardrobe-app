import {
  deleteOutfitImage,
  deleteOutfitReport,
  downloadOutfitPdf,
  generateOutfitImage,
  generateOutfitReport,
} from "../api/outfits";
import { fromContext, type AppActionContext } from "./actionContext";
import {
  refreshActiveOutfit,
  reportStatusError,
  setActiveOutfit,
  setOutfitImagePending,
  setOutfitReportPending,
} from "./outfitActionHelpers";
import { refreshOutfitList } from "./outfitListActions";
import type { OutfitMutationResponse } from "./appTypes";
import { resolveRateLimitFlowMessage } from "./errorMessages";

export async function generateCurrentOutfitImage(
  context: AppActionContext,
  outfitId: string,
) {
  if (!outfitId) return;
  setOutfitImagePending(context, true);
  try {
    const response = (await generateOutfitImage(
      outfitId,
    )) as OutfitMutationResponse;
    if (response?.job && typeof response.job.id === "string") {
      const waitForJobCompletion = fromContext<
        (jobId: string) => Promise<{
          status: string;
          error?: { code?: string | null } | null;
        }>
      >(context, "waitForJobCompletion");
      void waitForJobCompletion(response.job.id)
        .then(async (finishedJob) => {
          if (finishedJob.status === "completed") {
            await refreshActiveOutfit(context, outfitId, {
              onlyIfActive: true,
            });
            return;
          }
          throw new Error(finishedJob.error?.code || "service_unavailable");
        })
        .catch((error) => {
          if (
            !fromContext<{ current: boolean }>(context, "isMountedRef").current
          )
            return;
          fromContext<(updater: (current: unknown) => unknown) => void>(
            context,
            "setStatus",
          )((current) => ({
            ...(current as object),
            error: fromContext<(error: unknown) => string>(
              context,
              "resolveErrorMessage",
            )(error),
          }));
        })
        .finally(() => {
          if (
            fromContext<{ current: boolean }>(context, "isMountedRef").current
          )
            setOutfitImagePending(context, false);
        });
      return;
    }
    if (response?.status === "pending") {
      await refreshActiveOutfit(context, outfitId, { onlyIfActive: true });
      setOutfitImagePending(context, false);
      return;
    }
    await refreshActiveOutfit(context, outfitId, { onlyIfActive: true });
    setOutfitImagePending(context, false);
  } catch (error) {
    if (fromContext<{ current: boolean }>(context, "isMountedRef").current) {
      setOutfitImagePending(context, false);
      fromContext<(updater: (current: unknown) => unknown) => void>(
        context,
        "setStatus",
      )((current) => ({
        ...(current as object),
        error: fromContext<(error: unknown) => string>(
          context,
          "resolveErrorMessage",
        )(error),
      }));
    }
  }
}

export async function generateCurrentOutfitReport(
  context: AppActionContext,
  outfitId: string,
) {
  if (!outfitId) return;
  setOutfitReportPending(context, true);
  try {
    const { job } = await generateOutfitReport(outfitId);
    if (fromContext<{ current: boolean }>(context, "isMountedRef").current) {
      setOutfitReportPending(context, false);
    }
    const waitForJobCompletion = fromContext<
      (jobId: string) => Promise<{
        status: string;
        error?: { code?: string | null } | null;
      }>
    >(context, "waitForJobCompletion");
    void waitForJobCompletion(job.id)
      .then(async (finishedJob) => {
        if (finishedJob.status === "completed") {
          await refreshActiveOutfit(context, outfitId, { onlyIfActive: true });
          return;
        }
        throw new Error(finishedJob.error?.code || "service_unavailable");
      })
      .catch((error) => {
        if (
          fromContext<{ current: boolean }>(context, "isMountedRef").current
        ) {
          const t = fromContext<(key: string) => string>(context, "t");
          reportStatusError(
            context,
            resolveRateLimitFlowMessage(
              error as Error,
              t,
              "errors.generationLimitActive",
            ) || t("errors.outfitReportGenerateFailed"),
          );
        }
      })
      .finally(() => {
        if (
          fromContext<{ current: boolean }>(context, "isMountedRef").current
        ) {
          setOutfitReportPending(context, false);
        }
      });
  } catch (error) {
    if (fromContext<{ current: boolean }>(context, "isMountedRef").current) {
      const t = fromContext<(key: string) => string>(context, "t");
      reportStatusError(
        context,
        resolveRateLimitFlowMessage(
          error as Error,
          t,
          "errors.generationLimitActive",
        ) || t("errors.outfitReportGenerateFailed"),
      );
      setOutfitReportPending(context, false);
    }
  }
}

export async function deleteCurrentOutfitReport(
  context: AppActionContext,
  outfitId: string,
) {
  if (!outfitId) return;
  setOutfitReportPending(context, true);
  try {
    const result = (await deleteOutfitReport(
      outfitId,
    )) as OutfitMutationResponse;
    setActiveOutfit(context, result.outfit || null);
    await refreshOutfitList(context);
  } catch (error) {
    if (fromContext<{ current: boolean }>(context, "isMountedRef").current) {
      reportStatusError(
        context,
        fromContext<(error: unknown) => string>(
          context,
          "resolveErrorMessage",
        )(error),
      );
    }
  } finally {
    if (fromContext<{ current: boolean }>(context, "isMountedRef").current) {
      setOutfitReportPending(context, false);
    }
  }
}

export async function deleteCurrentOutfitImage(
  context: AppActionContext,
  outfitId: string,
) {
  if (!outfitId) return;
  fromContext<(value: boolean) => void>(
    context,
    "setIsContentOperationLoading",
  )(true);
  try {
    await deleteOutfitImage(outfitId);
    await refreshActiveOutfit(context, outfitId);
  } catch (error) {
    if (fromContext<{ current: boolean }>(context, "isMountedRef").current) {
      fromContext<(updater: (current: unknown) => unknown) => void>(
        context,
        "setStatus",
      )((current) => ({
        ...(current as object),
        error: fromContext<(error: unknown) => string>(
          context,
          "resolveErrorMessage",
        )(error),
      }));
    }
  } finally {
    if (fromContext<{ current: boolean }>(context, "isMountedRef").current) {
      fromContext<(value: boolean) => void>(
        context,
        "setIsContentOperationLoading",
      )(false);
    }
  }
}

export async function downloadCurrentOutfitPdf(
  context: AppActionContext,
  outfitId: string,
) {
  if (!outfitId) return;
  fromContext<(value: boolean) => void>(
    context,
    "setIsDownloadingWardrobePdf",
  )(true);
  try {
    await downloadOutfitPdf(outfitId);
  } finally {
    fromContext<(value: boolean) => void>(
      context,
      "setIsDownloadingWardrobePdf",
    )(false);
  }
}
