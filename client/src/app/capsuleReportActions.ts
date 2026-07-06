import {
  deleteCapsuleReport,
  fetchCapsule,
  generateCapsuleReport,
} from "../api/capsules";
import { fromContext, type AppActionContext } from "./actionContext";
import { refreshCapsuleList } from "./capsuleListActions";
import type { CapsuleMeta, CapsuleMutationResponse } from "./appTypes";
import { resolveRateLimitFlowMessage } from "./errorMessages";
import { reportStatusError } from "./outfitActionHelpers";

function setCapsuleReportPending(context: AppActionContext, value: boolean) {
  fromContext<(nextValue: boolean) => void>(
    context,
    "setIsCapsuleReportPending",
  )(value);
}

async function refreshActiveCapsuleReport(
  context: AppActionContext,
  capsuleId: string,
) {
  const getActiveCapsuleId =
    fromContext<(() => string) | undefined>(context, "getActiveCapsuleId") ||
    (() => fromContext<string>(context, "activeCapsuleId"));
  if (capsuleId !== getActiveCapsuleId()) return;

  const result = (await fetchCapsule(capsuleId)) as {
    capsule?: CapsuleMeta | null;
  };
  fromContext<(capsule?: CapsuleMeta | null) => void>(
    context,
    "applyCapsuleState",
  )(result.capsule);
  await refreshCapsuleList(context);
}

async function generateCurrentCapsuleReport(
  context: AppActionContext,
  capsuleId: string,
) {
  if (!capsuleId) return;
  setCapsuleReportPending(context, true);
  try {
    const { job } = await generateCapsuleReport(capsuleId);
    if (fromContext<{ current: boolean }>(context, "isMountedRef").current) {
      setCapsuleReportPending(context, false);
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
          await refreshActiveCapsuleReport(context, capsuleId);
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
            ) || t("errors.capsuleReportGenerateFailed"),
          );
        }
      })
      .finally(() => {
        if (
          fromContext<{ current: boolean }>(context, "isMountedRef").current
        ) {
          setCapsuleReportPending(context, false);
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
        ) || t("errors.capsuleReportGenerateFailed"),
      );
      setCapsuleReportPending(context, false);
    }
  }
}

async function deleteCurrentCapsuleReport(
  context: AppActionContext,
  capsuleId: string,
) {
  if (!capsuleId) return;
  setCapsuleReportPending(context, true);
  try {
    const result = (await deleteCapsuleReport(
      capsuleId,
    )) as CapsuleMutationResponse;
    if (capsuleId === fromContext<string>(context, "activeCapsuleId")) {
      fromContext<(capsule?: CapsuleMeta | null) => void>(
        context,
        "applyCapsuleState",
      )(result.capsule);
    }
    await refreshCapsuleList(context);
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
      setCapsuleReportPending(context, false);
    }
  }
}

export { deleteCurrentCapsuleReport, generateCurrentCapsuleReport };
