import {
  deleteCapsuleReport,
  fetchCapsule,
  generateCapsuleReport,
} from "../api/capsules";
import { fromContext, type AppActionContext } from "./actionContext";
import { refreshCapsuleList } from "./capsuleListActions";
import type { CapsuleMeta, CapsuleMutationResponse } from "./appTypes";
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
  const result = (await fetchCapsule(capsuleId)) as {
    capsule?: CapsuleMeta | null;
  };
  if (capsuleId === fromContext<string>(context, "activeCapsuleId")) {
    fromContext<(capsule?: CapsuleMeta | null) => void>(
      context,
      "applyCapsuleState",
    )(result.capsule);
  }
  await refreshCapsuleList(context);
}

async function generateCurrentCapsuleReport(
  context: AppActionContext,
  capsuleId: string,
) {
  if (!capsuleId) return;
  setCapsuleReportPending(context, true);
  try {
    await generateCapsuleReport(capsuleId);
    await refreshActiveCapsuleReport(context, capsuleId);
  } catch {
    if (fromContext<{ current: boolean }>(context, "isMountedRef").current) {
      reportStatusError(
        context,
        fromContext<(key: string) => string>(
          context,
          "t",
        )("errors.capsuleReportGenerateFailed"),
      );
    }
  } finally {
    if (fromContext<{ current: boolean }>(context, "isMountedRef").current) {
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
