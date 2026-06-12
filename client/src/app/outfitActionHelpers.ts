import { fetchOutfit } from "../api/outfits";
import { fromContext, type AppActionContext } from "./actionContext";
import { refreshOutfitList } from "./outfitListActions";
import type { OutfitMeta, OutfitMutationResponse } from "./appTypes";

export function setActiveOutfit(
  context: AppActionContext,
  outfit: OutfitMeta | null,
) {
  fromContext<(value: string) => void>(
    context,
    "setActiveOutfitId",
  )(String(outfit?.id || ""));
  fromContext<(value: OutfitMeta | null) => void>(
    context,
    "setActiveOutfitMeta",
  )(outfit);
}

export async function runOutfitOperation(
  context: AppActionContext,
  operation: () => Promise<void>,
) {
  fromContext<(value: boolean) => void>(
    context,
    "setIsContentOperationLoading",
  )(true);
  try {
    await operation();
  } finally {
    fromContext<(value: boolean) => void>(
      context,
      "setIsContentOperationLoading",
    )(false);
  }
}

export async function refreshActiveOutfit(
  context: AppActionContext,
  outfitId: string,
  { onlyIfActive = false }: { onlyIfActive?: boolean } = {},
) {
  const result = (await fetchOutfit(outfitId)) as OutfitMutationResponse;
  if (
    !onlyIfActive ||
    fromContext<string>(context, "activeOutfitId") === outfitId
  ) {
    setActiveOutfit(context, result.outfit || null);
  }
  await refreshOutfitList(context);
}

export function setOutfitImagePending(
  context: AppActionContext,
  value: boolean,
) {
  fromContext<(nextValue: boolean) => void>(
    context,
    "setIsOutfitImagePending",
  )(value);
}

export function setOutfitReportPending(
  context: AppActionContext,
  value: boolean,
) {
  fromContext<(nextValue: boolean) => void>(
    context,
    "setIsOutfitReportPending",
  )(value);
}

export function reportStatusError(context: AppActionContext, error: string) {
  fromContext<(updater: (current: unknown) => unknown) => void>(
    context,
    "setStatus",
  )((current) => ({
    ...(current as object),
    error,
  }));
}
