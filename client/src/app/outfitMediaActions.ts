import {
  deleteOutfitImage,
  deleteOutfitReport,
  downloadOutfitPdf,
  generateOutfitImage,
  generateOutfitReport,
  subscribeOutfitEvents,
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

async function subscribeUntilOutfitImageReady(
  context: AppActionContext,
  outfitId: string,
) {
  const controller = new AbortController();
  await subscribeOutfitEvents({
    outfitId,
    signal: controller.signal,
    onMessage: (message) => {
      const isReady =
        message.event === "snapshot" &&
        !message.data?.pendingImage &&
        message.data?.status !== "pending";
      if (!isReady) return;

      controller.abort();
      void refreshActiveOutfit(context, outfitId, { onlyIfActive: true })
        .catch((error) => {
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
    },
    onError: (error) => {
      if (!fromContext<{ current: boolean }>(context, "isMountedRef").current)
        return;
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
    },
  }).catch(() => undefined);
}

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
    if (response?.status === "pending") {
      void subscribeUntilOutfitImageReady(context, outfitId);
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
    await generateOutfitReport(outfitId);
    await refreshActiveOutfit(context, outfitId, { onlyIfActive: true });
  } catch {
    if (fromContext<{ current: boolean }>(context, "isMountedRef").current) {
      reportStatusError(
        context,
        fromContext<(key: string) => string>(
          context,
          "t",
        )("errors.outfitReportGenerateFailed"),
      );
    }
  } finally {
    if (fromContext<{ current: boolean }>(context, "isMountedRef").current) {
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
